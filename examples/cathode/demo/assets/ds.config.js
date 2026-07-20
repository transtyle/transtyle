/*
 * Everything DS-specific about the Cathode demo lives here; every other file in
 * demo/ is identical across examples (spec: docs/specs/demo-app.md).
 * No bootstrap target: the exporter is unimplemented and Cathode has no
 * acceptance fixture, so there is no compiled artifact to render.
 */
"use strict";

window.DEMO_DS = {
  key: "cathode",
  label: "Cathode",
  defaultMode: "dark", // the terminal is native; light is the paper-printout mode
  // Web-font loading is demo presentation infra; the families themselves come
  // from the compiled output (see themes/extras.css).
  fontsHref:
    "https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&display=swap",
  targets: ["daisyui", "shadcn"],
  themes: {
    daisyui: ["themes/daisyui.css", "themes/extras.css"],
    shadcn: ["../dist/shadcn/globals.transtyle.css", "themes/extras.css"],
  },
  daisyTheme: (mode) => `cathode-terminal-${mode}`,
  echartsTheme: (mode) => `cathode-terminal-${mode}`,
  echartsScript: (mode) => `../dist/echarts/theme.cathode-terminal-${mode}.js`,
  notes: {
    shadcn:
      "shadcn is a React component library; this page renders its token contract with hand-written CSS following the shadcn component recipes (no Radix runtime).",
  },
  statuses: {
    shadcn: "hand-CSS recipes, no React runtime",
  },
  compareWith: { label: "Acme", href: "../../acme/demo/index.html" },
};
