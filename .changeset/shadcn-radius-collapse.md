---
'@transtyle/exporter-shadcn': minor
---

New info `TST2104`: when `radius.md` is above 0 but at most 4px, shadcn's own offsets bring `--radius-sm` (and `--radius-md` at 2px or less) to 0 or below, so `rounded-sm` renders square. The exporter now says so once per instance, in both eras (`borderRadius.sm`/`md` in tailwind-v3). `radius.md: 0` is a square design and stays silent.
