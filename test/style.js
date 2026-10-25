'use strict';

const {expect} = require('chai');
const renderAssign = require('../lib/render-assign.js');

describe('style', () => {
  [0, 1, 7].forEach(index => {
    it('embeds <style> for index ' + index, () => {
      const res = renderAssign(index, {assign: [['out', ['&', 'a', 'b']]]});
      const styles = res.filter(e => Array.isArray(e) && e[0] === 'style');
      expect(styles).to.have.length(1);
      expect(styles[0][1]).to.include('.wire {fill:none');
    });
  });

  it('omits <style> when notFirstAssign', () => {
    const res = renderAssign(3, {assign: [['out', ['&', 'a', 'b']]]}, true);
    expect(res.some(e => Array.isArray(e) && e[0] === 'style')).to.equal(false);
  });
});
