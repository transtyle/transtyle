/*
 * Everything DS-specific about the Acme demo lives here; every other file in
 * demo/ is identical across examples (spec: docs/specs/demo-app.md).
 */
"use strict";

window.DEMO_DS = {
  key: "acme",
  label: "Acme",
  defaultMode: "light",
  // Web-font loading is demo presentation infra; the families themselves come
  // from the compiled output (see themes/extras.css).
  fontsHref:
    "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;600&display=swap",
  targets: ["bootstrap", "daisyui", "shadcn"],
  themes: {
    bootstrap: ["../expected/bootstrap/bootstrap-theme.css"],
    daisyui: ["themes/daisyui.css", "themes/extras.css"],
    shadcn: ["../dist/shadcn/globals.transtyle.css", "themes/extras.css"],
  },
  daisyTheme: (mode) => `acme-design-system-${mode}`,
  echartsTheme: (mode) => `acme-design-system-${mode}`,
  echartsScript: (mode) => `../dist/echarts/theme.acme-design-system-${mode}.js`,
  // Long form shown in the page chrome bar; short form shown on the hub cards.
  notes: {
    bootstrap:
      "⚠ Bootstrap exporter: specced, not yet implemented — this page loads the engine-exact acceptance fixture (CSS-variable path). Component-baked Sass literals (e.g. .btn-primary backgrounds) deliberately do not retheme; that is the documented lower-fidelity path, not a demo bug.",
    shadcn:
      "shadcn is a React component library; this page renders its token contract with hand-written CSS following the shadcn component recipes (no Radix runtime).",
  },
  statuses: {
    bootstrap: "acceptance fixture — exporter specced, unimplemented",
    shadcn: "hand-CSS recipes, no React runtime",
  },
  compareWith: { label: "Cathode", href: "../../cathode/demo/index.html" },
};
