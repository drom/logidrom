'use strict';

const w3 = require('./w3.js');

module.exports = body => {
  const attr = body[1];
  const w = Math.ceil(attr.w);
  const h = Math.ceil(attr.h);
  return ['svg',
    {
      xmlns: w3.svg, 'xmlns:xlink': w3.xlink,
      width: w, height: h,
      viewBox: '0 0 ' + w + ' ' + h
    },
    body
  ];
};
