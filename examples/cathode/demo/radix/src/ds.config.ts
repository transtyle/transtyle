// The only per-example file in this demo project (docs/specs/demo-app.md).
export default {
  label: 'Cathode',
  defaultMode: 'dark' as 'light' | 'dark', // the terminal is native; light is the paper-printout mode
  // The Radix Themes preset this brand's `primary` role overrides (docs/specs/exporters/radix.md).
  accentPreset: 'green' as const,
  fontsHref: 'https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&display=swap',
};
