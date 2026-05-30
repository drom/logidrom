# List of basic functions

| name | symbol |
|------|--------|
| buf  | `1`    |
| inv  | `~`    |
| eq   | `=`    |
| and  | `&`    |
| nand | `~&`   |
| or   | `|`    |
| nor  | `~|`   |
| xor  | `^`    |
| xnor | `~^`   |
| add  | `+`    |
| mul  | `*`    |
| mux  | `?`    |
| dff  | `$dff` |

## structure

```js
[and, a, b, [or, c, [not, d]]]
```

## flip-flop

Flip-flops use a config object instead of positional inputs. Ports set to `null` or omitted are not drawn.

```js
['q', ['$dff', { d: 'din', clk: 'clock', r: 'reset' }]]
['q', ['$dff', { d: ['&', 'a', 'b'], clk: 'clk', s: 'set', r: 'rst', qn: 'q_bar' }]]
```

Supported ports:

| port  | description                              |
|-------|------------------------------------------|
| `d`   | data input                               |
| `clk` | clock input (drawn with triangle)        |
| `s`   | set input                                |
| `r`   | reset input                              |
| `qn`  | inverted output (drawn with bubble)      |

Any port value can be a sub-expression (e.g. `['&', 'a', 'b']`).
