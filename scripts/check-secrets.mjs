#!/usr/bin/env node
/**
 * History audit: has this repository ever committed a credential or a piece of
 * personal information?
 *
 * The question is deliberately about HISTORY, not the working tree. `git rm`ing
 * a leaked token does not unleak it — the blob stays reachable, GitHub serves
 * it forever at its object URL, and every fork and clone carries it. So this
 * reads every blob that has ever existed in any ref, not just the checked-out
 * files, and it reads each unique blob once rather than once per commit that
 * contained it.
 *
 * WHAT IT WILL AND WILL NOT FIND. It matches known credential SHAPES (npm,
 * GitHub, AWS, Slack, Stripe, Google, OpenAI, Anthropic, JWTs, PEM private
 * keys) and a handful of personal-data patterns. It cannot find a secret with
 * no recognisable shape — a database password that looks like a word, an
 * internal URL that is sensitive only in context. A clean run is evidence, not
 * proof, and the file-name rules below matter as much as the content ones:
 * `.env` and `id_rsa` are the usual way real secrets arrive.
 *
 * ITS OUTPUT IS SAFE TO PASTE. Every match is redacted to a short prefix and a
 * length before printing, so pasting a failing run into an issue does not
 * publish the thing it found. That is not a nicety: the natural next step after
 * a hit is to show someone, and a scanner that leaks what it catches is worse
 * than none.
 *
 * Run: node scripts/check-secrets.mjs (also: npm run check:secrets).
 * Deliberately NOT in check:all — it audits history, which does not change when
 * you edit a file. Run it before a release, or after anything unusual.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const git = (args, opts = {}) =>
  execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 1 << 28, ...opts });

/** Never print what we found. A prefix and a length identify it; the rest is the leak. */
const redact = (s) => {
  const t = s.trim();
  return `${t.slice(0, 4)}…[${t.length} chars]`;
};

// ---------------------------------------------------------------------------
// What counts as ours. These appear in commit metadata by design — git commits
// carry an author email, and this one is already public on every commit page.
// ---------------------------------------------------------------------------
const KNOWN_EMAILS = [
  /^juderamond@gmail\.com$/i,
  /@users\.noreply\.github\.com$/i,
  /^noreply@anthropic\.com$/i,
];
// Addresses that are documentation, not people.
// Reserved, unroutable TLDs (RFC 2606/6761) plus the usual doc domains. An
// address at one of these cannot belong to a person.
const PLACEHOLDER_EMAILS = /@(?:[\w.-]+\.)?(?:test|invalid|example|localhost)$|@(?:example\.(?:com|org|net)|domain\.tld|acme\.)/i;

