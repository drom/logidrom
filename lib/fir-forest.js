'use strict';

const tt = require('./tt.js');
const {B612} = require('./B612.js');

const grid = 32;

const ceil = (n, step) => step * Math.ceil(n / step);

const f = B612()(16);

const symbols = {
  andr: '&', orr: '≥1', xorr: '=1',
  neg: 'neg', not: 'not',

  tail: 'tl', head:  'hd', pad: 'pd',
  add:  '+', sub:  '-',
  mul:  '*', div:  '/',      rem:  '%',
  lt: '<', leq: '≤', gt: '>', geq: '≥', eq: '=', neq: '≠',
  shl:  '<<', shr:  '>>',
  dshl: '<<', dshr: '>>',
  and:  '&', or:  '≥1', xor:  '=1',
  cat: '}'
};

const renderLiteral = (node, ch) => {
  const label = node.value.toString();
  const w = ceil(f.getWidth(label) + 5, grid);
  const h = Math.max(ch, grid);
  const res = ['g', {w, h},
    ['rect', {class: 'literal', width: w - 4, height: h - 4, x: 2, y: -h / 2 + 2}],
    ['text', {
      class: (node.signed ? '' : 'un') + 'siglabel',
      x: w / 2,
      y: 5
    }, label]
  ];
  return res;
};


const renderParameter = (node, ch) => {
  const label = node.name.toString();
  const w = ceil(f.getWidth(label) + 5, grid);
  const h = Math.max(ch, grid);
  const res = ['g', {w, h},
    ['rect', {class: 'literal', width: w - 4, height: h - 4, x: 2, y: -h / 2 + 2}],
    ['text', {class: 'parameter', x: w / 2, y: 5}, label]
  ];
  return res;
};


const renderWire = (node, ch, reuse) => {
  const label = node.name;
  const w = ceil(f.getWidth(label), grid);
  const k = (f.getHeight() / 2 + 1) |0;
  const h = Math.max(ch, 2 * k + 8);
  const res = ['g', {w, h}]
    .concat(
      reuse ? [] : [['path', {
        class: 'mark ' + (node.signed ? '' : 'un') + 'signed',
        d: `M 0,${-k} l ${[w, 0]} l ${[0, 2 * k]} l ${[-w, 0]} z`
      }]],
      [['text', {
        class: (node.signed ? '' : 'un') + 'siglabel',
        x: w / 2,
        y: k - 4
      }, node.name]]
    );
  return res;
};

const renderOutput = (node, ch, reuse) => {
  const label = node.name;
  const w = ceil(f.getWidth(label), grid);
  const k = (f.getHeight() / 2 + 1) |0;
  const h = Math.max(ch, 2 * k + 8);
  const res = ['g', {w, h}]
    .concat(
      reuse ? [] : [['path', {
        class: 'mark ' + (node.signed ? '' : 'un') + 'signed',
        d: `M 0,${-k} l ${[w - k, 0]} l ${[k, k]} l ${[-k, k]} l ${[-(w - k), 0]} z`
      }]],
      [['text', {
        class: (node.signed ? '' : 'un') + 'siglabel',
        x: w / 2,
        y: k - 4
      }, node.name]]
    );
  return res;
};

const renderInput = (node, ch) => {
  const label = node.name;
  const w = ceil(f.getWidth(label) + 5, grid);
  const k = (f.getHeight() / 2 + 1) |0;
  const h = Math.max(ch, 2 * k + 8);
  const res = ['g', {w, h},
    ['path', {
      class: 'mark ' + (node.signed ? '' : 'un') + 'signed',
      d: `M 0,${-h / 2 + 6} l ${[w - k, 0]} l ${[k, k]} l ${[-k, k]} l ${[-(w - k), 0]} z`
    }],
    ['text', {
      class: (node.signed ? '' : 'un') + 'siglabel',
      x: w / 2,
      y: k - 4
    }, node.name]
  ];
  return res;
};

