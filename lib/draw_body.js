'use strict';

const tspan = require('tspan');
const {getLabelWidth} = require('./font-metrics.js');

const circle = [
  'm', -6, -0,
  'a', 3, 3, 0, 1, 1, 6, 0,
  'a', 3, 3, 0, 1, 1, -6, 0
];

const buf1 = ['m', -12, -6, 12, 6, -12, 6, 'z'];

const and1 = [ // reduction AND with 1 input
  'm', -16, -6,
  'h', 6,
  'a', 6, 6, 0, 1, 1, 0, 12,
  'h', -6,
  'z',
  'm', 12, 6,
  'h', 4
];

const or1 = [ // reduction OR with 1 input
  'm', -17, 6,
  'a', 12, 12, 0, 0, 0, 0, -12,
  'a', 12, 12, 0, 0, 1, 13, 6,
  'a', 12, 12, 0, 0, 1, -13, 6,
  'z',
  'm', 13, -6,
  'h', 4
];

const xor1 = [ // reduction XOR with 1 input
  'm', -12, 6,
  'a', 12, 12, 0, 0, 0, 0, -12,
  'a', 12, 12, 0, 0, 1, 9, 6,
  'a', 12, 12, 0, 0, 1, -9, 6,
  'z',
  'm', -4, 0, 'a', 12, 12, 0, 0, 0, 2, -6, // second left
  'm',  0, 0, 'a', 12, 12, 0, 0, 0, -2, -6,
  'm', 13, 6,
  'h', 3
];

const and2 = [ // AND gate with >1 inputs
  'm', -16, -12,
  'h', 4,
  'a', 12, 12, 0, 1, 1, 0, 24,
  'h', -4,
  'z'
];

const or2 = [ // OR gate with >1 inputs
  'm', -16, 12,
  'a', 28, 28, 0, 0, 0, 0, -24, // left
  'a', 18, 18, 0, 0, 1, 16, 12, // top
  'a', 18, 18, 0, 0, 1, -16, 12, // bottom
  'z'
];

const xor2 = [ // XOR gate with >1 inputs
  'm', -12, 12,
  'a', 28, 28, 0, 0, 0, 0, -24, // left
  'a', 18, 18, 0, 0, 1, 12, 12, // top
  'a', 18, 18, 0, 0, 1, -12, 12, // bottom
  'z',
  'm', -4, 0, 'a', 28, 28, 0, 0, 0, 3, -12, // second left
  'm',  0, 0, 'a', 28, 28, 0, 0, 0, -3, -12
];

const circle2 = [
  'm', -10, -10,
  'a', 10, 10, 0, 1, 1, 0, 20,
  'a', 10, 10, 0, 1, 1, 0, -20
];

const gates = {
  'buf1': {w: 12, d: buf1}, '~':   {w: 18, d: [...circle, ...buf1]},
  '&':    {w: 16, d: and2}, '~&':  {w: 22, d: [...circle, ...and2]},
  '&1':   {w: 16, d: and1}, '~&1': {w: 22, d: [...circle, ...and1]},
  '|':    {w: 16, d: or2 }, '~|':  {w: 22, d: [...circle, ...or2]},
  '|1':   {w: 16, d: or1 }, '~|1': {w: 22, d: [...circle, ...or1]},
  '^':    {w: 16, d: xor2}, '~^':  {w: 22, d: [...circle, ...xor2]},
  '^1':   {w: 16, d: xor1}, '~^1': {w: 22, d: [...circle, ...xor1]},
  '+':    {w: 16, d: ['m', -10, 5, 0, -10, 'm', -5, 5, 10, 0, 'm', 5, 0, ...circle2]},
  '*':    {w: 16, d: ['m', -6,  4, -8, -8, 'm', 0, 8, 8, -8, 'm', 6, 4, ...circle2]},
  '-':    {w: 16, d: ['m', -5, 0, -10, 0, 'm', 15, 0, ...circle2]},
  '/':    {w: 16, d: ['m', -6, -4, -8, 8, 'm', 14, -4, ...circle2]},
  '%':    {w: 16, d: ['m', -6, -4, -8, 8,
    'm', 1, -5, 'a', 2, 2, 0, 1, 1, 0, -4, 'a', 2, 2, 0, 1, 1, 0,  4, // top left
    'm', 6,  2, 'a', 2, 2, 0, 1, 1, 0,  4, 'a', 2, 2, 0, 1, 1, 0, -4, // bottom right
    'm', 7, -1, ...circle2
  ]},
};

