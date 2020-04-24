'use strict';

var lib = require('../lib/');
var fs = require('fs');
var onml = require('onml');
var chai = require('chai');
var expect = chai.expect;

var dat = {
    'and'  : [['x', ['&', 'a', 'b']]],
    'and5' : [['x', ['&', 'a', 'b', 'c', 'd', 'e']]],
    'or'   : [['x', ['|', 'a', 'b']]],
    'xor'  : [['x', ['^', 'a', 'b']]],
    'nand' : [['x', ['~&', 'a', 'b']]],
    'nor'  : [['x', ['~|', 'a', 'b']]],
    'oa1'  : [['x', ['~|', 'a0', 'a1', 'a2', ['~&', 'a3', 'a4', 'a5']]]]
};

describe('basic', function () {
    it('renderAssign is function', function (done) {
        expect(lib.renderAssign).to.be.a('function');
        done();
    });
    var res = '<html><body>';
    Object.keys(dat).map(function (key, index) {
        it(key, function (done) {
            var src = dat[key];
            res += '<pre>' + JSON.stringify(src) + '</pre>\n';
            var svg = lib.renderAssign(index, {assign: src });
            res += onml.stringify(svg) + '\n';
            done();
        });
    });
    after(function () {
        res += '</body></html>';
        fs.writeFileSync('report.html', res, {encoding: 'utf8'});
    });
});

/* eslint-env mocha */
