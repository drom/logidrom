'use strict';

function processBranch (tree, i, state) {
  const branch = tree[i];
  if (Array.isArray(branch)) {
    state = render(branch, {
      x: (state.x + 1),
      y: state.y,
      xmax: state.xmax
    });
  } else {
    tree[i] = {
      name: branch,
      x: (state.x + 1),
      y: state.y
    };
    state.y += 2;
  }
  return state;
}

function renderMux (tree, ilen, state) {
  const numDataInputs = ilen - 2;
  const portSpacing = 2; // fixed grid units between MUX ports

  // Render data inputs with natural spacing (each gets only the space it needs)
  for (let i = 2; i < ilen; i++) {
    state = processBranch(tree, i, state);
  }

  // Compute fixed port positions independent of actual input positions
  // Ensure port range is at least as tall as data input range
  const dataInputYs = [];
  for (let i = 2; i < ilen; i++) {
    const branch = tree[i];
    dataInputYs.push(Array.isArray(branch) ? branch[0].y : branch.y);
  }

  // Align last port with last data input so tightly-packed simple inputs
  // match their ports exactly; complex inputs (with room) absorb the jog
  const lastInputY = dataInputYs[dataInputYs.length - 1];
  const portStart = lastInputY - (numDataInputs - 1) * portSpacing;
  const ports = [];
  for (let i = 0; i < numDataInputs; i++) {
    ports.push(portStart + i * portSpacing);
  }

  // Center gate on port range
  const portCenter = (ports[0] + ports[numDataInputs - 1]) / 2;
  tree[0] = {
    name: tree[0],
    x: state.x,
    y: Math.round(portCenter),
    ports: ports
  };

  // Ensure state.y accounts for port range extending below data inputs
  const portBottom = ports[ports.length - 1] + 2;
  if (portBottom > state.y) {
    state.y = portBottom;
  }

  // Selector (position 1) placed below data inputs and ports
  state = processBranch(tree, 1, state);

  return state;
}

function render(tree, state) {
  state.xmax = Math.max(state.xmax, state.x);

  const y = state.y;
  const ilen = tree.length;
  const isMux = (tree[0] === '?');

  if (isMux) {
    state = renderMux(tree, ilen, state);
  } else {
    for (let i = 1; i < ilen; i++) {
      state = processBranch(tree, i, state);
    }

    if (ilen === 2 && Array.isArray(tree[1])) {
      // Single compound input: align to its output position
      tree[0] = {
        name: tree[0],
        x: state.x,
        y: tree[1][0].y
      };
    } else {
      tree[0] = {
        name: tree[0],
        x: state.x,
        y: Math.round((y + (state.y - 2)) / 2)
      };
    }
  }

  state.x--;
  return state;
}

module.exports = render;
