'use strict';

const genSvg = require('./gen-svg.js');
const forest = require('./fir-forest.js');

const render = ast => genSvg(forest(ast));

module.exports = render;
