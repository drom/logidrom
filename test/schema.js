'use strict';

const Ajv = require('ajv');
const {expect} = require('chai');

const schema = require('../lib/schema.js');
const samples = require('./basic.js');

const good = {
  simple: {assign: [['out', ['|', ['&', 'a', 'b'], ['~', 'c']]]]},
  ellipsis: {assign: [['z', ['~&', ['~^', ['~', 'p0'], ['~', 'q0']], '...', ['~', '~en']]]]},
  mix: {
    assign: [
      ['q', ['ffer', ['MUX', 's', 'a', 'b'], 'en', 'rst']],
      ['y', {width: 8}, ['=', 'n1', ['+', ['[7:0]', 'a'], 'b']]],
      ['pout', {instance: 'u0', pin: 'o'}, ['eq', {imm: '8\'h55'}, 'x']],
      ['w', ['pin', {instance: 'u1', pin: 'i', dir: 'in'}]]
    ],
    config: {fontWidth: 7, treeSpacing: 24}
  }
};

const bad = {
  missing: {},
  notArray: {assign: 'y = a'},
  string: {assign: ['out']},
  single: {assign: [['out']]},
  op: {assign: [[true, 'a']]},
  dir: {assign: [['y', {dir: 'up'}, 'a']]},
  width: {assign: [['y', {width: -1}, 'a']]},
  fontWidth: {assign: [['y', 'a']], config: {fontWidth: 0}}
};

describe('schema', () => {
  const validate = new Ajv({strict: true}).compile(schema);
  const check = (data, expected) => {
    const res = validate(data);
    expect(res, JSON.stringify(validate.errors)).to.equal(expected);
  };
  Object.keys(samples).forEach(key => it('sample ' + key, () =>
    check({assign: JSON.parse(samples[key])}, true)));
  Object.keys(good).forEach(key => it(key, () => check(good[key], true)));
  Object.keys(bad).forEach(key => it('negative ' + key, () => check(bad[key], false)));
});
