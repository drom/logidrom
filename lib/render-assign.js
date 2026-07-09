'use strict';

const render = require('./render.js');
const drawBoxes = require('./draw_boxes.js');
const drawBody = require('./draw_body.js');
const insertSVGTemplateAssign = require('./insert-svg-template-assign.js');
const {getLabelWidth} = require('./font-metrics.js');
const {firstChildIdx, getAttrs, leafDisplay, outDisplay, inlineDisplay, isPinOp, pinLabels} = require('./tree-utils.js');

const {portBoxWidth, dirInBoxWidth, dirOutBoxWidth, textWidth} = drawBoxes;

const grid = 32;
const ceilGrid = n => grid * Math.ceil(n / grid);

const BOX_PAD_X = 4;
const MIN_BOX_W = 32;
// Must match MIN_PASSTHRU_PX in draw_boxes.js — minimum wire segment between
// a driver and the inline '=' label.
const MIN_PASSTHRU_PX = 48;

const boxW = (visible, fontWidth) => Math.max(getLabelWidth(visible, fontWidth) + 2 * BOX_PAD_X, MIN_BOX_W);
const outBoxW = (tree, fontWidth) => boxW(outDisplay(tree), fontWidth);

// Leaf rect: drawn from `-leafBoxW` to `0` relative to fx (no minimum).
// Matches drawLeaf in draw_boxes.js.
const leafBoxW = (visible, fontWidth) => getLabelWidth(visible, fontWidth) + 2 * BOX_PAD_X;

// Inline '=' box: 16 px when the name is empty, otherwise padded label with
// MIN_BOX_W floor. Matches inlineBoxWidth in draw_boxes.js.
const inlineBoxW = (visible, fontWidth) => (visible ? boxW(visible, fontWidth) : 16);

const leafNodeOf = branch => (Array.isArray(branch) ? branch[0] : branch);

// Get the rendered gate body size for a given operator name by delegating to
// drawBody and reading the synthetic width/height attributes it attaches.
// This reflects the actual drawing geometry instead of the older
// drawBody.leftExtent() heuristic.
const gateSize = (type, fontWidth, attrs) => {
  const body = drawBody(type, 0, 0, fontWidth, attrs);
  return {
    w: body[1].w || 0,
    h: body[1].h || 0
  };
};

// Width helpers for `=` cones and pin/pout/pinout cones, picking the right
// shape (plain inline/out vs. dir-attributed chevron vs. two-section port).
const eqBoxW = (node, fontWidth, midTree) => {
  const attrs = getAttrs(node) || {};
  if (attrs.dir === 'out') return dirOutBoxWidth(textWidth(outDisplay(node), fontWidth));
  if (attrs.dir === 'in')  return dirInBoxWidth(textWidth(outDisplay(node), fontWidth));
  return midTree
    ? inlineBoxW(inlineDisplay(node), fontWidth)
    : outBoxW(node, fontWidth);
};

const portBoxW = (node, fontWidth) => {
  const attrs = getAttrs(node) || {};
  const labels = pinLabels(node[0].name, attrs);
  return portBoxWidth(
    textWidth(labels.instance, fontWidth),
    textWidth(labels.pin, fontWidth)
  );
};

// Width contribution of a leaf-cone. pin/pout/pinout leaves use the
// two-section port shape; dir-in leaves use the chevron port shape; everything
// else uses the plain leaf rect.
const leafConeW = (node, fontWidth) => {
  const op = node[0] && node[0].name;
  if (isPinOp(op)) return portBoxW(node, fontWidth);
  const attrs = getAttrs(node);
  if (attrs && attrs.dir === 'in') {
    return dirInBoxWidth(textWidth(leafDisplay(node), fontWidth));
  }
  return leafBoxW(leafDisplay(node), fontWidth);
};

