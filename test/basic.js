'use strict';

var lib = require('../lib'),
    and_gate = require('./and_gate.json'),
    expect = require('chai').expect;

describe('basic', function () {
    it('and_gate', function (done) {
        var res;
        res = lib(0, { assign: [['out', ['&', 'a', 'b']]]});
        expect(res).to.be.deep.equal(and_gate);
        done();
    });
});
