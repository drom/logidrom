'use strict';

const renderAssign = require('./render-assign.js');

const logi2ml = (logi) => {
  const res = ['div', {class: 'logi'},
    ['div', {class: 'netlist'}, 'netlist']
  ];
  for (const module of logi.modules) {
    res.push(['div', {class: 'module'}, 'module ', module.name]);
    res.push(renderAssign(0, {assign: module.cones}));
  }
  return res;
};

module.exports = logi2ml;