const CONTENT_RULES = [
  // --- credentials with an unmistakable shape ------------------------------
  { id: 'npm-token', severity: 'high', re: /\bnpm_[A-Za-z0-9]{36}\b/g, what: 'npm access token' },
  { id: 'github-token', severity: 'high', re: /\bgh[pousr]_[A-Za-z0-9]{36,255}\b/g, what: 'GitHub token' },
  { id: 'github-pat', severity: 'high', re: /\bgithub_pat_[A-Za-z0-9_]{40,}\b/g, what: 'GitHub fine-grained PAT' },
  { id: 'aws-key-id', severity: 'high', re: /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/g, what: 'AWS access key id' },
  { id: 'google-api-key', severity: 'high', re: /\bAIza[0-9A-Za-z_-]{35}\b/g, what: 'Google API key' },
  { id: 'slack-token', severity: 'high', re: /\bxox[abprs]-[0-9A-Za-z-]{10,}\b/g, what: 'Slack token' },
  { id: 'stripe-key', severity: 'high', re: /\bsk_live_[0-9A-Za-z]{20,}\b/g, what: 'Stripe live secret key' },
  { id: 'anthropic-key', severity: 'high', re: /\bsk-ant-[A-Za-z0-9_-]{20,}\b/g, what: 'Anthropic API key' },
  { id: 'openai-key', severity: 'high', re: /\bsk-(?:proj-)?[A-Za-z0-9]{40,}\b/g, what: 'OpenAI API key' },
  { id: 'private-key', severity: 'high', re: /-----BEGIN (?:RSA |EC |DSA |OPENSSH |PGP )?PRIVATE KEY-----/g, what: 'PEM private key block' },
  { id: 'npmrc-auth', severity: 'high', re: /_authToken\s*=\s*\S+/g, what: 'npm _authToken' },
  { id: 'jwt', severity: 'medium', re: /\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g, what: 'JWT (may carry claims about you)' },

  // --- credentials with no shape, caught by their label --------------------
  // Assignment of a literal to something named like a secret. Placeholders are
  // filtered after matching, because the pattern cannot tell them apart.
  {
    id: 'labelled-secret',
    severity: 'medium',
    re: /\b(?:password|passwd|secret|api[_-]?key|access[_-]?token|auth[_-]?token|client[_-]?secret)\b["']?\s*[:=]\s*["'`]([^"'`\n]{8,})["'`]/gi,
    what: 'a literal assigned to a secret-sounding name',
    ignore: (m) => /^(\$|\{\{|<|your|example|changeme|placeholder|xxx|\.\.\.|todo|redacted|\*+$)/i.test(m[1]) || /\$\{/.test(m[1]),
  },

  // --- personal information -------------------------------------------------
  {
    id: 'local-path',
    severity: 'low',
    re: /\/(?:Users|home)\/([A-Za-z0-9._-]+)\//g,
    what: 'an absolute path from someone\'s machine (leaks the OS username)',
    // GitHub runners are literally /home/runner; that is not a person.
    ignore: (m) => ['runner', 'root'].includes(m[1]),
  },
  {
    id: 'email',
    severity: 'low',
    re: /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g,
    what: 'an email address',
    ignore: (m) => KNOWN_EMAILS.some((k) => k.test(m[0])) || PLACEHOLDER_EMAILS.test(m[0]),
  },
];

/** Files whose very presence in history is the finding, whatever is inside. */
const PATH_RULES = [
  { id: 'dotenv', severity: 'high', re: /(^|\/)\.env(\.|$)/, what: 'a .env file' },
  { id: 'npmrc', severity: 'medium', re: /(^|\/)\.npmrc$/, what: 'an .npmrc (check it for _authToken)' },
  { id: 'ssh-key', severity: 'high', re: /(^|\/)(id_rsa|id_dsa|id_ecdsa|id_ed25519)(\.pub)?$/, what: 'an SSH key' },
  { id: 'cert-key', severity: 'high', re: /\.(pem|key|p12|pfx|keystore|jks)$/, what: 'a key or certificate file' },
  { id: 'cloud-creds', severity: 'high', re: /(^|\/)(\.aws\/|\.ssh\/|credentials\.json|service-account.*\.json)/, what: 'a cloud credentials file' },
];

// ---------------------------------------------------------------------------
// Prove the detectors work before trusting a clean report.
//
// A scanner whose regexes quietly stopped matching reports "no findings"
// forever, and reads exactly like a repository with nothing to find. So every
// run first checks each rule against a synthetic positive.
//
// The samples are ASSEMBLED AT RUNTIME rather than written as literals. A file
// containing a real-shaped npm token would be found by its own scan of history
// on the very next commit, and a scanner that cannot be committed is not much
// of a scanner.
// ---------------------------------------------------------------------------
const seg = (n) => 'a1B2'.repeat(Math.ceil(n / 4)).slice(0, n);
// A Map of pairs rather than an object literal, for a reason that is itself a
// test result. In object form the sample key sat immediately before a quoted
// literal, which is exactly the shape the labelled-secret rule looks for — so
// this file matched its own rule and the scanner reported a finding against
// itself on every run. (The first attempt at THIS comment did it again, by
// quoting the offending line verbatim. Hence the paraphrase.)
//
// Excluding the scanner from its own scan would be the wrong fix: that is
// precisely the file where hiding something should be hardest. The samples are
// shaped not to match instead.
const SELF_TEST = new Map([
  ['npm-token', 'npm_' + seg(36)],
  ['github-token', 'ghp_' + seg(36)],
  ['github-pat', 'github_pat_' + seg(60)],
  ['aws-key-id', 'AKIA' + 'ABCDEFGHIJKLMNOP'],
  ['google-api-key', 'AIza' + seg(35)],
  ['slack-token', 'xoxb-' + seg(20)],
  ['stripe-key', 'sk_live_' + seg(24)],
  ['anthropic-key', 'sk-ant-' + seg(24)],
  ['openai-key', 'sk-' + seg(48)],
  ['private-key', '-----BEGIN ' + 'PRIVATE KEY-----'],
  ['npmrc-auth', '_authToken' + '=' + seg(30)],
  ['jwt', 'eyJ' + seg(20) + '.eyJ' + seg(20) + '.' + seg(20)],
  ['labelled-secret', 'pass' + 'word' + ': "' + seg(16) + '"'],
  ['local-path', '/Users/' + 'somebody' + '/project/'],
  ['email', 'someone' + '@' + 'a-real-domain.io'],
]);
const broken = [];
for (const rule of CONTENT_RULES) {
  const sample = SELF_TEST.get(rule.id);
  if (sample === undefined) { broken.push(`${rule.id}: no self-test sample`); continue; }
  rule.re.lastIndex = 0;
  const m = [...sample.matchAll(rule.re)].find((x) => !rule.ignore?.(x));
  if (!m) broken.push(`${rule.id}: does not match its own positive sample`);
}
if (broken.length) {
  for (const b of broken) console.error(`✖ self-test: ${b}`);
  console.error('\nRefusing to report on history with a detector that cannot detect.');
  process.exit(2);
}

// ---------------------------------------------------------------------------
// Every blob that has ever existed, read once.
// ---------------------------------------------------------------------------
const objects = git(['rev-list', '--objects', '--all'])
  .split('\n')
  .filter(Boolean)
  .map((l) => {
    const i = l.indexOf(' ');
    return i === -1 ? { sha: l, path: '' } : { sha: l.slice(0, i), path: l.slice(i + 1) };
  })
  .filter((o) => o.path);

/** sha -> every path it was ever stored under (a blob can be moved or copied). */
const paths = new Map();
for (const { sha, path } of objects) {
  if (!paths.has(sha)) paths.set(sha, new Set());
  paths.get(sha).add(path);
}

const shas = [...paths.keys()];
const MAX_BLOB = 512 * 1024;

/**
 * `git cat-file --batch` speaks a binary stream: a header line, then exactly
 * `size` bytes, then a newline. Parsing it is the price of not spawning one git
 * per blob — 3500 spawns is minutes, this is under a second.
 */
const batch = execFileSync('git', ['cat-file', '--batch'], {
  cwd: root,
  input: shas.join('\n') + '\n',
  maxBuffer: 1 << 30,
});

const findings = [];
const record = (rule, sha, where, sample) =>
  findings.push({ rule, sha: sha.slice(0, 8), where, sample: redact(sample) });

let offset = 0;
let scanned = 0;
let skipped = 0;
while (offset < batch.length) {
  const nl = batch.indexOf(0x0a, offset);
  if (nl === -1) break;
  const [sha, type, sizeStr] = batch.toString('utf8', offset, nl).split(' ');
  const size = Number(sizeStr);
  const start = nl + 1;
  offset = start + size + 1;
  if (type !== 'blob') continue;

  const where = [...paths.get(sha)].join(', ');
  for (const rule of PATH_RULES) {
    for (const p of paths.get(sha)) {
      if (rule.re.test(p)) record(rule, sha, p, p);
    }
  }

  if (size > MAX_BLOB) { skipped++; continue; }
  const buf = batch.subarray(start, start + size);
  // A NUL byte means binary: images, fonts, the OG cards. No text rule applies.
  if (buf.includes(0)) { skipped++; continue; }
  scanned++;

  const text = buf.toString('utf8');
  for (const rule of CONTENT_RULES) {
    rule.re.lastIndex = 0;
    const seen = new Set();
    for (const m of text.matchAll(rule.re)) {
      if (rule.ignore?.(m)) continue;
      if (seen.has(m[0])) continue;
      seen.add(m[0]);
      record(rule, sha, where, m[0]);
    }
  }
}

// ---------------------------------------------------------------------------
// Commit metadata: messages, and the identities baked into every commit.
// ---------------------------------------------------------------------------
const messages = git(['log', '--all', '--format=%H%x00%B%x00']).split('\0');
for (let i = 0; i + 1 < messages.length; i += 2) {
  const sha = messages[i].trim();
  const body = messages[i + 1];
  for (const rule of CONTENT_RULES) {
    rule.re.lastIndex = 0;
    for (const m of body.matchAll(rule.re)) {
      if (rule.ignore?.(m)) continue;
      record(rule, sha, `commit message ${sha.slice(0, 8)}`, m[0]);
    }
  }
}

const identities = [...new Set(git(['log', '--all', '--format=%an <%ae>%n%cn <%ce>']).split('\n').filter(Boolean))];
const unexpected = identities.filter((id) => {
  const email = /<([^>]+)>/.exec(id)?.[1] ?? '';
  return !KNOWN_EMAILS.some((k) => k.test(email));
});

// ---------------------------------------------------------------------------
// Report. Findings are grouped, and the commits are looked up only for things
// that actually matched — `--find-object` is slow enough to matter otherwise.
// ---------------------------------------------------------------------------
const byRule = new Map();
for (const f of findings) {
  if (!byRule.has(f.rule.id)) byRule.set(f.rule.id, { rule: f.rule, hits: [] });
  byRule.get(f.rule.id).hits.push(f);
}

const ORDER = { high: 0, medium: 1, low: 2 };
const groups = [...byRule.values()].sort((a, b) => ORDER[a.rule.severity] - ORDER[b.rule.severity]);
const high = groups.filter((g) => g.rule.severity === 'high');

for (const { rule, hits } of groups) {
  const mark = { high: '✖', medium: '!', low: '·' }[rule.severity];
  console.log(`\n${mark} ${rule.severity.toUpperCase()} — ${rule.what} (${rule.id}): ${hits.length} occurrence(s)`);
  for (const h of hits.slice(0, 12)) console.log(`    ${h.sample}  in  ${h.where}`);
  if (hits.length > 12) console.log(`    … and ${hits.length - 12} more`);
}

console.log(`\n— commit identities —`);
for (const id of identities) console.log(`    ${id}${unexpected.includes(id) ? '   ← not in the known list' : ''}`);

console.log(
  `\nScanned ${scanned} text blob(s) across ${objects.length} object entries and ${Math.floor(messages.length / 2)} commit message(s); ` +
    `${skipped} binary or oversized blob(s) skipped.`,
);

if (high.length) {
  console.error(
    `\n✖ ${high.reduce((n, g) => n + g.hits.length, 0)} HIGH severity finding(s).\n` +
      `  A committed credential is not fixed by deleting the file: the blob stays reachable in\n` +
      `  every clone and on GitHub. ROTATE THE CREDENTIAL FIRST, then decide whether rewriting\n` +
      `  history is worth it.`,
  );
  process.exit(1);
}
console.log(`\n✔ secrets audit: no high-severity findings across the full history`);
