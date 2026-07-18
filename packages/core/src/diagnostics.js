/** Shared diagnostics collector (docs/specs/validation-and-coverage.md). */

export class Diagnostics {
  constructor() { this.items = []; }
  error(code, message, context = {}) { this.items.push({ severity: 'error', code, message, ...context }); }
  warn(code, message, context = {}) { this.items.push({ severity: 'warning', code, message, ...context }); }
  info(code, message, context = {}) { this.items.push({ severity: 'info', code, message, ...context }); }
  get errors() { return this.items.filter((i) => i.severity === 'error'); }
  get warnings() { return this.items.filter((i) => i.severity === 'warning'); }
  shouldFail(failOn = 'error') {
    if (failOn === 'error') return this.errors.length > 0;
    if (failOn === 'warning') return this.errors.length > 0 || this.warnings.length > 0;
    return this.errors.length > 0;
  }
}
