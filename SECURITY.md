# Security Policy

## Supported versions

Transtyle is pre-1.0. Only the latest release on the `main` branch receives security fixes.

## Threat model notes

Transtyle is a build-time compiler. It reads local JSON/config files and writes local output files. By design it has **no network access, no executable config, and zero runtime dependencies** in the compiler packages (`packages/*`) — see [CONTRIBUTING.md](CONTRIBUTING.md). The main risks to report are therefore:

- Path traversal via crafted config (`outDir`, file references) causing writes outside the project directory.
- Malicious token/config files causing non-terminating builds (cycle-detection bypass, resource exhaustion).
- Third-party exporter plugins are **out of scope** — they are arbitrary code you choose to install, same trust model as any npm dependency.

## Reporting a vulnerability

Please **do not open a public issue** for security reports. Instead:

- Use GitHub's private vulnerability reporting ("Report a vulnerability" under the Security tab), or
- Email juderamond@gmail.com with `[transtyle security]` in the subject.

You can expect an acknowledgment within 7 days. Fixes are published as ordinary releases with a credit in the changelog unless you prefer anonymity.