const buf1 = 'm 0,-12 v 24 l 22,-12 z m 24,12';
const circle = 'c 0,1.8 2.2,4 4,4 c 1.8,0 4,-2.2 4,-4 c 0,-1.8 -2.2,-4 -4,-4 c -1.8,0 -4,2.2 -4,4 z';
// const circle = 'm 0,0 c 0,2.2 -2.2,0 4,4 c 2.2,0 0,2.2 4,-4 c 0,-2.2 0,-2.2 -4,-4 c -2.2,0 0,-2.2 -4,4 z';

const and1 = 'm 0,-10 5,0 c 6,0 11,4 11,10 0,6 -5,10 -11,10 l -5,0 z m 16,10 h 16';
const or1 = 'm -2,-10 4,0 c 6,0 12,5 14,10 -2,5 -8,10 -14,10 l -4,0 c 2.5,-5 2.5,-15 0,-20 z  m 18,10 h 16';
const xor1 = 'm -2,-10 c 1,3 2,6 2,10 m 0,0 c 0,4 -1,7 -2,10 m 3,-20 4,0 c 6,0 12,5 14,10 -2,5 -8,10 -14,10 l -4,0 c 1,-3 2,-6 2,-10 0,-4 -1,-7 -2,-10 z  m 18,10 h 16';

const and2 = 'm 0,-20 10,0 c 12,0 22,8 22,20 0,12 -10,20 -22,20 l -10,0 z';
const or2 = 'm -2,-20 8,0 c 12,0 24,10 28,20 -4,10 -16,20 -28,20 l -8,0 c 5,-10 5,-30 0,-40 z';
const xor2 = 'm -5,-20 c 2,6 4,12 4,20 m 0,0 c 0,8 -2,14 -4,20 m 6,-40 8,0 c 12,0 24,10 28,20 -2,10 -16,20 -28,20 l -8,0 c 2,-6 4,-12 4,-20 0,-8 -2,-14 -4,-20 z';

const circle2 = 'c 0,11 -9,20 -20,20 -11,0 -20,-9 -20,-20 0,-11 9,-20 20,-20 11,0 20,9 20,20 z';

const shapes = {
  'not': buf1 + circle,
  'and': and2, 'or': or2, 'xor': xor2,
  'andr': and1, 'orr': or1, 'xorr': xor1,
  'add': 'm 12,10 0,-20 m -10,10 20,0 m 10,0' + circle2,
  'mul': 'm 20,8 -16,-16 m 0,16 16,-16  m 12,8' + circle2,
  'sub': 'm 22,0 -20,0 m 30,0' + circle2
};

const renderShape = (node, ch) => {
  const w = grid;
  const h = Math.max(ch, grid);
  const res = ['g', {w, h},
    ['path', {
      class: [
        (node.signed ? '' : 'un') + 'signed',
        (node.width === 1) ? 'scalar' : 'vector'
      ].join(' '),
      d: shapes[node.type]
    }]
  ];
  return res;
};

const renderBox = (node, ch) => {
  const w = grid;
  const h = Math.max(ch, grid);
  const hh = Math.max(node.arguments.length, 1) * grid;
  const res = ['g', {w, h},
    ['rect', {
      class: 'mark ' + (node.signed ? '' : 'un') + 'signed',
      width: grid,
      height: hh - 8,
      x: 0,
      y: -hh / 2 + 4
    }],
    ['text', {x: grid / 2, y: 5}, symbols[node.type]]
  ];
  return res;
};

const renderMux = (node, ch) => {
  const w = grid;
  const h = Math.max(ch, grid);
  // const totals = node.arguments.map(e => e.hTotal);
  // const offset0 = Math.min(totals[0], ch / 2 - grid);
  // const from = Math.min(totals[0] + totals[1] / 2, h / 2) - grid / 2;
  const res = ['g', {w, h},
    ['path', {
      class: 'mark ' + (node.signed ? '' : 'un') + 'signed',
      d: `M${[0, -grid / 4 * 3]} l ${[grid, grid / 2]} v ${grid / 4 * 5} l ${[-grid, grid / 2]} z`
    }],
    ['path', {
      class: 'unsigned',
      d: `M${[0, -grid]} h ${grid / 2} v ${grid / 2}`
    }],
    ['text', {x: grid / 4, y: 5}, 0],
    ['text', {x: grid / 4, y: grid + 5}, 1]
  ];
  return res;
};

