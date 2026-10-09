/** Shared diagnostics collector (docs/specs/validation-and-coverage.md). */

/**
 * AL5: two behaviors that exist because of what the tool actually did when a
 * user got something wrong, not because of a design idea.
 *
 * 1. `hint` — a separate, optional "here is what to do" line. Keeping it out of
 *    `message` is what makes actionability structural: the message says what is
 *    wrong, the hint says what to change, and the CLI renders them distinctly
 *    (report.json keeps both fields). Before this, advice that the docs page
 *    already gave was simply absent at the point of failure.
 *
 * 2. De-duplication on (severity, code, message). DERIVE and NORMALIZE both run
 *    once per mode combo, so a single authoring mistake was reported once per
 *    combo — a 2-token alias cycle printed twelve lines. Identical text repeated
 *    N times carries no information beyond the first. Anything genuinely
 *    per-mode already says so in its message (contrast warnings name the mode),
 *    so those still come through separately.
 */
export class Diagnostics {
  constructor() {
    this.items = [];
    /** Warnings and infos silenced by `check.suppress`, each with its `reason`. Always present. */
    this.suppressed = [];
    this._seen = new Set();
  }
  #push(severity, code, message, context) {
    const key = `${severity} ${code} ${message}`;
    if (this._seen.has(key)) return;
    this._seen.add(key);
    this.items.push({ severity, code, message, ...context });
  }
  error(code, message, context = {}) { this.#push('error', code, message, context); }
  warn(code, message, context = {}) { this.#push('warning', code, message, context); }
  info(code, message, context = {}) { this.#push('info', code, message, context); }
  /**
   * `check.suppress`: move the warnings and infos that match a rule out of
   * `items` (so they neither print nor trip `failOn`) into `suppressed`, each
   * with the rule's reason. Silence, never downgrade; an error is never moved.
   * A rule matches when the codes are equal and, if it has a `path`, the
   * diagnostic has a `path` equal to it (or, for `prefix.*`, below it). A rule
   * without `path` matches every diagnostic of its code, the only way to match
   * one that is not about a token. A rule that silenced nothing gets TST1012
   * (info, appended last), so a stale entry is visible instead of rotting.
   * `labels` (optional, one per rule) is how TST1012 names an entry; an
   * `extends` chain passes the file each entry is written in.
   */
  applySuppressions(rules = [], labels) {
    if (rules.length === 0) return;
    const silenced = rules.map(() => 0);
    const sawError = rules.map(() => false);
    const matches = (rule, item) => {
      if (rule.code !== item.code) return false;
      if (rule.path === undefined) return true;
      if (typeof item.path !== 'string') return false;
      return rule.path.endsWith('.*')
        ? item.path.startsWith(rule.path.slice(0, -1))
        : item.path === rule.path;
    };
    const kept = [];
    for (const item of this.items) {
      const i = rules.findIndex((rule) => matches(rule, item));
      if (i === -1) { kept.push(item); continue; }
      if (item.severity === 'error') { sawError[i] = true; kept.push(item); continue; }
      silenced[i]++;
      this.suppressed.push({ ...item, reason: rules[i].reason });
    }
    this.items = kept;
    rules.forEach((rule, i) => {
      if (silenced[i] > 0) return;
      const what = `${rule.code}${rule.path === undefined ? '' : ` at ${rule.path}`}`;
      this.info(
        'TST1012',
        sawError[i]
          ? `${labels?.[i] ?? `check.suppress[${i}]`} (${what}) matches an error, and errors cannot be suppressed`
          : `${labels?.[i] ?? `check.suppress[${i}]`} (${what}) matched no diagnostic`,
        {
          hint: sawError[i]
            ? 'Fix the error; remove the entry if it was meant for a warning.'
            : 'Remove the entry if the diagnostic is gone. When building a single target, an entry for another target\'s diagnostic reads the same way.',
        },
      );
    });
  }
  get errors() { return this.items.filter((i) => i.severity === 'error'); }
  get warnings() { return this.items.filter((i) => i.severity === 'warning'); }
  /** Did this code already fire? Used to suppress consequences of a root cause. */
  has(code) { return this.items.some((i) => i.code === code); }
  shouldFail(failOn = 'error') {
    if (failOn === 'error') return this.errors.length > 0;
    if (failOn === 'warning') return this.errors.length > 0 || this.warnings.length > 0;
    return this.errors.length > 0;
  }
}
