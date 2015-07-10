'use strict';

var draw_gate = require('./draw_gate');

function draw_boxes (tree, xmax) {
    var ret = ['g'], i, ilen, fx, fy, fname, spec = [];
    if (Object.prototype.toString.call(tree) === '[object Array]') {
        ilen = tree.length;
        spec.push(tree[0].name);
        spec.push([32 * (xmax - tree[0].x), 8 * tree[0].y]);
        for (i = 1; i < ilen; i++) {
            if (Object.prototype.toString.call(tree[i]) === '[object Array]') {
                spec.push([32 * (xmax - tree[i][0].x), 8 * tree[i][0].y]);
            } else {
                spec.push([32 * (xmax - tree[i].x), 8 * tree[i].y]);
            }
        }
        ret.push(draw_gate(spec));
        for (i = 1; i < ilen; i++) {
            ret.push(draw_boxes(tree[i], xmax));
        }
    } else {
        fname = tree.name;
        fx = 32 * (xmax - tree.x);
        fy = 8 * tree.y;
        ret.push(
            ['g', { transform: 'translate(' + fx + ',' + fy + ')'},
                ['title', fname],
                ['path', {d:'M 2,0 a 2,2 0 1 1 -4,0 2,2 0 1 1 4,0 z'}],
                ['text',
                    ['tspan', {
                        x:'-4', y:'4',
                        class:'pinname'},
                        fname
                    ]
                ]
            ]
        );
    }
    return ret;
}

module.exports = draw_boxes;
