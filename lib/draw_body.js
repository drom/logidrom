'use strict';

const tspan = require('tspan');

const circle = 'M 4,0 C 4,1.1 3.1,2 2,2 0.9,2 0,1.1 0,0 c 0,-1.1 0.9,-2 2,-2 1.1,0 2,0.9 2,2 z';
const buf1 = 'M -11,-6 -11,6 0,0 z m -5,6 5,0';
const and2 = 'm -16,-10 5,0 c 6,0 11,4 11,10 0,6 -5,10 -11,10 l -5,0 z';
const or2 = 'm -18,-10 4,0 c 6,0 12,5 14,10 -2,5 -8,10 -14,10 l -4,0 c 2.5,-5 2.5,-15 0,-20 z';
const xor2 = 'm -21,-10 c 1,3 2,6 2,10 m 0,0 c 0,4 -1,7 -2,10 m 3,-20 4,0 c 6,0 12,5 14,10 -2,5 -8,10 -14,10 l -4,0 c 1,-3 2,-6 2,-10 0,-4 -1,-7 -2,-10 z';
const circle2 = 'c 0,4.418278 -3.581722,8 -8,8 -4.418278,0 -8,-3.581722 -8,-8 0,-4.418278 3.581722,-8 8,-8 4.418278,0 8,3.581722 8,8 z';

const gates = {
  '=': buf1, '~':  buf1 + circle,
  '&': and2, '~&': and2 + circle,
  '|': or2,  '~|': or2  + circle,
  '^': xor2, '~^': xor2 + circle,
  '+': 'm -8,5 0,-10 m -5,5 10,0 m 3,0' + circle2,
  '*': 'm -4,4 -8,-8 m 0,8 8,-8  m 4,4' + circle2,
  '-': 'm -3,0 -10,0 m 13,0' + circle2
};


const aliasGates = {
  add: '+', mul: '*', sub: '-',
  and: '&', or: '|', xor: '^',
  andr: '&', orr: '|', xorr: '^',
  input: '='
};

Object.keys(aliasGates).reduce((res, key) => {
  res[key] = gates[aliasGates[key]];
  return res;
}, gates);

const gater1 = {
  is:     type => (gates[type] !== undefined),
  render: type => ['path', {class:'gate', d: gates[type]}]
};

const iec = {
  eq: '==', ne: '!=',
  slt: '<', sle: '<=',
  sgt: '>', sge: '>=',
  ult: '<', ule: '<=',
  ugt: '>', uge: '>=',
  BUF: 1, INV: 1, AND: '&', NAND: '&',
  OR: '\u22651', NOR: '\u22651', XOR: '=1', XNOR: '=1',
  box: '', MUX: 'M'
};

const circled = {INV: 1, NAND: 1, NOR: 1, XNOR: 1};

const gater2 = {
  is:      type => (iec[type] !== undefined),
  render: (type, ymin, ymax) => {
    if (ymin === ymax) {
      ymin = -4; ymax = 4;
    }
    return ['g',
      ['path', {
        class: 'gate',
        d: 'm -16,' + (ymin - 3) + ' 16,0 0,' + (ymax - ymin + 6) + ' -16,0 z' + (circled[type] ? circle : '')
      }],
      ['text', {x:-14, y:4, class: 'wirename'}].concat(tspan.parse(iec[type]))
    ];
  }
};

function drawMux (ymin, ymax, dataInputYs) {
  if (ymin === ymax) { ymin = -4; ymax = 4; }

  const g = ['g'];

  // Trapezoid with fixed inset=6 for consistent angle, pad=11 for label clearance
  g.push(['path', {
    class: 'gate',
    d: 'M -16,' + (ymin - 11) +
       ' L 0,' + (ymin - 5) +
       ' L 0,' + (ymax + 5) +
       ' L -16,' + (ymax + 11) +
       ' Z'
  }]);

  // Data input index labels inside the body
  if (dataInputYs) {
    for (let i = 0; i < dataInputYs.length; i++) {
      g.push(['text', {x: -15, y: dataInputYs[i] + 4, class: 'wirename'}]
        .concat(tspan.parse(String(i))));
    }
  }

  return g;
}

function drawFlipFlop (ymin, ymax, portInfo) {
  if (ymin === ymax) { ymin = -4; ymax = 4; }

  const g = ['g'];

  // Rectangle body — 32px wide for dual-side labels (x: -32 to 0)
  g.push(['path', {
    class: 'gate',
    d: 'm -32,' + (ymin - 8) + ' 32,0 0,' + (ymax - ymin + 16) + ' -32,0 z'
  }]);

  // Port labels and markers — portInfo is {activePorts, portRelYs, hasQn, qPortRelY, qnPortRelY}
  if (portInfo) {
    const activePorts = portInfo.activePorts || {};
    const portRelYs = portInfo.portRelYs || {};

    // Left-side input labels
    if (activePorts.d && portRelYs.d != null) {
      g.push(['text', {x: -30, y: portRelYs.d + 4, class: 'wirename'}, 'D']);
    }
    if (activePorts.s && portRelYs.s != null) {
      g.push(['text', {x: -30, y: portRelYs.s + 4, class: 'wirename'}, 'S']);
    }
    if (activePorts.r && portRelYs.r != null) {
      g.push(['text', {x: -30, y: portRelYs.r + 4, class: 'wirename'}, 'R']);
    }

    // Clock input — triangle marker instead of text label
    if (activePorts.clk && portRelYs.clk != null) {
      const cy = portRelYs.clk;
      g.push(['path', {
        class: 'wire',
        d: 'M -32,' + (cy - 4) + ' -26,' + cy + ' -32,' + (cy + 4)
      }]);
    }

    // Right-side output labels
    if (portInfo.qPortRelY != null) {
      g.push(['text', {x: -2, y: portInfo.qPortRelY + 4, class: 'pinname'}, 'Q']);
    }

    // Qn — label + inversion bubble on right edge
    if (portInfo.hasQn && portInfo.qnPortRelY != null) {
      g.push(['text', {x: -6, y: portInfo.qnPortRelY + 4, class: 'pinname'}]
        .concat(tspan.parse('Q\u0305')));
      // Inversion bubble at right edge
      g.push(['path', {
        class: 'gate',
        d: 'M 4,' + portInfo.qnPortRelY + ' C 4,' + (portInfo.qnPortRelY + 1.1) + ' 3.1,' + (portInfo.qnPortRelY + 2) + ' 2,' + (portInfo.qnPortRelY + 2) +
           ' 0.9,' + (portInfo.qnPortRelY + 2) + ' 0,' + (portInfo.qnPortRelY + 1.1) + ' 0,' + portInfo.qnPortRelY +
           ' 0,' + (portInfo.qnPortRelY - 1.1) + ' 0.9,' + (portInfo.qnPortRelY - 2) + ' 2,' + (portInfo.qnPortRelY - 2) +
           ' 3.1,' + (portInfo.qnPortRelY - 2) + ' 4,' + (portInfo.qnPortRelY - 1.1) + ' 4,' + portInfo.qnPortRelY + ' z'
      }]);
    }
  }

  return g;
}

function drawBody (type, ymin, ymax, dataInputYs) {
  if (type === '$dff') { return drawFlipFlop(ymin, ymax, dataInputYs); }
  if (type === '?') { return drawMux(ymin, ymax, dataInputYs); }
  if (gater1.is(type)) { return gater1.render(type); }
  if (gater2.is(type)) { return gater2.render(type, ymin, ymax); }
  return ['text', {x:-14, y:4, class: 'wirename'}].concat(tspan.parse(type));
}

module.exports = drawBody;
