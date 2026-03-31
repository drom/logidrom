# logidrom

[![NPM Version](https://img.shields.io/npm/v/logidrom.svg)](https://www.npmjs.com/package/logidrom)
[![Build Status](https://github.com/drom/logidrom/workflows/Node.js%20CI/badge.svg)](https://github.com/drom/logidrom/actions)

Digital logic circuit rendering engine.

## Overview

**logidrom** is a JavaScript library designed to render digital logic circuits as high-quality SVG diagrams. It can be used both in Node.js and directly in the browser.

## Features

- **Simple JSON API**: Define your logic using a straightforward nested array structure.
- **Rich Component Library**: Supports a wide range of standard logic gates (AND, OR, XOR, etc.) and complex components (DFFs, MUXs).
- **JavaScript to Logic**: Can convert JavaScript expressions into logic diagrams using a built-in AST walker.
- **Customizable Styling**: Diagrams are rendered as SVGs and can be styled with CSS.
- **High Performance**: Optimized for fast rendering of large circuit diagrams.

## Installation

```bash
npm install logidrom
```

## Usage

### Basic Logic Rendering

You can define a set of assignments where each assignment maps an output to a logic expression.

```javascript
const logidrom = require('logidrom');
const onml = require('onml');

const source = {
  assign: [
    ['x', ['&', 'a', 'b']],         // x = a AND b
    ['y', ['~|', 'c', 'd', 'e']]   // y = NOR(c, d, e)
  ]
};

const svg = logidrom.renderAssign(0, source);
const svgString = onml.stringify(svg);

console.log(svgString);
```

### Supported Gate Symbols

| Symbol | Gate |
| :---: | :--- |
| `&` | AND |
| `~&` | NAND |
| `\|` | OR |
| `~\|` | NOR |
| `^` | XOR |
| `~^` | XNOR |
| `=` | BUF / Input |
| `~` | INV / NOT |
| `+` | Adder / Add |
| `-` | Subtractor / Sub |
| `*` | Multiplier / Mul |

### JavaScript Expression Rendering

`logidrom` can also take a JavaScript AST and render it as a logic circuit.

```javascript
const esprima = require('esprima');
const logidrom = require('logidrom');
const onml = require('onml');

const code = 'x = (a & b) | (c ^ d);';
const ast = esprima.parse(code);

const svg = logidrom.r(ast, { index: 0 });
console.log(onml.stringify(svg));
```

## Development

### Prerequisites

- Node.js (v18+)
- npm

### Setup

```bash
git clone https://github.com/drom/logidrom.git
cd logidrom
npm install
```

### Running Tests

```bash
npm test
```

### Building for Browser

```bash
npm run prepublish
```
This will generate `build/logidrom.js`.

## License

MIT License. See [LICENSE.md](LICENSE.md) for details.