const aliasGates = {
  add: '+', mul: '*', sub: '-',
  and: '&', or: '|', xor: '^',
  andr: '&', orr: '|', xorr: '^',
  input: 'buf1'
};

Object.keys(aliasGates).reduce((res, key) => {
  res[key] = gates[aliasGates[key]];
  return res;
}, gates);

const gater1 = {
  is:     type => (gates[type] !== undefined),
  render: type => ['path', {w: gates[type].w, h: 16, class: 'gate', d: gates[type].d}]
};

const iec = {
  eq: '==', ne: '!=',
  slt: '<', sle: '<=',
  sgt: '>', sge: '>=',
  ult: '<', ule: '<=',
  ugt: '>', uge: '>=',
  BUF: 1, INV: 1, AND: '&', NAND: '&',
  OR: '≥1', NOR: '≥1', XOR: '=1', XNOR: '=1',
  box: '', CONCAT: '}',
  case: 'C', casez: 'Z', casex: 'X'
};

const circled = {INV: 1, NAND: 1, NOR: 1, XNOR: 1};

const gater2 = {
  is:      type => (iec[type] !== undefined),
  render: (type, ymin, ymax) => {
    if (ymin === ymax) {
      ymin = -4; ymax = 4;
    }
    return ['g', {w: 16, h: ymax - ymin + 6},
      ['path', {
        class: 'gate',
        d: ['m', -16, (ymin - 3), 16, 0, 0, (ymax - ymin + 6), -16, 0, 'z', ...(circled[type] ? circle : [])]
      }],
      ['text', {x:-14, y:4, class: 'wirename'}, ...tspan.parse(iec[type])]
    ];
  }
};

const isSlice = type => typeof type === 'string' && type[0] === '[';

