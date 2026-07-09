'use strict';

const tspan = require('tspan');

const drawGate = require('./draw_gate.js');
const drawBody = require('./draw_body.js');
const {getLabelWidth, CHAR_WIDTH_PX} = require('./font-metrics.js');
const {firstChildIdx, getAttrs, getWidth, widther, leafDisplay, outDisplay, outTooltip, inlineDisplay, isPinOp, pinLabel, pinLabels} = require('./tree-utils.js');

const LEAF_PAD_X = 4;
const LEAF_HALF_H = 8;
const INLINE_MIN_BOX_W = 32;
const OUT_MIN_BOX_W = 32;
const MIN_PASSTHRU_PX = 48;

// Raw text width in px (no padding, no grid alignment) — used for port-shape
// path geometry where labels sit inside chevron/arc-bounded sections.
const textWidth = (s, fontWidth) =>
  Math.ceil(String(s || '').length * (fontWidth || CHAR_WIDTH_PX));

// Port-shape geometry: pin/pout/pinout (two-section) and dir-attributed
// `=` cones / leaves (one-section with chevron edge encoding direction).
function portBoxWidth (gwInst, gwPin) {
  // pin/pout/pinout total span: 8 + gwInst + 8 + gwPin + 8 (chevron+pad+gap+chevron+pad).
  return gwInst + gwPin + 24;
}

function dirInBoxWidth (gw) {
  return gw + 14;
}

function dirOutBoxWidth (gw) {
  return gw + 16;
}

// pin shape, port (right) section — square `]` right edge.
function pinPortPathD (gwPin) {
  return [
    'm', -gwPin - 14, -8,
    'l', 6, 8, 'l', -6, 8,
    'h', gwPin + 14,
    'v', -16,
    'z'
  ];
}

// pin shape, instance (left) section — rounded `(` left edge.
function pinBindPathD (gwInst, gwPin) {
  return [
    'm', -gwPin - 16, -8,
    'l', 6, 8, 'l', -6, 8,
    'h', -gwInst,
    'a', 8, 8, 0, 1, 1, 0, -16,
    'z'
  ];
}

// pout shape, instance (right) section — rounded `)` right edge,
// arc apex at anchor x=0.
function poutBindPathD (gwInst) {
  return [
    'm', -gwInst - 14, -8,
    'l', 6, 8, 'l', -6, 8,
    'h', gwInst + 6,
    'a', 8, 8, 0, 1, 0, 0, -16,
    'z'
  ];
}

// pout shape, port (left) section — square `[` left edge.
function poutPortPathD (gwInst, gwPin) {
  return [
    'm', -gwInst - 16, -8,
    'l', 6, 8, 'l', -6, 8,
    'h', -gwPin - 8,
    'v', -16,
    'z'
  ];
}

function dirInPathD (gw) {
  return [
    'm', -gw - 14, -8,
    'l', 6, 8, 'l', -6, 8,
    'h', gw + 14,
    'v', -16,
    'z'
  ];
}

function dirOutPathD (gw) {
  return [
    'm', -6, 8,
    'l', 6, -8, 'l', -6, -8,
    'h', -gw - 10,
    'v', 16,
    'z'
  ];
}

// Propagate navigation metadata onto a port-shape group (mirrors the leaf /
// inline-box paths in this file).
function applyNavAttrs (groupAttrs, attrs) {
  if (!attrs) return;
  if (attrs.nodeId || attrs.siteKey) {
    groupAttrs.class = (groupAttrs.class ? groupAttrs.class + ' ' : '') + 'rtl-node';
    if (attrs.nodeId) groupAttrs['data-node-id'] = attrs.nodeId;
    if (attrs.siteKey) groupAttrs['data-site-key'] = attrs.siteKey;
    if (attrs.module) groupAttrs['data-module'] = attrs.module;
    if (attrs.name) groupAttrs['data-name'] = attrs.name;
    if (attrs.loc) groupAttrs['data-loc'] = attrs.loc;
  }
}

