'use strict';

var render = require('./render');
var drawBoxes = require('./draw_boxes');
var insertSVGTemplateAssign = require('./insert-svg-template-assign.js');

function renderAssign (index, source) {
    var tree,
        state,
        xmax,
        svg = ['g'],
        grid = ['g'],
        // svgcontent,
        width,
        height,
        i,
        ilen,
        j,
        jlen;

    ilen = source.assign.length;
    state = { x: 0, y: 2, xmax: 0 };
    tree = source.assign;
    for (i = 0; i < ilen; i++) {
        state = render(tree[i], state);
        state.x++;
    }
    xmax = state.xmax + 3;

    for (i = 0; i < ilen; i++) {
        svg.push(drawBoxes(tree[i], xmax));
    }
    width  = 32 * (xmax + 1) + 1;
    height = 8 * (state.y + 1) - 7;
    ilen = 4 * (xmax + 1);
    jlen = state.y + 1;
    for (i = 0; i <= ilen; i++) {
        for (j = 0; j <= jlen; j++) {
            grid.push(['rect', {
                height: 1,
                width: 1,
                x: (i * 8 - 0.5),
                y: (j * 8 - 0.5),
                class: 'grid'
            }]);
        }
    }
    return ['svg', {
        id: 'svgcontent_' + index,
        viewBox: '0 0 ' + width + ' ' + height,
        width: width,
        height: height
    },
    insertSVGTemplateAssign(),
    ['g', {transform:'translate(0.5, 0.5)'}, grid, svg]
    ];
}

module.exports = renderAssign;

/* eslint-env browser */
