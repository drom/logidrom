'use strict';

// All logic layout coordinates are intended to live on an integer grid.
// Use an even integer character width so that label box widths and their
// midpoints (used for centering text) also fall on integer coordinates.
const CHAR_WIDTH_PX = 7.23;

const getLabelWidth = (s, fontWidth) => {
  const charWidth = (fontWidth !== undefined) ? fontWidth : CHAR_WIDTH_PX;
  return Math.ceil(((String(s).length + 0.3) * charWidth) / 8) * 8;
};

exports.CHAR_WIDTH_PX = CHAR_WIDTH_PX;
exports.getLabelWidth = getLabelWidth;
