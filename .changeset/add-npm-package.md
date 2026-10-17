---
'@transtyle/cli': minor
---

`transtyle add <npm package>` installs a community exporter by its exact npm name (or a local `npm pack` tarball). It reads the package's manifest without installing or running anything and prints it, then installs with `--ignore-scripts` and adds a target `{ "exporter": "<package>", "output": "dist/<name>" }` named after the manifest. A declarative package prints "No code will run" and installs without a question; a package that runs code asks for a yes on a terminal, `--yes` skips the question, and without a terminal it exits 2. A package with no manifest, an importer, a target already configured and an IR spec or plugin API this version does not accept are refused (exit 2) before anything is installed. Official names work as before.