// Render a two-section port shape (pin / pout / pinout). Anchor (fx, fy)
// sits at the shape's right edge; shape extends leftward by boxW.
function drawPortBox (tree, fx, fy, fontWidth) {
  const op = tree[0].name;
  const attrs = getAttrs(tree) || {};
  const labels = pinLabels(op, attrs);
  const gwInst = textWidth(labels.instance, fontWidth);
  const gwPin = textWidth(labels.pin, fontWidth);
  const tooltip = pinLabel(op, attrs) || '';

  // pinout falls back to pin shape (rounded-left + square-right).
  const isPout = (op === 'pout');
  const portD = isPout ? poutPortPathD(gwInst, gwPin) : pinPortPathD(gwPin);
  const bindD = isPout ? poutBindPathD(gwInst)        : pinBindPathD(gwInst, gwPin);

  // Label x positions: center of each section's rect-bbox (top/bottom span).
  let xLabelInst, xLabelPin;
  if (isPout) {
    // inst section sits on right: rect-bbox x ∈ [-(gwInst+14), -8]
    xLabelInst = -Math.round((gwInst + 10) / 2);
    // port section sits on left: rect-bbox x ∈ [-(gwInst+gwPin+24), -(gwInst+16)]
    xLabelPin = -Math.round((2 * gwInst + gwPin + 40) / 2);
  } else {
    // pin / pinout: inst on left, port on right.
    // port section rect-bbox x ∈ [-(gwPin+14), 0]
    xLabelPin = -Math.round((gwPin + 10) / 2);
    // inst section rect-bbox x ∈ [-(gwPin+gwInst+16), -(gwPin+16)]
    xLabelInst = -Math.round((2 * gwPin + gwInst + 32) / 2);
  }

  const groupAttrs = {transform: 'translate(' + fx + ',' + fy + ')'};
  applyNavAttrs(groupAttrs, attrs);

  return ['g', groupAttrs,
    ['title', ...tspan.parse(tooltip)],
    ['path', {class: 'port', d: portD}],
    ['path', {class: 'bind', d: bindD}],
    ['text', {x: xLabelInst, y: 4, class: 'bodylabel'}, ...tspan.parse(labels.instance)],
    ['text', {x: xLabelPin,  y: 4, class: 'bodylabel'}, ...tspan.parse(labels.pin)]
  ];
}

// One-section port shape for dir:in (chevron-left, square-right).
// Anchor (fx, fy) at shape's right edge.
function drawDirInBox (label, attrs, fx, fy, fontWidth) {
  const gw = textWidth(label, fontWidth);
  const d = dirInPathD(gw);
  const xLabel = -Math.round((gw + 10) / 2);

  const groupAttrs = {transform: 'translate(' + fx + ',' + fy + ')'};
  applyNavAttrs(groupAttrs, attrs);

  return ['g', groupAttrs,
    ['title', ...tspan.parse(label)],
    ['path', {class: 'port', d: d}],
    ['text', {x: xLabel, y: 4, class: 'bodylabel'}, ...tspan.parse(label)]
  ];
}

// One-section port shape for dir:out (square-left, chevron-right).
// Anchor (fx, fy) at shape's right edge (chevron tip = boundary).
function drawDirOutBox (label, attrs, fx, fy, fontWidth) {
  const gw = textWidth(label, fontWidth);
  const d = dirOutPathD(gw);
  const xLabel = -Math.round((gw + 20) / 2);

  const groupAttrs = {transform: 'translate(' + fx + ',' + fy + ')'};
  applyNavAttrs(groupAttrs, attrs);

  return ['g', groupAttrs,
    ['title', ...tspan.parse(label)],
    ['path', {class: 'port', d: d}],
    ['text', {x: xLabel, y: 4, class: 'bodylabel'}, ...tspan.parse(label)]
  ];
}

function leafNodeOf (branch) {
  return Array.isArray(branch) ? branch[0] : branch;
}

function drawLeaf (branch, fontWidth) {
  const node = leafNodeOf(branch);
  const displayName = leafDisplay(branch);
  const fx = node.fx;
  const fy = node.fy;
  const attrs = getAttrs(branch) || {};

  // pin/pout/pinout leaf cones (no body) — render the two-section port shape
  // composed from attrs.instance and attrs.pin. Use the same renderer as the
  // cone form; it works on the tree directly.
  if (Array.isArray(branch) && isPinOp(node.name)) {
    return drawPortBox(branch, fx, fy, fontWidth);
  }

  // dir-attributed input leaf: render as port-shape (chevron-left, square-right)
  // instead of a plain siglabel rect. Direction is encoded by shape geometry.
  if (attrs.dir === 'in') {
    return drawDirInBox(displayName, attrs, fx, fy, fontWidth);
  }

  const boxW = getLabelWidth(displayName, fontWidth) + 2 * LEAF_PAD_X;

  const groupAttrs = {transform: 'translate(' + fx + ',' + fy + ')'};
  if (attrs.nodeId || attrs.siteKey) {
    groupAttrs.class = 'rtl-node';
    if (attrs.nodeId) groupAttrs['data-node-id'] = attrs.nodeId;
    if (attrs.siteKey) groupAttrs['data-site-key'] = attrs.siteKey;
    if (attrs.module) groupAttrs['data-module'] = attrs.module;
    if (attrs.name) groupAttrs['data-name'] = attrs.name;
    if (attrs.loc) groupAttrs['data-loc'] = attrs.loc;
  }

  return ['g', groupAttrs,
    ['title', ...tspan.parse(node.name)],
    ['rect', {
      class: 'siglabel',
      x: -boxW,
      y: -LEAF_HALF_H,
      width: boxW,
      height: 2 * LEAF_HALF_H
    }],
    ['text', {x: -LEAF_PAD_X, y: 4, class: 'pinname'}, ...tspan.parse(displayName)]
  ];
}

