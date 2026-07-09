'use strict';

const {firstChildIdx} = require('./tree-utils.js');

function render(tree, state) {
  state.xmax = Math.max(state.xmax, state.x);

  const y = state.y;
  const start = firstChildIdx(tree);
  const ilen = tree.length;

  if (ilen === start) {
    tree[0] = {name: tree[0], x: state.x, y: state.y};
    state.y += 2;
    state.x--;
    return state;
  }

  const isAssign = tree[0] === '=' && ilen > start + 1;
  const childStart = isAssign ? start + 1 : start;

  // Render all children first, tracking their output Y rows so we can place
  // the gate to minimise total input wire length. In this 1D setting the
  // sum of |childY - gateY| is minimised when gateY is any median of the
  // children’s Y coordinates, so we compute the median row.
  const childYs = [];
  for (let i = childStart; i < ilen; i++) {
    const branch = tree[i];
    if (Array.isArray(branch)) {
      state = render(branch, {
        x: (state.x + 1),
        y: state.y,
        xmax: state.xmax
      });
      const node = branch[0];
      if (node && typeof node === 'object' && typeof node.y === 'number') {
        childYs.push(node.y);
      }
    } else {
      const node = {
        name: branch,
        x: (state.x + 1),
        y: state.y
      };
      tree[i] = node;
      state.xmax = Math.max(state.xmax, state.x + 1);
      childYs.push(node.y);
      state.y += 2;
    }
  }

  let gateY;
  if (childYs.length === 0) {
    // Leaf-only case is handled above, but keep a defensive fallback.
    gateY = y;
  } else {
    childYs.sort((a, b) => a - b);
    const mid = Math.floor(childYs.length / 2);
    if (childYs.length % 2 === 1) {
      gateY = childYs[mid];
    } else {
      gateY = Math.round((childYs[mid - 1] + childYs[mid]) / 2);
    }
  }
  tree[0] = {name: tree[0], x: state.x, y: gateY};

  if (isAssign) {
    const nameBranch = tree[start];
    if (Array.isArray(nameBranch)) {
      nameBranch[0] = {name: nameBranch[0], x: state.x, y: gateY};
    } else {
      tree[start] = {name: nameBranch, x: state.x, y: gateY};
    }
  }

  state.x--;
  return state;
}

module.exports = render;