const renderOther = (node, ch) => {
  const w = 2 * grid;
  const h = Math.max(ch, grid);
  return ['g', {w, h},
    ['path', {class:'mark', d: `M${[0, 0]} L ${[grid, h / 2]} L ${[0, h]}`}],
    ['text', {class:'label', x: grid / 2, y: h / 2 + 5}, node.type],
    ['title', ['tspan', node.type]]
  ];
};

const renderCvt = (node, ch) => {
  const w = 2 * grid;
  const h = Math.max(ch, 3);
  return ['g', {w, h},
    ['line', {
      class: [
        node.signed ? 'unsigned' : 'signed',
        (node.width === 1) ? 'scalar' : 'vector'
      ].join(' '),
      x1: 0, y1: 0, x2: grid, y2: 0
    }],
    ['line', {
      class: [
        node.signed ? 'signed' : 'unsigned',
        (node.width === 1) ? 'scalar' : 'vector'
      ].join(' '),
      x1: grid, y1: 0, x2: 2 * grid, y2: 0
    }]
  ];
};

const lut = {
  input: renderInput,
  output: renderOutput,
  wire: renderWire,
  UInt: renderLiteral, SInt: renderLiteral,
  asSInt: renderCvt, asUInt: renderCvt, cvt: renderCvt,
  mux: renderMux,
  parameter: renderParameter,
  other: renderOther
};

const getBody = (node, ch, reuse) =>
  (
    (shapes[node.type] && renderShape) ||
    lut[node.type] ||
    (symbols[node.type] && renderBox) ||
    lut.other
  )(node, ch, reuse);

const wire = (arg, x, y1, y2) => {
  const klass = [
    arg.signed ? 'signed' : 'unsigned',
    (arg.width === 1) ? 'scalar' : 'vector'
  ].join(' ');
  if (y1 == y2) {
    return ['line', {
      class: klass,
      x1: x,         y1,
      x2: x + grid,  y2
    }];
  }
  return ['path', {
    class: klass,
    d: `M ${[x, y1]} h ${grid / 2} v ${y2 - y1} h ${grid / 2}`
  }];
};

const tree = node => {

  let hTotal = node.hTotal;
  let wTotal = node.wTotal;
  let g = ['g', {}];
  let reuse = false;

  const args = (node.arguments || []);

  if (wTotal === undefined) {
    const children = args.map(tree);

    ({wTotal, hTotal} = children.reduce((res, e) => {
      res.wTotal = Math.max(res.wTotal, e[1].w);
      res.hTotal += e[1].h;
      return res;
    }, {wTotal: 0, hTotal: 0}));

    ({g} = children.reduce((res, e, ei) => {
      res.g.push(['g', tt(wTotal - e[1].w, res.y), e]);
      res.g.push(wire(
        args[ei],
        wTotal,
        res.y + e[1].h / 2,
        hTotal / 2 + (ei - children.length / 2 + 0.5) * grid
      ));
      res.y += e[1].h;
      return res;
    }, {y: 0, g}));
    node.wTotal = wTotal;
    hTotal = node.hTotal = Math.max(hTotal, grid);
  } else {
    reuse = true;
    hTotal = node.hTotal = grid;
  }

  const body = getBody(node, hTotal, reuse);
  g.push(['g', tt(wTotal + grid, hTotal / 2), body]);
  g[1].w = wTotal + grid + body[1].w;
  g[1].h = body[1].h;
  return g;
};

const clean = ast =>
  ast
    .filter(node => node.type !== 'input')
    .filter(node => node.type !== 'wire')
    .filter(node => !((node.type === 'output') && (node.usage > 0)));

const forest = ast => {
  const res = ['g', tt(.5, .5)];
  let w = 256;
  let h = 0;
  ast = clean(ast);
  ast.map(node => {
    const e = tree(node);
    res.push(['g', tt(0, h), e]);
    h += e[1].h;
    w = Math.max(w, e[1].w);
  });
  res[1].w = w + grid;
  res[1].h = h + grid;
  return res;
};

module.exports = forest;
