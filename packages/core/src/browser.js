/**
 * @transtyle/core/browser — the compiler with no filesystem, for a browser, a
 * worker, a playground or any host without Node (docs/architecture/overview.md:
 * "core is a library first"). Nothing reachable from this file imports a Node
 * built-in, and `npm run check:browser` proves it on every run. It is the main
 * entry minus the functions that read or write a disk: `compile()`,
 * `loadProject()`, `writeResults()`, `loadConfig()`, `expandTokenFiles()`,
 * `loadConfigChain()`/`mergeConfigChain()` (an `extends` chain is file paths),
 * `readMappingFile()`/`loadDeclarativePackage()` (a mapping read from a path),
 * `MANIFEST_FILE`/`hashContents()` (the emitted-file manifest records what
 * landed on disk), `loadContrast()`/`loadApca()` (which resolve `apca-w3` from
 * a directory) and `suggestBindings()` (which reads a project from disk).
 */

export { compileProject, checkExporterDiagnostics } from './pipeline.js';
export { parseColor, formatColor, formatHslTriplet, formatHex, contrastRatio, mix } from './color.js';
export { Diagnostics } from './diagnostics.js';
export { makeUnits, DEFAULT_REM_BASE } from './units.js';
export { diffResolved, contrastRegressions } from './diff.js';
export { CONTRAST_STANDARDS, APCA_LEVELS, APCA_BASE_ALGORITHM } from './contrast.js';
export { explainToken, explainVariable, slotConsumers, coverageSlots } from './explain.js';
export { deprecationsReached } from './metadata.js';
export { catalog, isCatalogSlot } from './catalog.js';
export { adoption } from './adoption.js';
export { buildReport, REPORT_SCHEMA_ID } from './report.js';
export { migrateStyleDictionary, needsStyleDictionaryMigration, STYLE_DICTIONARY_NAMESPACE } from './migrate-style-dictionary.js';
export { consumption } from './reads.js';
export { completenessStatus, completenessLevels, COMPLETENESS_LEVELS, DEFAULT_COMPLETENESS_LEVEL } from './completeness.js';
export { customTokens, isCustomRow, accountCustomTokens, customVocabularySentence, CUSTOM_MEANING } from './custom.js';
export { expandBindings, BINDING_PLACEHOLDERS } from './bindings.js';
export { checkPluginCompat, PLUGIN_API_VERSIONS } from './compat.js';
export { SYNONYMS_VERSION } from './synonyms.js';
export { createDeclarativeExporter, validateMapping, unknownMappingModes, unknownMappingSlots, mappingSchema } from './declarative.js';
export { declaredProfiles, selectProfile } from './profiles.js';
export { parseRange, satisfies } from './semver.js';