function outBoxWidth (displayName, fontWidth) {
  return Math.max(getLabelWidth(displayName, fontWidth) + 2 * LEAF_PAD_X, OUT_MIN_BOX_W);
}

function drawOutLabel (tree, fx, fy, fontWidth) {
  const displayName = outDisplay(tree);
  const tooltip = outTooltip(tree);
  const boxW = outBoxWidth(displayName, fontWidth);

  // If the assignment cone carries metadata (nodeId, module, name, loc)
  // via attrsFromInfo → attrs.nodeId, expose it on the output label group
  // so downstream tools (e.g. VSCode rtlviz webview) can hook into it.
  const attrs = getAttrs(tree) || {};
  const groupAttrs = { transform: 'translate(' + fx + ',' + fy + ')' };
  if (attrs.nodeId) {
    groupAttrs.class = 'rtl-node';
    groupAttrs['data-node-id'] = attrs.nodeId;
    if (attrs.module) groupAttrs['data-module'] = attrs.module;
    if (attrs.name) groupAttrs['data-name'] = attrs.name;
    if (attrs.loc) groupAttrs['data-loc'] = attrs.loc;
  }

  const group = ['g', groupAttrs,
    ['title', ...tspan.parse(tooltip)],
    ['rect', {
      class: 'siglabel',
      x: 0,
      y: -LEAF_HALF_H,
      width: boxW,
      height: 2 * LEAF_HALF_H
    }]
  ];
  if (displayName) {
    group.push(['text', {x: LEAF_PAD_X, y: 4, class: 'wirename'}, ...tspan.parse(displayName)]);
  }
  return group;
}

function inlineBoxWidth (visibleName, fontWidth) {
  // For mid-tree '=' with an invisible LHS name, render a compact 16×16
  // square box instead of the full 32 px minimum used for named temps. This
  // keeps placeholder boxes small while still reserving a clear tap point.
  if (!visibleName) return 16;
  return Math.max(getLabelWidth(visibleName, fontWidth) + 2 * LEAF_PAD_X, INLINE_MIN_BOX_W);
}

function drawInlineBox (tree, fx, fy, fontWidth) {
  const attrs = getAttrs(tree) || {};
  const start = firstChildIdx(tree);
  const nameBranch = tree[start];
  const node = leafNodeOf(nameBranch);
  const visibleName = (node && node.name) || '';
  const displayName = inlineDisplay(tree);
  const tooltip = attrs.label || visibleName;
  const boxW = inlineBoxWidth(displayName, fontWidth);

  // If this inline assignment cone carries navigation metadata (nodeId,
  // module, name, loc), expose it on the inline box group so that internal
  // temps like "_foo" become clickable in the schematic just like top-level
  // outputs.
  const groupAttrs = { transform: 'translate(' + fx + ',' + fy + ')' };
  if (attrs.nodeId) {
    groupAttrs.class = 'rtl-node';
    groupAttrs['data-node-id'] = attrs.nodeId;
    if (attrs.module) groupAttrs['data-module'] = attrs.module;
    if (attrs.name) groupAttrs['data-name'] = attrs.name;
    if (attrs.loc) groupAttrs['data-loc'] = attrs.loc;
  }

  const group = ['g', groupAttrs,
    ['title', ...tspan.parse(tooltip)],
    ['rect', {
      class: 'siglabel',
      x: -boxW,
      y: -LEAF_HALF_H,
      width: boxW,
      height: 2 * LEAF_HALF_H
    }]
  ];
  if (displayName) {
    group.push(['text', {x: -boxW / 2, y: 4, class: 'bodylabel'}, ...tspan.parse(displayName)]);
  }
  return group;
}

