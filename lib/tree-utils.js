'use strict';

const isAttrs = v =>
  v !== null &&
  typeof v === 'object' &&
  !Array.isArray(v) &&
  !Object.prototype.hasOwnProperty.call(v, 'x');

const firstChildIdx = tree => isAttrs(tree[1]) ? 2 : 1;

const getAttrs = tree => isAttrs(tree[1]) ? tree[1] : null;

const isLeafCone = tree => Array.isArray(tree) && tree.length === firstChildIdx(tree);

const getWidth = node => {
  if (!Array.isArray(node)) return 1;
  const attrs = getAttrs(node);
  return (attrs && attrs.width) || 1;
};

const widther = w => (w === 0) ? 'zeroer' : (w === 1) ? 'scalar' : 'vector';

const nameOf = node => (typeof node === 'string') ? node : node.name;

// For pin / pout / pinout cones: compose "<instance>.<pin>" from attrs.
// Used for tooltips. Returns null if op isn't one of these or attrs missing.
const pinLabel = (op, attrs) => {
  if (op !== 'pin' && op !== 'pout' && op !== 'pinout') return null;
  if (!attrs) return null;
  const ins = attrs.instance || '';
  const pin = attrs.pin || '';
  return ins + '.' + pin;
};

// Two-section labels for pin/pout/pinout port shapes.
// Returns {instance, pin} strings; left/right placement is determined per-op
// by the shape renderer (drawPortBox).
const pinLabels = (op, attrs) => {
  if (!attrs) return {instance: '', pin: ''};
  return {instance: attrs.instance || '', pin: attrs.pin || ''};
};

const leafDisplay = branch => {
  if (!Array.isArray(branch)) return nameOf(branch);
  const attrs = getAttrs(branch);
  const name = nameOf(branch[0]);
  const pl = pinLabel(name, attrs);
  if (pl !== null) return pl;
  return name;
};

const outDisplay = assignTree => {
  const attrs = getAttrs(assignTree);
  const op = nameOf(assignTree[0]);
  const pl = pinLabel(op, attrs);
  if (pl !== null) return pl;
  const start = firstChildIdx(assignTree);
  const branch = assignTree[start];
  const visible = Array.isArray(branch) ? nameOf(branch[0]) : nameOf(branch);
  return visible || ((attrs && attrs.label) || '');
};

const outTooltip = assignTree => {
  const attrs = getAttrs(assignTree);
  const op = nameOf(assignTree[0]);
  const pl = pinLabel(op, attrs);
  if (pl !== null) return pl;
  if (attrs && attrs.label) return attrs.label;
  const start = firstChildIdx(assignTree);
  const branch = assignTree[start];
  return Array.isArray(branch) ? nameOf(branch[0]) : nameOf(branch);
};

const inlineDisplay = assignTree => {
  const attrs = getAttrs(assignTree);
  const op = nameOf(assignTree[0]);
  const pl = pinLabel(op, attrs);
  if (pl !== null) return pl;
  const start = firstChildIdx(assignTree);
  const nameBranch = assignTree[start];
  const node = Array.isArray(nameBranch) ? nameBranch[0] : nameBranch;
  return (node && node.name) || '';
};

const isPinOp = op => op === 'pin' || op === 'pout' || op === 'pinout';

exports.isAttrs = isAttrs;
exports.firstChildIdx = firstChildIdx;
exports.getAttrs = getAttrs;
exports.isLeafCone = isLeafCone;
exports.getWidth = getWidth;
exports.widther = widther;
exports.leafDisplay = leafDisplay;
exports.outDisplay = outDisplay;
exports.outTooltip = outTooltip;
exports.inlineDisplay = inlineDisplay;
exports.isPinOp = isPinOp;
exports.pinLabel = pinLabel;
exports.pinLabels = pinLabels;
