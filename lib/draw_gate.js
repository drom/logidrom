'use strict';

const tspan = require('tspan');
const drawBody = require('./draw_body.js');

function drawMuxGate (spec) {
  const ilen = spec.length;
  const ret = ['g'];

  const gateX = spec[1][0];
  const gateY = spec[1][1];
  const ports = spec.ports; // SVG-coord port Y positions from layout

  // Collect actual data input positions
  const dataYs = [];
  const dataXs = [];
  for (let i = 3; i < ilen; i++) {
    dataYs.push(spec[i][1]);
    dataXs.push(spec[i][0]);
  }

  const numData = dataYs.length;
  const portYmin = ports[0];
  const portYmax = ports[numData - 1];
  const bodyLeftX = gateX - 16;

  // Identify wires that need vertical jogs (inputY != portY)
  const jogIndices = [];
  for (let i = 0; i < numData; i++) {
    if (dataYs[i] !== ports[i]) {
      jogIndices.push(i);
    }
  }
  const numJogs = jogIndices.length;

  // Assign staggered jog columns to avoid wire overlaps.
  // Topmost port gets rightmost column (closest to body),
  // bottommost gets leftmost — prevents horizontal-to-body segments
  // from crossing other wires' verticals.
  const inputMaxX = Math.max.apply(null, dataXs);
  const colSpacing = numJogs > 0 ? (bodyLeftX - inputMaxX) / (numJogs + 1) : 0;
  const jogColumnMap = {};
  for (let k = 0; k < numJogs; k++) {
    jogColumnMap[jogIndices[k]] = Math.round(bodyLeftX - (k + 1) * colSpacing);
  }

  // Wire each data input to its corresponding MUX port
  for (let i = 0; i < numData; i++) {
    const inputX = dataXs[i];
    const inputY = dataYs[i];
    const portY = ports[i];

    if (inputY === portY) {
      // Straight horizontal wire from input to body
      ret.push(['g',
        ['path', {
          d: 'M' + inputX + ',' + inputY + ' L' + bodyLeftX + ',' + portY,
          class: 'wire'
        }]
      ]);
    } else {
      // L-shaped route via assigned jog column
      const jogX = jogColumnMap[i];
      ret.push(['g',
        ['path', {
          d: 'M' + inputX + ',' + inputY +
             ' L' + jogX + ',' + inputY +
             ' L' + jogX + ',' + portY +
             ' L' + bodyLeftX + ',' + portY,
          class: 'wire'
        }]
      ]);
    }
  }

  // Selector wire: horizontal to below gate center, then vertical up to body bottom
  const selX = spec[2][0];
  const selY = spec[2][1];
  const bodyBottomAbs = gateY + (portYmax - gateY) + 8;
  const selWireX = gateX - 8;

  ret.push(['g',
    ['path', {
      d: 'M' + selX + ',' + selY + ' L' + selWireX + ',' + selY + ' L' + selWireX + ',' + bodyBottomAbs,
      class: 'wire'
    }]
  ]);

  // Gate body (trapezoid) sized by port positions, with port-relative index labels
  const portRelYs = ports.map(py => py - gateY);

  ret.push(['g',
    {transform: 'translate(' + gateX + ',' + gateY + ')'},
    ['title'].concat(tspan.parse(spec[0])),
    drawBody(spec[0], portYmin - gateY, portYmax - gateY, portRelYs)
  ]);

  return ret;
}

