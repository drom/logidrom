'use strict';

const fs = require('fs');
const onml = require('onml');

const lib = require('../lib/');

var dat = {
  'mux2' : [['x', ['?', 'sel', 'a', 'b']]],
  'mux4' : [['x', ['?', 'sel', 'a', 'b', 'c', 'd']]],
  'mux8' : [['x', ['?', 'sel', 'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']]],
  'mux_nested' : [['x', ['?', 's', ['&', 'a', 'b'], 'c', 'd', 'e']]],
  'mux_asymmetric' : [['x', ['?', 's', ['&', 'a', 'b', 'c', 'd', 'e'], 'f', 'g', 'h']]],
  'mux_multi_wide' : [['x', ['?', 's', ['&', 'a0', 'a1', 'a2', 'a3', 'a4'], ['|', 'b0', 'b1', 'b2', 'b3'], ['&', 'c0', 'c1', 'c2'], 'd']]],
  'mux_tree' : [['x', ['?', 's1',
    ['?', 's0', 'a', 'b', 'c', 'd'],
    ['?', 's0', 'e', 'f', 'g', 'h'],
    ['?', 's0', 'i', 'j', 'k', 'l'],
    ['?', 's0', 'm', 'n', 'o', 'p']
  ]]]
};

describe('mux', function () {
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
    fs.writeFileSync('report_mux.html', res, {encoding: 'utf8'});
  });
});

/* eslint-env mocha */
