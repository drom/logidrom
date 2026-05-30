'use strict';

const fs = require('fs');
const onml = require('onml');

const lib = require('../lib/');

var dat = {
  'dff_minimal': [['q', ['$dff', {d: 'din', clk: 'clock'}]]],
  'dff_with_reset': [['q', ['$dff', {d: 'din', clk: 'clock', r: 'reset'}]]],
  'dff_with_set_reset': [['q', ['$dff', {d: 'din', clk: 'clock', s: 'set', r: 'reset'}]]],
  'dff_full': [['q', ['$dff', {d: 'din', clk: 'clock', s: 'set', r: 'reset', qn: 'q_bar'}]]],
  'dff_with_qn': [['q', ['$dff', {d: 'din', clk: 'clock', qn: 'q_n'}]]],
  'dff_expr_input': [['q', ['$dff', {d: ['&', 'a', 'b'], clk: 'clock'}]]],
  'dff_expr_full': [['q', ['$dff', {d: ['|', 'x', 'y'], clk: 'clk', s: 'set', r: ['&', 'rst0', 'rst1'], qn: 'q_bar'}]]],
  'dff_mux_tree': [['q', ['$dff', {
    d: ['?', 's1',
      ['?', 's0', 'a', 'b', 'c', 'd'],
      ['?', 's0', 'e', 'f', 'g', 'h'],
      ['?', 's0', 'i', 'j', 'k', 'l'],
      ['?', 's0', 'm', 'n', 'o', 'p']
    ],
    clk: 'clk',
    r: 'reset'
  }]]]
};

describe('flop', function () {
  let res = '<html><head><style>body {background-color: #eee; }</style></head><body>';
  Object.keys(dat).map(function (key, index) {
    it(key, function (done) {
      const src = dat[key];
      res += '<h3>' + key + '</h3>\n';
      res += '<pre>' + JSON.stringify(src, null, 4) + '</pre>\n';
      var svg = lib.renderAssign(index, {assign: src });
      res += onml.stringify(svg, 2) + '\n';
      res += '<hr>';
      done();
    });
  });
  after(function () {
    res += '</body></html>';
    fs.writeFileSync('report_flop.html', res, {encoding: 'utf8'});
  });
});

/* eslint-env mocha */
