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

// ['type', [x,y], [x,y] ... ]
function drawGate (spec) { // ['type', [x,y], [x,y] ... ]

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
