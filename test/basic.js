'use strict';

const fs = require('fs');
const onml = require('onml');
const chai = require('chai');

const lib = require('../lib/');

const expect = chai.expect;

var dat = {
  'and'  : [['x', ['&', 'a', 'b']]],
  'and5' : [['x', ['&', 'a', 'b', 'c', 'd', 'e']]],
  'or'   : [['x', ['|', 'a', 'b']]],
  'xor'  : [['x', ['^', 'a', 'b']]],
  'nand' : [['x', ['~&', 'a', 'b']]],
  'nor'  : [['x', ['~|', 'a', 'b']]],
  'oa1'  : [['x', ['~|', 'a0', 'a1', 'a2', ['~&', 'a3', 'a4', 'a5']]]],
  'const': [['foo', [42, 5]]]
};

describe('basic', function () {
  it('renderAssign is function', function (done) {
    expect(lib.renderAssign).to.be.a('function');
    done();
  });

  it('fir is function', function (done) {
    expect(lib.fir).to.be.a('function');
    done();
  });

  let res = '<html><head><style>body {background-color: #eee; }</style></head><body>';
  Object.keys(dat).map(function (key, index) {
    it(key, function (done) {
      const src = dat[key];
      res += '<pre>' + JSON.stringify(src, null, 4) + '</pre>\n';
      var svg = lib.renderAssign(index, {assign: src });
      res += onml.stringify(svg, 2) + '\n';
      res += '<hr>';
      done();
    });
  });
  after(function () {
    res += '</body></html>';
    fs.writeFileSync('report.html', res, {encoding: 'utf8'});
  });
});

/* eslint-env mocha */
