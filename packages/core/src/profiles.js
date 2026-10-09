/**
 * Target version profiles (ADR-0006, issue #83, docs/architecture/versioning.md).
 *
 * An exporter's manifest declares the framework versions it supports as a
 * list of ranges, one per mapping profile: `"targets": { "bootstrap":
 * [">=5.3 <6"] }`, `"shadcn": [">=3 <4", ">=4 <5"]`. A project may request the
 * version it uses (`targets.<t>.version: "5.3.8"`); core selects the profile
 * covering it and hands both to the exporter as `ctx.targetVersion` and
 * `ctx.targetProfile`, so an exporter keys its tables on the range string it
 * declared and never parses a version itself.
 *
 * Ranges are matched with the same zero-dependency matcher the load-time
 * compatibility check uses (semver.js). Pure: no I/O.
 */

import { parseVersion, satisfies } from './semver.js';

/**
 * The profiles a manifest declares: `{ framework, ranges }`, or null when it
 * declares none. A manifest normally lists one framework; with several, the
 * one named like the exporter (`manifest.name`) or the target instance wins.
 */
export function declaredProfiles(manifest, instanceName) {
  const targets = manifest?.targets;
  if (!targets || typeof targets !== 'object' || Array.isArray(targets)) return null;
  const keys = Object.keys(targets);
  const framework = keys.length === 1 ? keys[0] : [manifest.name, instanceName].find((k) => k && k in targets);
  const ranges = framework ? targets[framework] : undefined;
  if (!Array.isArray(ranges) || ranges.length === 0) return null;
  return { framework, ranges: ranges.filter((r) => typeof r === 'string') };
}

/**
 * The profile for a requested version: the last declared range that covers
 * it (later entries are newer profiles), or null when none does. With no
 * version requested, the newest profile: the last entry.
 */
export function selectProfile(ranges, version) {
  if (version == null) return ranges.at(-1) ?? null;
  if (!parseVersion(version)) return null;
  return ranges.filter((r) => satisfies(version, r) === true).at(-1) ?? null;
}
