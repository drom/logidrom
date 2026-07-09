'use strict';

const {expect} = require('chai');
const renderAssign = require('../lib/render-assign.js');

/* eslint-env mocha */

describe('render configuration (fontWidth and treeSpacing)', () => {
  it('should use default fontWidth (7.23) when not specified', () => {
    const source = {
      assign: [['=', 'output_signal', 'input_signal']],
      config: {}
    };

    const result = renderAssign(0, source);
    expect(result).to.be.an('array');
    expect(result[0]).to.equal('svg');
    // The SVG should have a width attribute
    const svgAttrs = result[1];
    expect(svgAttrs).to.have.property('width');
    expect(svgAttrs.width).to.be.a('number');
  });

  it('should use custom fontWidth when specified in config', () => {
    const source = {
      assign: [['=', 'output_signal', 'input_signal']],
      config: {
        fontWidth: 10  // Larger font width
      }
    };

    const result = renderAssign(0, source);
    expect(result).to.be.an('array');
    expect(result[0]).to.equal('svg');
    const svgAttrs = result[1];
    expect(svgAttrs).to.have.property('width');
    expect(svgAttrs.width).to.be.a('number');
  });

  it('should produce wider SVG with larger fontWidth', () => {
    const baseSource = {
      assign: [['=', 'long_output_name', 'input_signal']],
      config: {
        fontWidth: 7.23
      }
    };

    const wideSource = {
      assign: [['=', 'long_output_name', 'input_signal']],
      config: {
        fontWidth: 12  // Much larger font width
      }
    };

    const baseResult = renderAssign(0, baseSource);
    const wideResult = renderAssign(0, wideSource);

    const baseWidth = baseResult[1].width;
    const wideWidth = wideResult[1].width;

    // The SVG with larger fontWidth should be wider
    expect(wideWidth).to.be.greaterThan(baseWidth);
  });

  it('should use default treeSpacing (16) when not specified', () => {
    const source = {
      assign: [
        ['=', 'out1', 'in1'],
        ['=', 'out2', 'in2']
      ],
      config: {}
    };

    const result = renderAssign(0, source);
    expect(result).to.be.an('array');
    expect(result[0]).to.equal('svg');
    const svgAttrs = result[1];
    expect(svgAttrs).to.have.property('height');
    expect(svgAttrs.height).to.be.a('number');
  });

  it('should use custom treeSpacing when specified in config', () => {
    const source = {
      assign: [
        ['=', 'out1', 'in1'],
        ['=', 'out2', 'in2']
      ],
      config: {
        treeSpacing: 24  // Larger spacing
      }
    };

    const result = renderAssign(0, source);
    expect(result).to.be.an('array');
    expect(result[0]).to.equal('svg');
    const svgAttrs = result[1];
    expect(svgAttrs).to.have.property('height');
    expect(svgAttrs.height).to.be.a('number');
  });

  it('should produce taller SVG with larger treeSpacing', () => {
    const baseSource = {
      assign: [
        ['=', 'out1', 'in1'],
        ['=', 'out2', 'in2'],
        ['=', 'out3', 'in3']
      ],
      config: {
        treeSpacing: 16
      }
    };

    const tallerSource = {
      assign: [
        ['=', 'out1', 'in1'],
        ['=', 'out2', 'in2'],
        ['=', 'out3', 'in3']
      ],
      config: {
        treeSpacing: 32  // Double the spacing
      }
    };

    const baseResult = renderAssign(0, baseSource);
    const tallerResult = renderAssign(0, tallerSource);

    const baseHeight = baseResult[1].height;
    const tallerHeight = tallerResult[1].height;

    // The SVG with larger treeSpacing should be taller
    expect(tallerHeight).to.be.greaterThan(baseHeight);
  });
});