// Walk the tree (after fx is assigned) to measure:
//   acc.left   — max leftward reach of any drawn element relative to fx=0.
//   acc.root   — max boxW across top-level cones (for rightPad).
const measureExtents = (node, acc, isRoot, fontWidth) => {
  if (!Array.isArray(node)) {
    const fx = (node && typeof node.fx === 'number') ? node.fx : 0;
    acc.left = Math.max(acc.left, leafBoxW(leafDisplay(node), fontWidth) - fx);
    return;
  }
  const start = firstChildIdx(node);
  const ilen = node.length;
  if (ilen === start) {
    const fx = node[0].fx || 0;
    acc.left = Math.max(acc.left, leafConeW(node, fontWidth) - fx);
    return;
  }
  if (node[0].name === '=' && ilen > start + 1) {
    if (isRoot) {
      acc.root = Math.max(acc.root, eqBoxW(node, fontWidth, false));
    } else {
      const fx = node[0].fx || 0;
      acc.left = Math.max(acc.left, eqBoxW(node, fontWidth, true) - fx);
    }
    measureExtents(node[start + 1], acc, false, fontWidth);
    return;
  }
  // pin / pout / pinout: two-section port shape.
  if (isPinOp(node[0].name) && ilen > start) {
    const w = portBoxW(node, fontWidth);
    if (isRoot) {
      acc.root = Math.max(acc.root, w);
    } else {
      const fx = node[0].fx || 0;
      acc.left = Math.max(acc.left, w - fx);
    }
    measureExtents(node[start], acc, false, fontWidth);
    return;
  }
  for (let i = start; i < ilen; i++) {
    measureExtents(node[i], acc, false, fontWidth);
  }
};

// count number of channels required for the gate
const getNumChannels = (node) => {
  let downward = 0;
  let upward = 0;
  const y = node[0].y; // self
  const start = firstChildIdx(node);
  const ilen = node.length;
  for (let i = start; i < ilen; i++) {
    const child = node[i];
    if (!Array.isArray(child)) continue;
    // real gate input position
    const inputYdx = y + ((i - start) - (ilen - start - 1) / 2) * 2;
    if (child[0].y > inputYdx) {
      downward++;
    } else if (child[0].y < inputYdx) {
      upward++;
    }
  }
  const nChannels = Math.max(downward, upward);
  return nChannels;
};

const collectSlacks = (node, slacks, fontWidth) => {
  if (!Array.isArray(node)) return;
  const start = firstChildIdx(node);
  const ilen = node.length;
  const nChildren = ilen - start;
  if (nChildren > 0) {
    const name = node[0].name;
    if (name === '=') {
      // Mid-tree '=' inline-box room is handled per-branch by shiftInlineExpr
      // below, not column-wide slack. Feeding inline width into the per-column
      // slack would widen every '=' sharing that column to the max need and
      // bloat wires in unrelated sibling subcones. Still recurse into the
      // expression subtree so its internal gates contribute slack as usual.
      if (nChildren > 1) collectSlacks(node[start + 1], slacks, fontWidth);
      return;
    }
    if (isPinOp(name)) {
      // pin / pout / pinout behave like '=' for slack purposes — no
      // column-wide slack contribution, but recurse into the body expression.
      if (nChildren > 0) collectSlacks(node[start], slacks, fontWidth);
      return;
    }
    const {w} = gateSize(name, fontWidth, getAttrs(node));
    // account for wire routing for nonShape gates

    const routingSpace = drawBody.isShape(name) ? 0 : getNumChannels(node) * 8;

    const extra = w + routingSpace - ((grid + 1) >> 1);
    if (extra > 0) {
      const col = node[0].x;
      slacks[col] = Math.max(slacks[col] || 0, extra);
    }
  }
  for (let i = start; i < ilen; i++) {
    collectSlacks(node[i], slacks, fontWidth);
  }
};

// Shift the fx of every layout node in a subtree by `delta` (to the left).
// Used to give extra horizontal room for a specific mid-tree '=' inline box
// without disturbing sibling branches that share the same logical column.
const shiftFxSubtree = (branch, delta) => {
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
};

// For each mid-tree port-shape (=, pin/pout/pinout), ensure the gap between
// driver and shape is at least boxW + MIN_PASSTHRU_PX. Shifts only the
// expression subtree of that node so unrelated sibling cones are unaffected.
// Run after assignFx so it operates on final fx values; must run before
// measureExtents so the measurement sees the shifted positions.
const shiftInlineExprs = (node, isRoot, fontWidth) => {
  if (!Array.isArray(node)) return;
  const start = firstChildIdx(node);
  const ilen = node.length;
  const op = node[0].name;
  if (op === '=' && ilen > start + 1) {
    if (!isRoot) {
      const exprBranch = node[start + 1];
      const exprNode = leafNodeOf(exprBranch);
      const gap = node[0].fx - exprNode.fx;
      const need = eqBoxW(node, fontWidth, true) + MIN_PASSTHRU_PX - gap;
      if (need > 0) {
        shiftFxSubtree(exprBranch, need);
      }
    }
    shiftInlineExprs(node[start + 1], false, fontWidth);
    return;
  }
  if (isPinOp(op) && ilen > start) {
    if (!isRoot) {
      const exprBranch = node[start];
      const exprNode = leafNodeOf(exprBranch);
      const gap = node[0].fx - exprNode.fx;
      const need = portBoxW(node, fontWidth) + MIN_PASSTHRU_PX - gap;
      if (need > 0) {
        shiftFxSubtree(exprBranch, need);
      }
    }
    shiftInlineExprs(node[start], false, fontWidth);
    return;
  }
  for (let i = start; i < ilen; i++) {
    shiftInlineExprs(node[i], false, fontWidth);
  }
};

