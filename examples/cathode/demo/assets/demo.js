/*
 * Demo-app runtime — theme-asset injection, mode toggle, chart boot.
 * Spec: docs/specs/demo-app.md. This file is IDENTICAL in every example's
 * demo/; everything DS-specific lives in assets/ds.config.js (window.DEMO_DS).
 */
"use strict";

const Demo = {
  target: null,
  ds: null,
  mode: null,
  chart: null,

  boot(target) {
    this.target = target;
    this.ds = window.DEMO_DS;
    const params = new URLSearchParams(location.search);
    this.mode = ["light", "dark"].includes(params.get("mode")) ? params.get("mode") : this.ds.defaultMode;

    const root = document.documentElement;
    root.dataset.demoTarget = target;
    if (params.get("embed") === "1") root.classList.add("demo-embed");

    const head = document.head;
    if (this.ds.fontsHref) {
      const fonts = document.createElement("link");
      fonts.rel = "stylesheet";
      fonts.href = this.ds.fontsHref;
      head.appendChild(fonts);
    }
    for (const href of this.ds.themes[target]) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = href;
      head.appendChild(link); // after the framework CSS <link>s already in <head>
    }
    // Both mode themes self-register; the toggle then only needs dispose + re-init.
    for (const m of ["light", "dark"]) {
      const s = document.createElement("script");
      s.src = this.ds.echartsScript(m);
      head.appendChild(s);
    }

    this.applyMode();
    document.addEventListener("DOMContentLoaded", () => this.wireChrome());
    window.addEventListener("load", () => this.initChart());
  },

  applyMode() {
    const root = document.documentElement;
    if (this.target === "bootstrap") root.setAttribute("data-bs-theme", this.mode);
    else if (this.target === "daisyui") root.setAttribute("data-theme", this.ds.daisyTheme(this.mode));
    else if (this.target === "shadcn") root.classList.toggle("dark", this.mode === "dark");
    const btn = document.getElementById("demo-mode");
    if (btn) btn.textContent = this.mode === "dark" ? "☀ light" : "☾ dark";
  },

  toggleMode() {
    this.mode = this.mode === "dark" ? "light" : "dark";
    this.applyMode();
    const url = new URL(location.href);
    url.searchParams.set("mode", this.mode);
    history.replaceState(null, "", url);
    this.initChart();
  },

  wireChrome() {
    for (const el of document.querySelectorAll(".demo-brand")) {
      el.textContent = `transtyle demo · ${this.ds.label}`;
    }
    const modeBtn = document.getElementById("demo-mode");
    if (modeBtn) modeBtn.addEventListener("click", () => this.toggleMode());

    const nav = document.getElementById("demo-targets");
    if (nav) {
      for (const t of this.ds.targets) {
        const a = document.createElement("a");
        a.textContent = t;
        if (t === this.target) a.className = "active";
        a.href = `${t}.html?mode=${this.mode}`;
        nav.appendChild(a);
      }
    }
    const note = document.getElementById("demo-note");
    if (note && this.ds.notes && this.ds.notes[this.target]) {
      note.textContent = this.ds.notes[this.target];
    }
    this.applyMode(); // refresh toggle label now that the button exists
  },

  chartOption() {
    return {
      tooltip: { trigger: "axis" },
      legend: { data: ["Revenue", "Costs", "Signups"] },
      grid: { left: 48, right: 24, top: 48, bottom: 32 },
      xAxis: { type: "category", data: ["Jan", "Feb", "Mar", "Apr", "May", "Jun"] },
      yAxis: { type: "value" },
      series: [
        { name: "Revenue", type: "bar", data: [42, 51, 48, 63, 71, 84] },
        { name: "Costs", type: "bar", data: [31, 33, 30, 38, 41, 45] },
        { name: "Signups", type: "line", smooth: true, data: [18, 26, 24, 39, 52, 66] },
      ],
    };
  },

  initChart() {
    const el = document.getElementById("demo-chart");
    if (!el || typeof echarts === "undefined") return;
    if (this.chart) {
      this.chart.dispose();
      this.chart = null;
    }
    this.chart = echarts.init(el, this.ds.echartsTheme(this.mode));
    this.chart.setOption(this.chartOption());
    if (!this._chartResizeWired) {
      window.addEventListener("resize", () => this.chart && this.chart.resize());
      this._chartResizeWired = true;
    }
  },
};
