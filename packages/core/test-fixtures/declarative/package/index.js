// A declarative package is read, never imported: if this line ever runs, the
// loader executed package code it had no reason to (scripts/check-cli.mjs).
throw new Error('ourlib-transtyle-exporter: package code ran');
