// A composed sample: daisyUI card + shadcn token variables on one canvas.
export default { title: 'Components/Card' };

export const Report = {
  render: () => `
    <div class="card bg-base-200 shadow-sm" style="max-width: 26rem">
      <div class="card-body">
        <h2 class="card-title">Q2 growth report</h2>
        <p style="opacity:.65">Generated 3 minutes ago</p>
        <p>Revenue grew 18% quarter-over-quarter. See the <a class="link link-primary" href="#">full methodology</a>.</p>
        <div class="card-actions justify-end">
          <button class="btn btn-primary btn-sm">Share</button>
          <button class="btn btn-outline btn-sm">Export PDF</button>
        </div>
      </div>
    </div>`,
};
