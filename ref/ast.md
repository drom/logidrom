# Logic AST specification

## About

## Node Types

### wire

Named signal.

```js
{
    type: 'wire',
    name: <String>
},
```

### const

Node holding a constant value.

```js
{
    type: 'const',
    value: <String>
},
```

### fn

Logic function with multiple inputs and a single output.

```js
{
    type: 'fn',
    operation: <String>,
    i: <Nodes>
}
```

### cell

Logic cell with multiple inputs and outputs.
May hold multiple functions / signals.
Rendered as a single rectangular block.

```js
{
    type: 'cell',
    i: <Node|Nodes>,
    o: <Node|Nodes>
}
```

### network

Multiple cells

```js
{
    type: 'network',
    body: <Cells>
}
```


