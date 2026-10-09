/**
 * Source locations on diagnostics (docs/specs/validation-and-coverage.md#source-locations).
 * A diagnostic about a token carries its `path`; NORMALIZE recorded, for every
 * authored key, the file and position it came from (`normalized.sources`).
 * One pass joins the two, so no diagnostic call site has to know about files.
 * A diagnostic that already has a `file` (LOAD's own, or a mode-scoped layer's)
 * is left as it is; one whose path is not authored in any file (a derived slot)
 * stays without a location, on purpose.
 */
export function fillLocations(items, sources) {
  if (!sources) return;
  for (const item of items) {
    if (item.file !== undefined || typeof item.path !== 'string') continue;
    const at = sources.get(item.path);
    if (at) Object.assign(item, at);
  }
}
