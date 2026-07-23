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