// Shift the fx coordinate of every layout node in a subtree by `delta`.
// Used to give extra horizontal room for wide inline '=' labels without
// affecting sibling branches that share the same logical column.
function shiftFxSubtree (branch, delta) {
  if (!branch) return;
  if (Array.isArray(branch)) {
    const node = leafNodeOf(branch);
    if (node && typeof node.fx === 'number') node.fx -= delta;
    const start = firstChildIdx(branch);
    const ilen = branch.length;
    for (let i = start; i < ilen; i++) {
      shiftFxSubtree(branch[i], delta);
    }
  } else if (typeof branch === 'object') {
    if (typeof branch.fx === 'number') branch.fx -= delta;
  }
}

function childSpec (branch, fontWidth) {
  // Special case: an assignment (`=`) or pin/pout/pinout cone used as an
  // expression. Its visual "output" is the shape drawn by drawAssign, which
  // sits at the driver's output wire (including any body `o` offset) — not the
  // operator's own anchor. We keep the X at the operator node's fx so wiring
  // stays consistent, but take Y from the expression branch so a parent gate
  // connects flush with the shape's edge. Mirrors the exprBranch selection in
  // drawAssign (pin ops have no name slot, so the body sits at `start`).
  if (Array.isArray(branch) && branch[0]) {
    const op = branch[0].name;
    const start = firstChildIdx(branch);
    const isEq = op === '=' && branch.length > start + 1;
    const isPin = isPinOp(op) && branch.length > start;
    if (isEq || isPin) {
      const exprBranch = isPin ? branch[start] : branch[start + 1];
      const [, exprFy] = childSpec(exprBranch, fontWidth);
      const node = leafNodeOf(branch);
      return [node.fx, exprFy, getWidth(branch)];
    }
  }

  const node = leafNodeOf(branch);
  let fx = node.fx;
  let fy = node.fy;
  // If the branch is driven by a gate body that exposes an output offset
  // `o`, use that to adjust the vertical position of the wire coming out of
  // the gate. When `o` is absent we treat it as 0.
  if (node && typeof node.name === 'string') {
    const body = drawBody(node.name, 0, 0, fontWidth);
    const o = body[1].o;
    fy += o || 0;
  }
  return [fx, fy, getWidth(branch)];
}

function drawAssign (tree, xmax, start, isRoot, fontWidth) {
  const op = tree[0].name;
  const pinOp = isPinOp(op);
  const attrs = getAttrs(tree) || {};
  const dir = attrs.dir;
  const gateFx = tree[0].fx;
  // pin/pout/pinout cones have no name slot — labels are composed from attrs
  // (see pinLabels in tree-utils). Body is at `start`, not `start + 1`.
  const nameBranch = pinOp ? null : tree[start];
  const exprBranch = pinOp ? tree[start] : tree[start + 1];
  let [exprFx, exprFy] = childSpec(exprBranch, fontWidth);
  const exprW = getWidth(exprBranch);

  // Determine the shape that will sit at gateFx (mid-tree) or at gateFx+boxW
  // (root). boxW is the horizontal extent the shape occupies.
  let boxW = 0;
  let shapeKind;
  if (pinOp) {
    const labels = pinLabels(op, attrs);
    boxW = portBoxWidth(
      textWidth(labels.instance, fontWidth),
      textWidth(labels.pin, fontWidth)
    );
    shapeKind = 'port';
  } else if (dir === 'out') {
    boxW = dirOutBoxWidth(textWidth(outDisplay(tree), fontWidth));
    shapeKind = 'dir-out';
  } else if (dir === 'in') {
    boxW = dirInBoxWidth(textWidth(outDisplay(tree), fontWidth));
    shapeKind = 'dir-in';
  } else if (!isRoot) {
    const node = leafNodeOf(nameBranch);
    const visibleName = (node && node.name) || '';
    boxW = inlineBoxWidth(visibleName, fontWidth);
    shapeKind = 'inline';
  } else {
    // plain `=` root: drawOutLabel sits right of gateFx (its own boxW handled
    // separately by render-assign rightPad).
    shapeKind = 'out';
  }

  // Mid-tree: ensure the shape + MIN_PASSTHRU fits between driver and gateFx.
  // Root: shape sits to the right of gateFx, so only the passthru length
  // matters (no boxW shift needed here).
  if (!isRoot && boxW > 0) {
    const gap = gateFx - exprFx;
    const need = boxW + MIN_PASSTHRU_PX - gap;
    if (need > 0) {
      shiftFxSubtree(exprBranch, need);
      [exprFx, exprFy] = childSpec(exprBranch, fontWidth);
    }
  }

  const ret = ['g'];

  // Shape sits at the driver's actual output y (exprFy), which already
  // includes any body `o` offset (e.g. MUX/ff with o=-8). Because every body
  // offset is a multiple of the 8 px vertical grid, exprFy stays grid-aligned,
  // so the passthru wire runs straight into the shape instead of doing a Z
  // bend. This also keeps the shape's edge on the same row that childSpec
  // reports for this cone, so a parent gate wiring into it connects flush
  // (no discontinuity between chained DFFs).
  const shapeFy = exprFy;

  // Driver passthru ends at the shape's left edge. exprFy === shapeFy here, so
  // the wire is straight; the bend branch is retained only as a guard for any
  // future case where the driver row and shape row diverge for other reasons.
  const passthruEndX = isRoot ? gateFx : (gateFx - boxW);
  let passthruD;
  if (exprFy === shapeFy) {
    passthruD = 'M' + exprFx + ',' + exprFy + ' H' + passthruEndX;
  } else {
    const half = (passthruEndX - exprFx) / 2;
    passthruD = 'M' + exprFx + ',' + exprFy +
      ' h' + half + ' v' + (shapeFy - exprFy) + ' h' + half;
  }
  const passthru = ['path', {
    d: passthruD,
    class: ['wire', widther(exprW)]
  }];
  if (exprW > 1) passthru.push(['title', exprW + ' bits']);
  ret.push(passthru);
  ret.push(drawBoxes(exprBranch, xmax, false, fontWidth));

  // Shape anchor: right edge of shape. Mid-tree → gateFx; root → gateFx+boxW.
  const shapeAnchorX = isRoot ? (gateFx + boxW) : gateFx;
  ret.push(drawShape(shapeKind, tree, attrs, shapeAnchorX, gateFx, shapeFy, fontWidth));
  return ret;
}

