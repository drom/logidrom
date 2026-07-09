'use strict';

const tspan = require('tspan');
const drawBody = require('./draw_body.js');
const {widther} = require('./tree-utils.js');

const INPUT_SPACING = 16;
const SHAPE_BODY_HALF_H = 10; // legacy fallback; shape gates prefer body[1].h / 2

function drawGate (spec, attrs) { // eslint-disable-line complexity
  const nInputs = spec.length - 2;
  const [gateX, gateY] = spec[1];
  const ret = ['g'];

  // Compute target Y positions for inputs.
  //
  // For non-shape gates (boxes like MUX, generic ops) and for 1–2 input
  // shape gates, we assign evenly spaced rows around gateY (on a 16 px grid)
  // but map them to inputs in order of the inputs' current cy positions.
  // This keeps vertical wire segments monotonic and connects nicely to the
  // small 2-input D-shapes.
  //
  // For variadic shape gates (AND/OR/XOR with 3+ inputs), we keep each input
  // on its original cy row so inputs run straight horizontally into the
  // shared back edge; the back-extension trunk handles out-of-range rows.
  const isShapeGate = drawBody.isShape(spec[0]);
  const targetYs = Array.from({length: nInputs}, () => 0);
  if (nInputs) {
    if (isShapeGate && nInputs > 2) {
      for (let i = 0; i < nInputs; i++) {
        targetYs[i] = spec[2 + i][1];
      }
    } else {
      const baseYs = [];
      for (let r = 0; r < nInputs; r++) {
        baseYs.push(gateY + (r - (nInputs - 1) / 2) * INPUT_SPACING);
      }
      const order = [];
      for (let i = 0; i < nInputs; i++) order.push(i);
      order.sort((a, b) => {
        const ca = spec[2 + a][1];
        const cb = spec[2 + b][1];
        return ca - cb;
      });
      for (let rank = 0; rank < nInputs; rank++) {
        const idx = order[rank];
        targetYs[idx] = baseYs[rank];
      }
    }
  }

  const ymin = nInputs ? Math.min.apply(null, targetYs) : gateY;
  const ymax = nInputs ? Math.max.apply(null, targetYs) : gateY;

  // Render the gate body first so we can derive its width/height from the
  // synthetic attrs that drawBody attaches. The optional `o` attribute on the
  // body metadata is the vertical offset of the output wire relative to the
  // gate anchor; when not present we treat it as 0.
  const body = drawBody(spec[0], ymin - gateY, ymax - gateY, undefined, attrs);
  const bodyHalfL = body[1].w || 0;
  // We intentionally do not use `o` here; it is consumed when building
  // child specs in draw_boxes.js so that outgoing wires from this gate are
  // vertically aligned with the body’s output.

  // Draw the input wires.
  if (nInputs <= 2 || isShapeGate) {
    // Simple two-leg routing is fine for 1- and 2-input gates, and shape
    // gates already get a dedicated back-extension ladder behind the body.
    for (let i = 0; i < nInputs; i++) {
      const [cx, cy, cw] = spec[2 + i];
      const ty = targetYs[i];
      const runLen = gateX - cx - bodyHalfL;
      let d;
      if (cy === ty) {
        d = 'M' + cx + ',' + cy + ' h' + runLen;
      } else {
        const half = runLen / 2;
        d = 'M' + cx + ',' + cy + ' h' + half + ' v' + (ty - cy) + ' h' + half;
      }
      const path = ['path', {d, class: ['wire', widther(cw)]}];
      if (cw > 1) path.push(['title', cw + ' bits']);
      ret.push(path);
    }
  } else {
    // For 3+ input non-shape gates (e.g. nested MUX chains), route input
    // wires with a small local channel router so that no two wires share a
    // point. Each wire is restricted to a simple "HVH" Manhattan path via an
    // intermediate elbow X (per-channel) and its target Y row. We search over
    // channel assignments (up to N channels for N inputs) and pick the
    // minimal number of channels that yields no segment intersections.

    const inputs = [];
    for (let i = 0; i < nInputs; i++) {
      const [cx, cy, cw] = spec[2 + i];
      const ty = targetYs[i];
      inputs.push({cx, cy, cw, ty});
    }
    const backBaseX = gateX - bodyHalfL;
    // const n = inputs.length;

    // upper elbows ans straight lines
    let i = 0;
    for (; i < nInputs; i++) {
      const inp = inputs[i];
      // const ch = channels[i];
      // const elbowX = backBaseX - (ch + 1) * spacing;
      const d = ['M', inp.cx, inp.cy];
      const deltaY = inp.ty - inp.cy;
      if (deltaY < 0) break;
      if (deltaY === 0) {
        d.push('H', backBaseX); // horizontal line
      } else {
        const x = backBaseX - (i + 1) * 8;
        d.push('H', x, 'V', inp.ty, 'H', backBaseX);
      }
      const path = ['path', {d, class: ['wire', widther(inp.cw)]}];
      if (inp.cw > 1) path.push(['title', inp.cw + ' bits']);
      ret.push(path);
    }
    // lower elbows
    for (let j = nInputs - 1; j >= i; j--) {
      const inp = inputs[j];
      const d = ['M', inp.cx, inp.cy];
      const channelIdx = nInputs - 1 - j;
      const x = backBaseX - (channelIdx + 1) * 8;
      d.push('H', x, 'V', inp.ty, 'H', backBaseX);
      const path = ['path', {d, class: ['wire', widther(inp.cw)]}];
      if (inp.cw > 1) path.push(['title', inp.cw + ' bits']);
      ret.push(path);
    }
  }

  // Draw the back extensions for shape gates with 3+ inputs.
  //
  // For variadic shape gates (AND/OR/XOR/...), inputs beyond the natural
  // body span (above the top or below the bottom of the D-shape) need a
  // short vertical extension behind the gate so their wires have somewhere
  // to land. The visual design in docs/rendering.md calls for *at most two*
  // vertical segments on the gate's back edge:
  //   - one from the highest out-of-range input up to the body top
  //   - one from the body bottom down to the lowest out-of-range input
  // Multiple inputs on the same side simply tap into this shared trunk via
  // their horizontal runs; we don't try to give each one its own channel.
  if (nInputs > 2 && isShapeGate) {
    // Derive the body half-height from drawBody's metadata when available so
    // the body is centered on the gate anchor. Fall back to the legacy
    // SHAPE_BODY_HALF_H when needed.
    let bodyHalfH = SHAPE_BODY_HALF_H;
    if (Array.isArray(body) && body.length > 1 && body[1] && typeof body[1] === 'object' && !Array.isArray(body[1])) {
      if (typeof body[1].h === 'number') {
        bodyHalfH = Math.round(body[1].h / 2);
      }
    }
    // Snap to an 8 px grid if possible so top/bottom sit cleanly on the
    // vertical grid used for wires.
    bodyHalfH = Math.round(bodyHalfH / 8) * 8;
    const bodyTop = gateY - bodyHalfH - 4;
    const bodyBottom = gateY + bodyHalfH + 4;
    const backX = gateX - bodyHalfL;

    let topY = Infinity;
    let bottomY = -Infinity;
    for (let i = 0; i < nInputs; i++) {
      const ty = targetYs[i];
      if (ty < bodyTop && ty < topY) topY = ty;
      if (ty > bodyBottom && ty > bottomY) bottomY = ty;
    }

    const parts = [];
    if (topY < Infinity) {
      parts.push('M' + backX + ',' + topY + ' V' + bodyTop);
    }
    if (bottomY > -Infinity) {
      parts.push('M' + backX + ',' + bodyBottom + ' V' + bottomY);
    }
    if (parts.length) {
      ret.push(['path', {class: 'gate', d: parts.join(' ')}]);
    }
  }

  ret.push(['g',
    {transform: 'translate(' + gateX + ',' + gateY + ')'},
    ['title', ...tspan.parse(spec[0])],
    body
  ]);

  return ret;
}

module.exports = drawGate;
