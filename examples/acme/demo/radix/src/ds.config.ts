// The only per-example file in this demo project (docs/specs/demo-app.md).
export default {
  label: 'Acme',
  defaultMode: 'light' as 'light' | 'dark',
  // The Radix Themes preset this brand's `primary` role overrides (docs/specs/exporters/radix.md).
  accentPreset: 'violet' as const,
  fontsHref:
    'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;600&display=swap',
};
