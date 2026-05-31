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

function renderFlipFlop (tree, state) {
  const config = tree[1]; // {d, clk, s, r, qn}

  // Rebuild tree array: expand config object into positioned branches
  tree.length = 1;
  const portMap = {};  // port name -> tree index
  let idx = 1;

  // Order: S (top), D, clk, R (bottom) — visual top-to-bottom
  const inputOrder = [];
  if (config.s != null) { inputOrder.push({port: 's', signal: config.s}); }
  if (config.d != null) { inputOrder.push({port: 'd', signal: config.d}); }
  if (config.clk != null) { inputOrder.push({port: 'clk', signal: config.clk}); }
  if (config.r != null) { inputOrder.push({port: 'r', signal: config.r}); }

  // Pin gate x-position: compound inputs decrement state.x when they return
  // from render(), which would drift subsequent inputs. Use a fixed gateX
  // so all inputs are consistently placed at gateX + 2 (extra unit for the
  // wider flip-flop body which is 32px = 1 full grid unit wide).
  const gateX = state.x;

  for (let k = 0; k < inputOrder.length; k++) {
    const signal = inputOrder[k].signal;
    tree[idx] = signal;
    portMap[inputOrder[k].port] = idx;

    if (Array.isArray(signal)) {
      state = render(signal, {x: gateX + 2, y: state.y, xmax: state.xmax});
    } else {
      tree[idx] = {name: signal, x: gateX + 2, y: state.y};
      state.xmax = Math.max(state.xmax, gateX + 2);
      state.y += 2;
    }
    idx++;
  }

  // Restore state.x to gateX so render() decrements correctly for the parent
  state.x = gateX;

  // Calculate port positions from actual rendered positions
  const portPositions = {};
  for (const portName of Object.keys(portMap)) {
    const treeIdx = portMap[portName];
    const branch = tree[treeIdx];
    portPositions[portName] = Array.isArray(branch) ? branch[0].y : branch.y;
  }

  // Compute port Y range for body sizing
  const allYs = Object.values(portPositions);
  if (allYs.length === 0) {
    throw new Error('$dff requires at least one input port (d, clk, s, or r)');
  }
  const portYmin = Math.min.apply(null, allYs);
  const portYmax = Math.max.apply(null, allYs);

  // Q and Qn output ports at fixed offsets relative to body
  // Q aligns with D (or top input), Qn aligns with clk (or bottom input)
  const qPortY = portPositions.d != null ? portPositions.d : portYmin;
  let qnPortY = null;
  if (config.qn != null) {
    qnPortY = portPositions.clk != null ? portPositions.clk : portYmax;
  }

  // Position gate at Q output port so the parent output wire aligns with Q
  tree[0] = {
    name: '$dff',
    x: gateX,
    y: qPortY,
    portMap: portMap,
    portPositions: portPositions,
    hasQn: config.qn != null,
    qnName: config.qn || null,
    qPortY: qPortY,
    qnPortY: qnPortY
  };

  // Note: do NOT state.x-- here; render() does it after we return
  return state;
}

function render(tree, state) {
  state.xmax = Math.max(state.xmax, state.x);

  const y = state.y;
  const ilen = tree.length;
  const isMux = (tree[0] === '?');
  const isFlop = (tree[0] === '$dff' && ilen === 2 && tree[1] !== null && typeof tree[1] === 'object' && !Array.isArray(tree[1]));

  if (isFlop) {
    state = renderFlipFlop(tree, state);
  } else if (isMux) {
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