// eslint-disable-next-line complexity
function drawBody (type, ymin, ymax, fontWidth, attrs) {
  if (gater1.is(type)) { return gater1.render(type); }
  if (gater2.is(type)) { return gater2.render(type, ymin, ymax); }
  if (isSlice(type)) {
    const bodyW = getLabelWidth(type, fontWidth) + 8;
    return ['text', {w: bodyW, h: 16, x: -bodyW / 2, y: 4, class: 'slicelabel'},
      ...tspan.parse(type)
    ];
  }

  if (type === 'MUX') {
    return ['g', {w: 12, h: 40, o: -8},
      ['path', {class: 'gate', d: [
        'm', -12, -24, 12, 6, 0, 20, -12, 6,
        'z',
        'm', 0, 40, 7, 0,
        'm', 0, 0, 0, -11
      ]}],
      ['text', {x: -7, y: -12, class: 'bodylabel'}, '0'],
      ['text', {x: -7, y: 2, class: 'bodylabel'}, '1']
    ];
  }
  {
    const m = type.match(/^ff(?<negedge>n)?(?<enable>e)?((?<syncReset>[cp])?(?<syncResetPolarity>n)?)?(?<asyncReset>[rs])?((?<asyncResetPolarity>n)?)?$/);
    if (m) {
      const {negedge, enable, syncReset, syncResetPolarity, asyncReset, asyncResetPolarity} = m.groups;
      const hasNegedge = negedge === 'n';
      const hasEnable = enable === 'e';
      const hasSyncReset = syncReset !== undefined;
      const hasSyncSet = syncReset === 'p';
      const hasSyncResetPolarity = syncResetPolarity === 'n';
      const hasAsyncReset = asyncReset !== undefined;
      const hasAsyncSet = asyncReset === 's';
      const hasAsyncResetPolarity = asyncResetPolarity === 'n';

      let h = 32;
      if (hasEnable) h += 16;
      if (hasSyncReset) h += 16;
      if (hasSyncSet) h += 16;
      if (hasAsyncReset) h += 16;
      if (hasAsyncSet) h += 16;

      let o = -(h / 2 - 8);

      return ['g', {w: 32, h, o},
        ['path', {class: 'dff', d: [
          'm', -32, (o - 7),
          'h', 32,
          'v', 30
            + (hasEnable ? 16 : 0)
            + (hasSyncReset ? 16 : 0)
            + (hasSyncSet ? 16 : 0),
          'h', -32, 'z',
          'm', 0, 19, 6, 4, -6, 4, // wedge '>'
          ...(hasNegedge ? ['m', 0, -4, 'a', 3, 3, 0, 1, 1, -6, 0, 'a', 3, 3, 0, 1, 1, 6, 0, 'z', 'm', 0, 4] : []), // negedge clock bubble
          ...(hasEnable ? ['m', 0, 16] : []), // extra offset for enable
          ...(hasSyncReset ? ['m', 0, 16,
            ...(hasSyncResetPolarity ? ['m', 0, -4, 'a', 3, 3, 0, 1, 1, -6, 0, 'a', 3, 3, 0, 1, 1, 6, 0, 'z', 'm', 0, 4] : [])] : []), // extra offset for sync reset
          ...(hasAsyncReset ? [ // async reset/set wire extension
            'm', 0, 12 + (hasSyncSet ? 16 : 0),
            'h', 16,
            'm', 0, 0,
            'v', ...(hasAsyncResetPolarity ? [-3, 'm', -16, -9] : [-9, 'm', -16, -1])] : []
          ),
          ...(hasAsyncResetPolarity ? ['m', 16, 3, 'a', 3, 3, 0, 1, 1, 0, 6, 'a', 3, 3, 0, 1, 1, 0, -6, 'z'] : []) // low-active async reset/set bubble
        ]}],
        // FF label
        ['text', {x: -16, y: o + 4, class: 'bodylabel'}, 'DFF'],
        // enable label
        ...(hasEnable ? [['text', {x: -28, y: o + 36, class: 'bodylabel'}, 'E']] : []),
        // sync reset label
        ...(hasSyncReset ? [['text', {x: -28, y: o + 36 + (hasEnable ? 16 : 0), class: 'bodylabel'},
          hasSyncResetPolarity
            ? ['tspan', {'text-decoration': 'overline'}, (hasSyncSet ? 'P' : 'C')]
            : (hasSyncSet ? 'P' : 'C')
        ]] : []),
        // sync preset value label
        ...(hasSyncSet ? [['text', {x: -28, y: o + 36 + (hasEnable ? 16 : 0) + 16, class: 'bodylabel'}, 'V']] : []),
        // async reset label
        ...(hasAsyncReset ? [['text', {x: -16, y: (o + 16 + 5 +(hasEnable ? 16 : 0) + (hasSyncReset ? 16 : 0) + (hasSyncSet ? 16 : 0)), class: 'bodylabel'},
          (hasAsyncResetPolarity
            ? ['tspan', {'text-decoration': 'overline'}, (hasAsyncSet ? 'S' : 'R')]
            : (hasAsyncSet ? 'S' : 'R')
          )
        ]] : []),
        // async set value label
        ...(hasAsyncSet ? [['text', {x: -16, y: o + 36 + 16 + (hasEnable ? 16 : 0) + (hasSyncReset ? 16 : 0) + (hasSyncSet ? 16 : 0), class: 'bodylabel'}, 'INI']] : [])
      ];
    }
  }

  // Fold-immediate cones (see docs/fold-immediates.md) carry the literal
  // on attrs.imm; render it appended to the op symbol so the body reads
  // as `op imm`, e.g. `== 8'h55` or `<< 32'sh3`.
  const label = (attrs && attrs.imm) ? type + ' ' + attrs.imm : type;
  const bodyW = getLabelWidth(label, fontWidth);
  return ['g', {w: bodyW, h: 16},
    ['rect', {class: 'gate', x: -bodyW, y: -8, width: bodyW, height: 16}],
    ['text', {x: -bodyW / 2, y: 4, class: 'bodylabel'}, ...tspan.parse(label)]
  ];
}

module.exports = drawBody;
module.exports.isShape = type => gater1.is(type);
