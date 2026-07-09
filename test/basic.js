'use strict';

const fs = require('fs');
const onml = require('onml');
const chai = require('chai');

const lib = require('../lib/');

const expect = chai.expect;

var dat = {
  // cone with input and output ports
  ports: `\
[["=", {"dir": "out"}, "yellow",
  ["&", ["red", {"dir": "in"}], ["green", {"dir": "in"}]]
]]`,
  // cone driving output port that is bound in the parent
  hier1: `\
[
  ["=", {}, "e1",
    ["pout", {"instance": "inst1", "pin": "EEE"},
      ["|", "AAA", "CCC"]
    ]
  ],
  ["=", {}, "e2",
    ["pout", {"instance": "inst1", "pin": "EEE"},
      ["MUX", "AAA", "CCC", "SEL"]
    ]
  ],
  ["=", {}, "e3",
    ["pout", {"instance": "inst1", "pin": "EEE"},
      ["ff", "AAA", "clk"]
    ]
  ]
]`,
  // cone is driven by input port that is bound in the parent
  hier2: `[
  ["=", "X",
    ["&",
      ["pin", {"instance": "u1", "pin": "a"},
        "A1"
      ],
      "B"
    ]
  ]
]`,
  // instance with input and output ports bound
  hier3: `[
  ["=", "X",
    ["pout", {"instance": "u1", "pin": "x"},
      ["&",
        ["pin", {"instance": "u1", "pin": "a"},
          "A1"
        ],
        "B"
      ]
    ]
  ]
]`,
  mmmux: `[["=", {"dir": "out"}, "y",
  ["MUX",
    ["MUX", "a", "b", "sel1"],
    ["=", "a_long_and_winding_name_over_the_driver_gate", ["&", "c", "d"]], "sel2"]]]`,
  and   : '[["x", ["&", "a", "b"]]]',
  and5  : '[["=", "x", ["|", "a", "b", "c", "d", "evolution"]]]',
  oax : `\
[["=", "abbobrcuca", ["|",
  "a",
  ["&",
    ["^", "b", "bobr"],
    "cuba",
    "canada"]]]]`,
  xor   : '[["x", ["^", "a", "b"]]]',
  nand  : '[["x", ["~&", "a", "b"]]]',
  nor   : '[["x", ["~|", "a", "b"]]]',
  oa1   : '[["x", ["~|", "a0", "a1", "a2", ["~&", "a3", "a4", "a5"]]]]',
  const : '[["foo", ["42", "5"]]]',
  ffs : `\
[["=", {"width": 8}, "q9", ["ff", {"width": 8},
  ["=", {"width": 8}, "q8", ["ffn", {"width": 8},
    ["=", {"width": 8}, "q7", ["ffr", {"width": 8},
      ["=", {"width": 8}, "q6", ["ffrn", {"width": 8},
        ["=", "q5", ["ffnr",
          ["=", "q4", ["ffnrn",
            ["=", "q3", ["ffs",
              ["=", "q2", ["ffsn",
                ["=", "q1", ["ffns",
                  ["=", "q0", ["ffnsn",
                    "foo", "clock", "resetn", "8'h88"
                  ]], "clock", "reset", "8'h77"
                ]], "clock", "resetn", "8'haa"
              ]], "clock", "reset", "8'h55"
            ]], "clock", "resetn"
          ]], "clock", "reset"
        ]], "clock", "resetn"
      ]], "clock", "reset"
    ]], "clock"
  ]], "clock"
]]]

`,
  ffe : `\
[["=", {"width": 8}, "q3", ["ffe", {"width": 8},
  ["=", {"width": 8}, "q2", ["ffne", {"width": 8},
    ["=", "q1", ["ffer",
      ["=", "q0", ["ffern",
        "data", "clock", "en1", "resetn"
      ]], "clock", "en2", "reset"
    ]], "clock", "en3"
  ]], "clock", "en4"
]]]

`,
  ffes : `\
[["=", {"width": 8}, "q1", ["ffes", {"width": 8},
  ["=", "q0", ["ffesn",
    "data", "clock", "enable", "resetn", "8'h42"
  ]], "clock", "enable", "reset", "8'haa"
]]]

`,
  // Instance pins as dedicated operators. Exercises the drawAssign pin/
  // pinout root path, leafDisplay for `pout`, and outDisplay for `pin` /
  // `pinout` (all composing "<instance>.<pin>" from attrs).
  pins : `\
[
  ["pin", {"instance": "u1", "module": "sub", "pin": "a", "width": 8},
    ["&", {"width": 8}, "x", "y"]],
  ["=", {"dir": "out", "width": 8}, "z",
    ["pout", {"instance": "u1", "module": "sub", "pin": "y", "width": 8}]],
  ["pinout", {"instance": "u1", "module": "sub", "pin": "io", "width": 4},
    "bus"]
]

`
};

describe('basic', function () {
  it('renderAssign is function', function (done) {
    expect(lib.renderAssign).to.be.a('function');
    done();
  });

  it('fir is function', function (done) {
    expect(lib.fir).to.be.a('function');
    done();
  });

  let res = '<html><head><style>body {background-color: #eee; }</style></head><body>';
  Object.keys(dat).map(function (key, index) {
    it(key, function (done) {
      const src = dat[key];
      res += '<pre>' + src + '</pre>\n';
      const parsedSrc = JSON.parse(src);
      var svg = lib.renderAssign(index, {assign: parsedSrc });
      res += onml.stringify(svg, 2) + '\n';
      res += '<hr>';
      done();
    });
  });
  after(function () {
    res += '</body></html>';
    fs.writeFileSync('report.html', res, {encoding: 'utf8'});
  });
});

/* eslint-env mocha */