function drawFlipFlopGate (spec) {
  const ret = ['g'];

  const gateX = spec[1][0];
  const gateY = spec[1][1];
  const portMap = spec.portMap;         // {d: treeIdx, clk: treeIdx, ...}
  const portPositions = spec.portPositions; // {d: svgY, clk: svgY, ...}
  const bodyLeftX = gateX - 32;

  // Collect input positions and their target port Y positions
  const inputEntries = [];
  const portNames = Object.keys(portMap);
  for (let k = 0; k < portNames.length; k++) {
    const pn = portNames[k];
    const treeIdx = portMap[pn];
    const inputX = spec[treeIdx + 1][0]; // spec[2], spec[3], ...  (offset by +1 for gate pos)
    const inputY = spec[treeIdx + 1][1];
    const portY = portPositions[pn];
    inputEntries.push({port: pn, inputX: inputX, inputY: inputY, portY: portY});
  }

  // Identify wires that need vertical jogs (inputY != portY)
  const jogEntries = [];
  for (let k = 0; k < inputEntries.length; k++) {
    if (inputEntries[k].inputY !== inputEntries[k].portY) {
      jogEntries.push(k);
    }
  }
  const numJogs = jogEntries.length;

  // Assign staggered jog columns
  const inputMaxX = inputEntries.length > 0 ? Math.max.apply(null, inputEntries.map(function (e) { return e.inputX; })) : bodyLeftX;
  const colSpacing = numJogs > 0 ? (bodyLeftX - inputMaxX) / (numJogs + 1) : 0;
  const jogColumnMap = {};
  for (let k = 0; k < numJogs; k++) {
    jogColumnMap[jogEntries[k]] = Math.round(bodyLeftX - (k + 1) * colSpacing);
  }

  // Wire each input to its port position on the body
  for (let k = 0; k < inputEntries.length; k++) {
    const e = inputEntries[k];
    if (e.inputY === e.portY) {
      // Straight horizontal wire
      ret.push(['g',
        ['path', {
          d: 'M' + e.inputX + ',' + e.inputY + ' L' + bodyLeftX + ',' + e.portY,
          class: 'wire'
        }]
      ]);
    } else {
      // L-shaped route via jog column
      const jogX = jogColumnMap[k];
      ret.push(['g',
        ['path', {
          d: 'M' + e.inputX + ',' + e.inputY +
             ' L' + jogX + ',' + e.inputY +
             ' L' + jogX + ',' + e.portY +
             ' L' + bodyLeftX + ',' + e.portY,
          class: 'wire'
        }]
      ]);
    }
  }

  // Q output wire — short stub from right edge of body going right
  // (parent gate handles wiring from gate position to output label)
  // The Q port is inside the body; the parent wire connects at gateX,gateY

  // Qn output — wire + inversion bubble + label on right side
  if (spec.hasQn && spec.qnPortY != null) {
    const qnY = spec.qnPortY;
    // Wire from after the inversion bubble (4px) to label area
    ret.push(['g',
      ['path', {
        d: 'M' + (gateX + 4) + ',' + qnY + ' L' + (gateX + 16) + ',' + qnY,
        class: 'wire'
      }]
    ]);
    // Qn signal name label — placed past the wire endpoint (gateX + 16)
    if (spec.qnName) {
      ret.push(['g',
        ['text', {x: gateX + 20, y: qnY + 4, class: 'wirename'}]
          .concat(tspan.parse(spec.qnName))
      ]);
    }
  }

  // Compute port Y range for body sizing
  const allPortYs = [];
  for (let k = 0; k < portNames.length; k++) {
    allPortYs.push(portPositions[portNames[k]]);
  }
  // Include Q and Qn output positions in body range
  if (spec.qPortY != null) { allPortYs.push(spec.qPortY); }
  if (spec.qnPortY != null) { allPortYs.push(spec.qnPortY); }

  const portYmin = Math.min.apply(null, allPortYs);
  const portYmax = Math.max.apply(null, allPortYs);

  // Build portInfo for drawBody
  const portRelYs = {};
  for (let k = 0; k < portNames.length; k++) {
    portRelYs[portNames[k]] = portPositions[portNames[k]] - gateY;
  }
  const activePorts = {};
  for (let k = 0; k < portNames.length; k++) {
    activePorts[portNames[k]] = true;
  }

  const portInfo = {
    activePorts: activePorts,
    portRelYs: portRelYs,
    hasQn: spec.hasQn,
    qPortRelY: spec.qPortY != null ? spec.qPortY - gateY : null,
    qnPortRelY: spec.qnPortY != null ? spec.qnPortY - gateY : null
  };

  // Gate body
  ret.push(['g',
    {transform: 'translate(' + gateX + ',' + gateY + ')'},
    ['title'].concat(tspan.parse(spec[0])),
    drawBody(spec[0], portYmin - gateY, portYmax - gateY, portInfo)
  ]);

  return ret;
}

// ['type', [x,y], [x,y] ... ]
function drawGate (spec) { // ['type', [x,y], [x,y] ... ]

  if (spec[0] === '$dff') {
    return drawFlipFlopGate(spec);
  }

  if (spec[0] === '?') {
    return drawMuxGate(spec);
  }

  const ilen = spec.length;
  const ys = [];

  for (let i = 2; i < ilen; i++) {
    ys.push(spec[i][1]);
  }

  const ret = ['g'];

  const ymin = Math.min.apply(null, ys);
  const ymax = Math.max.apply(null, ys);

  ret.push(['g',
    {transform: 'translate(16,0)'},
    ['path', {
      d: 'M' + spec[2][0] + ',' + ymin + ' ' + spec[2][0] + ',' + ymax,
      class: 'wire'
    }]
  ]);

  for (let i = 2; i < ilen; i++) {
    ret.push(['g',
      ['path', {
        d: 'm' + spec[i][0] + ',' + spec[i][1] + ' 16,0',
        class: 'wire'
      }]
    ]);
  }

  ret.push(['g',
    {transform: 'translate(' + spec[1][0] + ',' + spec[1][1] + ')'},
    ['title'].concat(tspan.parse(spec[0])),
    drawBody(spec[0], ymin - spec[1][1], ymax - spec[1][1])
  ]);

  return ret;
}

module.exports = drawGate;