const computeTrailing = (slacks, xmax) => {
  const trailing = Array.from({length: xmax + 1}, () => 0);
  for (let x = xmax - 1; x >= 0; x--) {
    trailing[x] = trailing[x + 1] + (slacks[x] || 0);
  }
  return trailing;
};

const pixelFx = (x, xmax, trailing) => 32 * (xmax - x) + (trailing[x] || 0);

const setNodeFxFy = (layoutNode, xmax, trailing) => {
  layoutNode.fx = pixelFx(layoutNode.x, xmax, trailing);
  layoutNode.fy = 8 * layoutNode.y;
};

const assignFx = (node, xmax, trailing) => {
  if (!Array.isArray(node)) {
    setNodeFxFy(node, xmax, trailing);
    return;
  }
  const start = firstChildIdx(node);
  const ilen = node.length;
  setNodeFxFy(node[0], xmax, trailing);
  if (node[0].name === '=' && ilen > start + 1) {
    const nameBranch = node[start];
    const nameNode = Array.isArray(nameBranch) ? nameBranch[0] : nameBranch;
    setNodeFxFy(nameNode, xmax, trailing);
    assignFx(node[start + 1], xmax, trailing);
    return;
  }
  for (let i = start; i < ilen; i++) {
    assignFx(node[i], xmax, trailing);
  }
};

function renderAssign (index, source) {
  // Reset the drawBoxes call counter for this rendering pass
  // const drawBoxes = require('./draw_boxes.js');
  if (drawBoxes.resetCallCount) drawBoxes.resetCallCount();

  let state = {x: 0, y: 2, xmax: 0};
  const tree = source.assign;
  const config = source.config || {};
  const fontWidth = config.fontWidth || 7.23; // px
  const treeSpacing = config.treeSpacing || 16; // px
  const ilen = tree.length;
  // Convert treeSpacing (in pixels) to logical y units (8 px per unit)
  const treeSpacingY = Math.round(treeSpacing / 8);
  for (let i = 0; i < ilen; i++) {
    state = render(tree[i], state);
    state.x++;
    // Add extra vertical spacing between trees (but not after the last tree)
    if (i < ilen - 1) {
      state.y += treeSpacingY;
    }
  }
  const xmax = state.xmax;

  // Per-cone slack: compute a separate trailing[] array for each top-level
  // tree instead of sharing one across the whole forest. This decouples the
  // horizontal layout of different cones so that a wide gate or inline label
  // in one assignment does not shift every other cone that happens to use the
  // same column index.
  const trailings = Array.from({length: ilen}, () => 0);
  let totalSlack = 0;
  for (let i = 0; i < ilen; i++) {
    const slacks = [];
    collectSlacks(tree[i], slacks, fontWidth);
    const trailing = computeTrailing(slacks, xmax);
    trailings[i] = trailing;
    const coneSlack = trailing[0] || 0;
    if (coneSlack > totalSlack) totalSlack = coneSlack;
  }
  // Assign fx/fy first, then measure extents using the final positions. This
  // lets measureExtents see any horizontal adjustments from per-cone slack
  // (inline '=' boxes, gate routing) instead of guessing worst cases.
  const acc = {left: 0, root: 0};
  for (let i = 0; i < ilen; i++) {
    assignFx(tree[i], xmax, trailings[i]);
    shiftInlineExprs(tree[i], true, fontWidth);
    measureExtents(tree[i], acc, true, fontWidth);
  }
  const leftPad = ceilGrid(Math.max(0, acc.left));
  const rightPad = ceilGrid(Math.max(0, acc.root - (grid + 1)));

  const svg = ['g'];
  for (let i = 0; i < ilen; i++) {
    svg.push(drawBoxes(tree[i], xmax, true, fontWidth));
  }
  const width  = leftPad + 32 * (xmax + 1) + 1 + rightPad + totalSlack;
  const height = 8 * (state.y + 1) - 7;

  return ['svg', {
    id: 'svgcontent_' + index,
    viewBox: '0 0 ' + width + ' ' + height,
    width: width,
    height: height
  },
  ...((index === 0) ? [insertSVGTemplateAssign()] : []),
  ['g', {transform: 'translate(' + (leftPad + 0.5) + ', 0.5)'}, svg]
  ];
}

module.exports = renderAssign;

/* eslint-env browser */
