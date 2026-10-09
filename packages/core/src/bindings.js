/**
 * Binding rules (docs/specs/configuration.md#bindings): the config's
 * `bindings` array, expanded at LOAD into ordinary DTCG alias tokens before
 * NORMALIZE. Everything downstream (IR, exporters, `diff`) sees plain aliases,
 * so the feature adds no concept to the IR; the only trace is `provenance.rule`
 * on the alias, which `explain` prints.
 *
 * Determinism: placeholders iterate fixed, ordered sets (the built-in roles in
 * catalog order, then custom roles sorted by name; the text rungs; the elevation
 * levels), the cross product is taken in the fixed order role > rung > level, and
 * rules apply in array order. Nothing depends on file system or object-key order.
 *
 * Precedence ("authored tokens always win"):
 *   1. a token already in a token file (an authored value or an explicit alias)
 *      beats any rule: the rule skips that slot, silently (the override is the
 *      point; `transtyle bindings --expand` lists what was skipped);
 *   2. between two rules, the first one in the array wins (TST1119 notes it);
 *   3. a rule whose target token does not exist skips that slot, silently,
 *      unless the rule is `required` (TST1118).
 */

import { COLOR_ROLES, TEXT_RUNGS, ELEVATION_LEVELS, collectTokens, collectRoleArchetypes, mergeTrees } from '@transtyle/ir';

const PLACEHOLDER = /\{([^{}]*)\}/g;
/** Placeholder names, in the fixed order the cross product iterates them. */
export const BINDING_PLACEHOLDERS = ['role', 'rung', 'level'];
const SLOT_SHAPE = /^[^\s.{}]+(\.[^\s.{}]+)*$/;

const names = (text) => [...text.matchAll(PLACEHOLDER)].map((m) => m[1]);
const stripPlaceholders = (text) => text.replace(PLACEHOLDER, 'x');
const fill = (text, values) => text.replace(PLACEHOLDER, (_, name) => values[name]);
const sample = (list) => list.slice(0, 3).join(', ') + (list.length > 3 ? `, … (${list.length} in all)` : '');

/**
 * @param trees the loaded token trees (`loadTokenTrees()`)
 * @param config the validated config
 * @returns null when the config has no `bindings`; otherwise
 *   `{ tree, rules, aliases, skipped }`: `tree` is the DTCG tree of alias tokens
 *   to append as one more base layer, `rules` maps each produced slot to the
 *   label of its rule (`bindings[0]: <slot pattern>`), `aliases` lists
 *   `{ slot, from, rule }` in creation order, `skipped` lists
 *   `{ slot, rule, reason }` with reason `authored` | `rule` | `missing-target`.
 */
