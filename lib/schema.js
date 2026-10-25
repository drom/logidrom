'use strict';

// JSON Schema (draft-07) of the logidrom input: {assign: [...], config: {...}}
// Used by wavedrom-schema https://github.com/wavedrom/schema
// Keep in sync with: draw_body.js (gate types), tree-utils.js (attributes), render-assign.js (config)

const ref = name => ({$ref: '#/definitions/' + name});

const strOrNum = [{type: 'string'}, {type: 'number'}];

const attributes = {
  type: 'object',
  description: 'Node attributes (only as the second element)',
  properties: {
    width: {type: 'integer', minimum: 0, description: 'Bus width (0 - zero-width, 1 - scalar wire, >1 - vector bus)'},
    label: {type: 'string', description: 'Output label / tooltip'},
    dir: {enum: ['in', 'out'], description: 'Port direction, draws chevron-shaped port box'},
    instance: {type: 'string', description: 'Instance name (pin / pout / pinout)'},
    pin: {type: 'string', description: 'Pin name (pin / pout / pinout)'},
    imm: {oneOf: strOrNum, description: 'Folded immediate literal appended to the operator label, e.g. "8\'h55"'},
    module: {type: 'string', description: 'Source module (tooltip / cross-reference)'},
    name: {type: 'string', description: 'Source name (tooltip / cross-reference)'},
    loc: {type: 'string', description: 'Source location (tooltip / cross-reference)'},
    nodeId: {oneOf: strOrNum, description: 'Node id (cross-reference)'},
    siteKey: {oneOf: strOrNum, description: 'Site key (cross-reference)'}
  }
};

const assignTree = {
  title: 'logic expression',
  description: [
    'Logic expression tree: wire name (string) or ["op", {attributes}?, ...operands].',
    'Shape gates: & | ^ (AND OR XOR), ~& ~| ~^ (NAND NOR XNOR), ~ (NOT), buf1, + - * / %, aliases and or xor andr orr xorr add sub mul input;',
    'IEC boxes: BUF INV AND NAND OR NOR XOR XNOR eq ne slt sle sgt sge ult ule ugt uge box CONCAT case casez casex;',
    'MUX; flip-flops ff[n][e][c|p[n]][r|s[n]] (e.g. ff, ffe, ffr, ffnecrn); bit slice "[7:0]";',
    '"=" with name + expression ["=", "net", expr] labels an intermediate net;',
    'pin / pout / pinout with {"instance", "pin"} attributes draw module ports;',
    'any other string is drawn as a labeled box.'
  ].join('\n'),
  oneOf: [
    {type: 'string', description: 'Wire / input name'},
    {
      type: 'array',
      minItems: 1,
      items: {
        description: 'First item: operator (gate type) or output / leaf name; second item: optional attributes object; then operands',
        examples: ['&', '|', '^', '~', '~&', '~|', '~^', '+', '-', '*', '=', 'MUX', 'ff', 'ffe', 'ffr', 'CONCAT', 'eq', '[7:0]', 'pin', 'pout'],
        anyOf: [
          ref('assignTree'),
          attributes
        ]
      }
    }
  ]
};

module.exports = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  type: 'object',
  title: 'logic circuit',
  description: 'WaveDrom logic circuit (schematic) diagram\nhttps://wavedrom.com/tutorial2.html',
  required: ['assign'],
  properties: {
    assign: {
      type: 'array',
      description: 'List of assignments, one cone per item: ["out", expression], e.g. ["z", ["&", "a", ["~", "b"]]]',
      items: {
        description: 'Assignment cone ["out", expression]',
        allOf: [
          {type: 'array', minItems: 2},
          ref('assignTree')
        ],
        examples: [['z', ['&', 'a', ['~', 'b']]]]
      }
    },
    config: {
      type: 'object',
      description: 'Rendering options',
      properties: {
        fontWidth: {type: 'number', exclusiveMinimum: 0, default: 7.23, description: 'Average character width (px) used for label box sizing'},
        treeSpacing: {type: 'number', minimum: 0, default: 16, description: 'Vertical space (px) between assignment trees'}
      }
    }
  },
  definitions: {
    assignTree
  }
};
