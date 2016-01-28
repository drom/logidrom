'use strict';

var lib = require('../lib/render-assign'),
    fs = require('fs'),
    onml = require('onml'),
    // jsof = require('jsof'),
    esprima = require('esprima'),
    expect = require('chai').expect;

var w3 = {
    svg: 'http://www.w3.org/2000/svg',
    xlink: 'http://www.w3.org/1999/xlink',
    xmlns: 'http://www.w3.org/XML/1998/namespace'
};

var dat = {
    'and'  : [['x', ['&', 'a', 'b']]],
    'and5' : [['x', ['&', 'a', 'b', 'c', 'd', 'e']]],
    'or'   : [['x', ['|', 'a', 'b']]],
    'xor'  : [['x', ['^', 'a', 'b']]],
    'nand' : [['x', ['~&', 'a', 'b']]],
    'nor'  : [['x', ['~|', 'a', 'b']]],
    'oa1'  : [['x', ['~|', 'a0', 'a1', 'a2', ['~&', 'a3', 'a4', 'a5']]]],
};

describe('basic', function () {
    it('basic', function (done) {
        var res = '<html><body>';
        Object.keys(dat).forEach(function (t, index) {
            var src = dat[t]
            res += '<pre>' + JSON.stringify(src) + '</pre>\n';
            // res += '<pre>' + src + '</pre>\n';
            // var ast = esprima.parse(src);
            // var dst = lib(ast, {index: index});
            var dst = lib(index, {assign: src });
            var svg = ['svg', {id: 'svgcontent_' + index, xmlns: w3.svg, 'xmlns:xlink': w3.xlink, overflow:'hidden'}, ['style', '.pinname {font-size:12px; font-style:normal; font-variant:normal; font-weight:500; font-stretch:normal; text-align:center; text-anchor:end; font-family:Helvetica} .wirename {font-size:12px; font-style:normal; font-variant:normal; font-weight:500; font-stretch:normal; text-align:center; text-anchor:start; font-family:Helvetica} .wirename:hover {fill:blue} .gate {color:#000; fill:#ffc; fill-opacity: 1;stroke:#000; stroke-width:1; stroke-opacity:1} .gate:hover {fill:red !important; } .wire {fill:none; stroke:#000; stroke-width:1; stroke-opacity:1} .grid {fill:#fff; fill-opacity:1; stroke:none}'], dst];
            res += onml.stringify(svg) + '\n';
        });
        res += '</body></html>';
        fs.writeFile('report.html', res, {encoding: 'utf8'}, done);
    });
});
