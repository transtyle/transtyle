---
'@transtyle/cli': patch
---

Write `bin.transtyle` as `src/main.js` rather than `./src/main.js`.

npm normalizes bin paths when publishing. On npm 10.x the leading `./` was silently cleaned; on newer npm the same field is reported as "invalid and removed", which publishes a CLI package with no `transtyle` command. `0.1.0-alpha.0` was cleaned rather than stripped and is intact, but the field is now written in the form npm expects so the outcome no longer depends on the publisher's npm version.

A new `check:manifests` guard covers the class: it verifies `publishConfig.access`, provenance metadata, that every `files` entry exists, and that `main`/`exports`/`bin` all resolve, sit inside the `files` allowlist, and (for `bin`) carry a shebang and an executable bit — none of which is observable from inside the workspace, where the binary is already linked.