function drawShape (shapeKind, tree, attrs, shapeAnchorX, gateFx, shapeFy, fontWidth) {
  switch (shapeKind) {
  case 'port':
    return drawPortBox(tree, shapeAnchorX, shapeFy, fontWidth);
  case 'dir-out':
    return drawDirOutBox(outDisplay(tree), attrs, shapeAnchorX, shapeFy, fontWidth);
  case 'dir-in':
    return drawDirInBox(outDisplay(tree), attrs, shapeAnchorX, shapeFy, fontWidth);
  case 'inline':
    return drawInlineBox(tree, gateFx, shapeFy, fontWidth);
  default:
    return drawOutLabel(tree, gateFx, shapeFy, fontWidth);
  }
}

let drawBoxesCallCount = 0;
const MAX_DRAWBOXES_CALLS = 1000000;

function resetDrawBoxesCallCount() {
  drawBoxesCallCount = 0;
}

function drawBoxes (tree, xmax, isRoot, fontWidth) {
  drawBoxesCallCount++;
  if (drawBoxesCallCount > MAX_DRAWBOXES_CALLS) {
    if (typeof console !== 'undefined' && console.error) {
      console.error('drawBoxes exceeded ' + MAX_DRAWBOXES_CALLS + ' calls - possible infinite loop');
    }
    throw new Error('drawBoxes exceeded ' + MAX_DRAWBOXES_CALLS + ' calls');
  }

  if (Array.isArray(tree)) {
    const start = firstChildIdx(tree);
    const ilen = tree.length;
    if (ilen === start) {
      return ['g', drawLeaf(tree, fontWidth)];
    }
    if (tree[0].name === '=' && ilen > start + 1) {
      return drawAssign(tree, xmax, start, isRoot, fontWidth);
    }
    if (isPinOp(tree[0].name) && ilen > start) {
      // pin / pout / pinout cones — render as an assignment-shaped cone
      // with the composed "<inst>.<pin>" port shape. Honors actual isRoot
      // so mid-tree pin ops sit between driver and consumer instead of
      // forcing a root-anchored layout.
      return drawAssign(tree, xmax, start, isRoot, fontWidth);
    }

    const spec = [];
    spec.push(tree[0].name);
    spec.push([tree[0].fx, tree[0].fy, getWidth(tree)]);

    for (let i = start; i < ilen; i++) {
      spec.push(childSpec(tree[i], fontWidth));
    }

    const ret = ['g', drawGate(spec, getAttrs(tree))];
    for (let i = start; i < ilen; i++) {
      ret.push(drawBoxes(tree[i], xmax, false, fontWidth));
    }
    return ret;
  }

  return ['g', drawLeaf(tree, fontWidth)];
}

module.exports = drawBoxes;
module.exports.resetCallCount = resetDrawBoxesCallCount;
module.exports.portBoxWidth = portBoxWidth;
module.exports.dirInBoxWidth = dirInBoxWidth;
module.exports.dirOutBoxWidth = dirOutBoxWidth;
module.exports.textWidth = textWidth;