export function expandBindings(trees, config, diagnostics) {
  const rules = config.bindings;
  if (!rules?.length) return null;

  const merged = mergeTrees(trees.filter((t) => !t.modeScope).map((t) => t.tree));
  const authored = collectTokens(merged);
  const customRoles = [...collectRoleArchetypes(merged).keys()].sort();
  const allRoles = [...COLOR_ROLES, ...customRoles];
  const domains = { role: allRoles, rung: TEXT_RUNGS, level: ELEVATION_LEVELS.map(String) };

  // An authored token at the slot, inside it (the slot names a group), or above it.
  const authoredPaths = [...authored.keys()];
  const isAuthored = (slot) => authoredPaths.some((p) => p === slot || p.startsWith(`${slot}.`) || slot.startsWith(`${p}.`));

  const tree = {};
  const ruleOf = new Map();
  const aliases = [];
  const skipped = [];

  rules.forEach((rule, index) => {
    const label = `bindings[${index}]: ${rule.slot}`;
    const bad = (message, hint) => diagnostics.error('TST1117', `${label}: ${message}`, hint ? { hint } : undefined);

    // ----- validate the rule's shape -----
    const slotNames = names(rule.slot);
    const unknown = slotNames.filter((n) => !BINDING_PLACEHOLDERS.includes(n));
    if (unknown.length) {
      return bad(`unknown placeholder {${unknown[0]}}`, `The placeholders are ${BINDING_PLACEHOLDERS.map((n) => `{${n}}`).join(', ')}. Write any other segment literally.`);
    }
    if (/[{}]/.test(rule.slot.replace(PLACEHOLDER, '')) || !SLOT_SHAPE.test(stripPlaceholders(rule.slot))) {
      return bad('`slot` must be a dotted token path, with whole segments or {placeholders}', 'For example "semantic.color.{role}.solid".');
    }
    const fromMatch = /^\{(.*)\}$/.exec(rule.from);
    const fromInner = fromMatch?.[1] ?? '';
    if (!fromMatch || /[{}]/.test(fromInner.replace(PLACEHOLDER, '')) || !SLOT_SHAPE.test(stripPlaceholders(fromInner))) {
      return bad('`from` must be one alias, like "{option.color.{role}.600}"', 'Only {role}, {rung} and {level} may appear inside the braces.');
    }
    const fromNames = names(fromInner);
    const fromUnknown = fromNames.filter((n) => !BINDING_PLACEHOLDERS.includes(n));
    if (fromUnknown.length) {
      return bad(`unknown placeholder {${fromUnknown[0]}} in \`from\``, `The placeholders are ${BINDING_PLACEHOLDERS.map((n) => `{${n}}`).join(', ')}.`);
    }
    const missingFromSlot = fromNames.find((n) => !slotNames.includes(n));
    if (missingFromSlot) {
      return bad(`\`from\` uses {${missingFromSlot}} but \`slot\` does not, so one slot would get several values`, `Add {${missingFromSlot}} to \`slot\`, or write that segment of \`from\` literally.`);
    }
    if (rule.roles) {
      if (!slotNames.includes('role')) return bad('`roles` needs {role} in `slot`');
      const nope = rule.roles.filter((r) => !allRoles.includes(r));
      if (nope.length) return bad(`\`roles\` names unknown role "${nope[0]}"`, `Known roles: ${allRoles.join(', ')}.`);
    }

    // ----- expand: cross product in the fixed order role > rung > level -----
    const used = BINDING_PLACEHOLDERS.filter((n) => slotNames.includes(n));
    let combos = [{}];
    for (const n of used) {
      const values = n === 'role' && rule.roles ? allRoles.filter((r) => rule.roles.includes(r)) : domains[n];
      combos = combos.flatMap((c) => values.map((v) => ({ ...c, [n]: v })));
    }

    const lostToRule = [];
    const missingTargets = [];
    for (const values of combos) {
      const slot = fill(rule.slot, values);
      const target = fill(fromInner, values);
      if (isAuthored(slot)) { skipped.push({ slot, rule: label, reason: 'authored' }); continue; }
      if (ruleOf.has(slot)) { skipped.push({ slot, rule: label, reason: 'rule' }); lostToRule.push(slot); continue; }
      if (!authored.has(target)) {
        skipped.push({ slot, rule: label, reason: 'missing-target' });
        missingTargets.push(`${slot} ← {${target}}`);
        continue;
      }
      if (!place(tree, slot, `{${target}}`)) {
        bad(`slot "${slot}" overlaps another binding: one is a group the other is a token inside`);
        continue;
      }
      ruleOf.set(slot, label);
      aliases.push({ slot, from: `{${target}}`, rule: label });
    }

    if (lostToRule.length) {
      diagnostics.info('TST1119', `${label}: ${lostToRule.length} slot(s) already bound by an earlier rule, which wins: ${sample(lostToRule)}`);
    }
    if (rule.required && missingTargets.length) {
      diagnostics.error('TST1118', `${label}: required, but ${missingTargets.length} target(s) do not exist: ${sample(missingTargets)}`, {
        hint: 'Author the missing tokens, narrow the rule with `roles`, or drop `required` to skip slots whose target is absent.',
      });
    }
  });

  return { tree, rules: ruleOf, aliases, skipped };
}

/** Put an alias token at a dotted path; false when it would sit inside a token or replace a group. */
function place(tree, slot, value) {
  const parts = slot.split('.');
  let node = tree;
  for (const part of parts.slice(0, -1)) {
    if (node[part] === undefined) node[part] = {};
    node = node[part];
    if ('$value' in node) return false;
  }
  const leaf = parts.at(-1);
  if (leaf in node) return false;
  node[leaf] = { $value: value };
  return true;
}
