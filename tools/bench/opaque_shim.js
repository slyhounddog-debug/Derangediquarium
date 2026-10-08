// Runtime experiment: make the main game canvas's 2D context opaque (alpha:false).
(function () {
  const o = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (type, opts) {
    if (type === '2d' && this.id === 'game-canvas') { window.__opaqueApplied = true; opts = Object.assign({}, opts || {}, { alpha: false }); }
    return o.call(this, type, opts);
  };
})();
