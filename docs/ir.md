# Logidrom IR — `logidrom` / `wavedrom.assign`

The native **intermediate representation**. Source- and sink-agnostic. Every converter produces it; the renderer consumes it. See [`README.md`](README.md) for the three-layer context.

---

## 1. Design goals

- **Human-readable, human-writable.** A small regular grammar. You can paste an IR forest into a test file and read it back.
- **LLM-comprehensible.** Flat nested arrays, named operators, no cyclic structure, no sharing of references. `JSON.stringify` round-trips without loss.
- **Visual-language-mappable.** Every operator has a canonical symbol in [`symbols.md`](symbols.md).
- **Attr-graceful.** UI/UX-enriching attrs are **optional**; readers must tolerate their absence. Core attrs (width, dir, clock, reset) carry structure; optional attrs (label, fl, src, …) carry metadata for better UX but never change meaning.

---

## 2. Core grammar

```
forest = cone[]

cone   = [operator, attrs?, ...children]
child  = name | cone                         // bare string or nested cone (incl. leaf cones)
attrs  = { width?, dir?, label?, fl?, ... }

name   = string                              // signal / constant / literal name
```

- `operator` is always a string. It's either a gate type (e.g. `'AND'`, `'&'`, `'MUX'`), the assignment operator `'='`, a slice label `'[15:0]'`, a storage-element type (`'ff'`, `'ffr'`, `'latch'`, …), or — for a **leaf cone** — a signal / constant name.
- `attrs`, when present, is the value at index **1**, identified as a plain non-array object. Every other slot is a child.
- A single-slot cone (`[name]` — just an operator, no children, no attrs) is equivalent to the bare string `name`. A single-slot cone with attrs — `[name, {attrs}]` — is a **leaf cone** that carries extra metadata but still renders as a leaf.

### 2.1 Core attrs

| attr | type | role |
|---|---|---|
| `width` | int (default `1`) | bit-width of the signal carried by this cone |
| `dir`   | `'in' \| 'out' \| 'inout' \| null` | port direction (leaf cones and `=` roots only) |
| `gate`  | string | level-sensitive gate signal (on `latch` family) |

### 2.2 Optional (metadata) attrs

| attr | role | tolerable absence? |
|---|---|---|
| `label` | original source name kept when the displayed name is empty (temp wires — see §4.3) | yes |
| `fl`    | source file / line / col, `'file:line:col'` — for bi-directional nav | yes |
| `src`   | original source-code snippet (used by blackbox bodies and complex operators) | yes |
| `signed` | signedness hint for comparison / arithmetic operators | yes |
| `priority`, `unique`, `unique0` | boolean hints lifted from SV-2009 case modifiers onto `case` / `casez` / `casex` cones (see [symbols.md §2.6](symbols.md#26-multi-input-mux--priority-selector--case)). `priority` implies ordered evaluation; `unique`/`unique0` imply parallel mux synthesis. | yes |
| `fullCase`, `parallelCase` | boolean hints lifted from legacy Synopsys-branded comment pragmas (`// synopsys full_case` / `// synopsys parallel_case`). Distinct from the SV-2009 attrs above so the renderer / lint can mark the box differently (the pragma-based hint is the one Cummings / Mills recommend against). Whether the generic `// synthesis …` spelling and the SV `(* full_case, parallel_case *)` attribute survive to this attr is converter-dependent — a converter may strip them and emit no attr. | yes |
| `id`    | shared identifier across multiple cones derived from one source construct (e.g. all outputs of a blackbox) | yes |
| `nodeId` | fully-qualified signal path used by external tooling (VS Code `rtlviz`, etc.) for click-through navigation. Bare signal name at module scope, or `block_name.signal` / `block[i].signal` for signals declared inside labeled / indexed generate blocks. Exact qualification scheme is converter-defined | yes |
| `module` | name of the source module the signal belongs to; used alongside `nodeId` to disambiguate across module instances | yes |
| `name`   | bare signal name (pre-qualification). Paired with `nodeId` / `module` so consumers can reconstruct either the hierarchical path or the raw name without re-parsing | yes |
| `loc`    | converter-preserved source location in an opaque, converter-specific format (e.g. `"file,line:col,line:col"`) — a richer form of `fl`. Renderer exposes it verbatim as a DOM `data-loc` for tool integration | yes |

Readers **must** tolerate any optional attr being absent; writers **should** include `fl` whenever a source location is known.

### 2.3 `=` — assignment as a first-class operator

Top-level cones (one per driven signal) use `'='` so the format is uniform across roots and subtrees. Embedded `'='` mid-tree names an intermediate signal:

```
['=', {dir:'out'}, 'y', ['&', 'a', 'b']]                          // assign y = a & b
['=', {width:8}, 'y', ['CONCAT', ['=','t',['&','a','b']], 'c']]   // 't' named mid-tree
```

Exactly two children after attrs: the LHS name (slot at `firstChildIdx(tree)`) and the body expression. The LHS slot may be empty (`''`) for temp-wire cones — see §4.3.

---

## 3. Operator catalog (structural — not visual)

This table records which operators are part of the grammar. Shapes live in [`symbols.md`](symbols.md).

| category | operators | children |
|---|---|---|
| assignment | `=` | `name, body` (possibly with `attrs.label` for temp) |
| unary bitwise | `~`, `buf1` | 1 child |
| binary bitwise (chainable — see §5.2) | `&`, `\|`, `^` | 2+ children |
| reduction | `&1`, `\|1`, `^1` | 1 child |
| arithmetic | `+`, `-`, `*`, `/`, `%` | 2 children (`+` is chainable) |
| comparison | `EQ`, `NEQ`, `LT`, `LTS`, `LTE`, `GTE`, `GTS` | 2 children, output width 1 |
| shift | `SHIFTL`, `SHIFTR` | 2 children (value, shift-amount) |
| concatenation | `CONCAT` | 2+ children (chainable; MSB → LSB order preserved) |
| selection | `MUX` | 3 children: `sel, d0, d1` |
| multi-way | `pmux`, `case`, `casez`, `casex` | `pmux`: alternating `(cond, val)` pairs + optional trailing default. `case`/`casez`/`casex`: `[sel, (label, body)+, default?]` — selector is always the first child; labels are bare strings; trailing odd child is the default. See [symbols.md §2.6](symbols.md#26-multi-input-mux--priority-selector--case) |
| slice | `'[bit]'`, `'[msb:lsb]'` | 1 child (the source value); the operator string **is** the label |
| variable slice | `SEL` | 2 children (source, index) |
| extend / negate | `EXTEND`, `NEG`, `NEGATE` | 1 child |
| iec-boxed gates | `AND`, `NAND`, `OR`, `NOR`, `XOR`, `XNOR`, `BUF`, `INV` | 2+ children |
| storage — no reset | `ff`, `ffn` | 2 children: `data, clock` |
| storage — sync reset | `ffc`, `ffcn`, `ffnc`, `ffncn` | 3 children: `data, clock, syncRst` |
| storage — sync preset | `ffp`, `ffpn`, `ffnp`, `ffnpn` | 4 children: `data, clock, syncRst, presetValue` |
| storage — async reset | `ffr`, `ffrn`, `ffnr`, `ffnrn` | 3 children: `data, clock, asyncRst` |
| storage — async set | `ffs`, `ffsn`, `ffns`, `ffnsn` | 4 children: `data, clock, asyncRst, initValue` |
| storage — sync+async reset | `ffcr`, `ffcrn`, `ffcnr`, `ffcnrn` | 4 children: `data, clock, syncRst, asyncRst` |
| storage — sync preset+async | `ffpr`, `ffprn`, `ffpnr`, `ffpnrn` | 5 children: `data, clock, syncRst, presetValue, asyncRst` |
| storage — enable | `ffe`, `ffne` | 3 children: `data, clock, enable_expr` |
| storage — enable+sync reset | `ffec`, `ffecn`, `ffnec`, `ffnecn` | 4 children: `data, clock, enable_expr, syncRst` |
| storage — enable+sync preset | `ffep`, `ffepn`, `ffnep`, `ffnepn` | 5 children: `data, clock, enable_expr, syncRst, presetValue` |
| storage — enable+async reset | `ffer`, `ffern`, `ffner`, `ffnern` | 4 children: `data, clock, enable_expr, asyncRst` |
| storage — enable+async set | `ffes`, `ffesn`, `ffnes`, `ffnesn` | 5 children: `data, clock, enable_expr, asyncRst, initValue` |
| storage — enable+sync+async | `ffecr`, `ffecrn`, `ffecnr`, `ffecnrn` | 5 children: `data, clock, enable_expr, syncRst, asyncRst` |
| storage — enable+sync preset+async | `ffepr`, `ffeprn`, `ffepnr`, `ffepnrn` | 6 children: `data, clock, enable_expr, syncRst, presetValue, asyncRst` |
| storage — level | `latch`, `nlatch` | `(attrs.gate)` + `outname, body` |
| opaque | `blackbox` | `(attrs.id, reason, src?)` + variadic inputs (every read signal from the block); one cone per driven output |

**Notes:**

- **`enable_expr`:** The enable child in `ffe*` variants can be any cone (simple signal or complex expression like `['&', 'valid', ['[0]', 'mask']]`). The renderer draws combinational logic feeding the EN pin.

- **Sync reset positional order:** Sync reset always comes before async reset in the child list:
  - `['ffcr', data, clock, syncRst, asyncRst]` — sync first, then async
  - `['ffecr', data, clock, enable, syncRst, asyncRst]` — enable, then sync, then async

- **Preset values:** Both sync preset (`p`) and async set (`s`) require an additional value child:
  - Sync preset: `['ffp', data, clock, syncRst, presetValue]`
  - Async set: `['ffs', data, clock, asyncRst, initValue]`
  - Both: `['ffps', data, clock, syncRst, presetValue, asyncRst, initValue]`

- **Naming pattern:** `ff[n][e][cp][n][rs][n]` where components appear in strict order:
  1. `n` = negedge clock (optional)
  2. `e` = enable (optional)
  3. `c` or `p` = sync reset/preset (optional, mutually exclusive)
  4. `n` after `c/p` = active-low sync (optional)
  5. `r` or `s` = async reset/set (optional, mutually exclusive)
  6. `n` after `r/s` = active-low async (optional)

Leaf cones (signal / literal names) form the base case — either bare strings or `[name, attrs]` single-slot arrays.

---

## 4. Conventions

### 4.1 Leaf-cone detection

A cone is a leaf iff `tree.length === firstChildIdx(tree)`:

- `['a']` — a leaf cone with no attrs (equivalent to the bare string `'a'`).
- `['a', {dir:'in', width:8}]` — a leaf cone with attrs.

The helper `firstChildIdx(tree)` returns `2` when `tree[1]` is an attrs object, else `1`.

### 4.2 Post-layout annotations (not part of the IR on disk)

The renderer mutates cones to attach `fx`, `fy`, `x`, `y` for layout purposes. These are **transient**: they exist on an in-memory tree during rendering and are discarded. They do **not** appear in a serialized IR file. Converters must not emit them; tools exchanging IR must not persist them.

### 4.3 Temp-wire convention

Auto-generated names emitted by upstream tools (e.g. `_GEN_42`, `_T_17`, `__Vcellout__…`) clutter diagrams. Rule: when the LHS of an `=` cone matches the **temp pattern** (first character is `_`), the converter may emit

```
['=', {label: '_orig_name', width?, ...}, '', ...body]
```

with the LHS slot **empty** and the original name stashed in `attrs.label`. The renderer then displays the signal as an anonymous box mid-tree (tooltip reveals the name) but as the full name at the root of a cone. Exact rendering rules in [`symbols.md`](symbols.md#42-output--root----drawoutlabel) and [`symbols.md`](symbols.md#43-mid-tree---drawinlinebox).

Transformations that match producers by name (e.g. catenation, §5.3) use `attrs.label || bareName(LHS-slot)` as the lookup key so temp wires are matched by their original name.

### 4.4 Bit-widths

`attrs.width` is the number of bits the signal carries. Default is `1` when omitted. Writers should **omit** `width: 1` to keep the IR compact; readers should treat a missing `width` as `1`.

---

## 5. Canonical transformations (IR → IR)

All transformations are pure functions from a forest to a forest. They can be run in any order that respects their stated preconditions; converters typically run them in a fixed pipeline, but downstream tools may re-run or skip any of them.

### 5.1 Fuse — primitive folding

Fold simple primitive patterns into richer single-operators when they carry the same semantics:

```
['~', ['&', a, b]]  →  ['~&', a, b]    // NOT (AND) → NAND
['~', ['|', a, b]]  →  ['~|', a, b]    // NOR
['~', ['^', a, b]]  →  ['~^', a, b]    // XNOR
```

Prerequisite: the inner operator is directly under the `~` and has no other consumers (refcount 1 after catenation).

### 5.2 Chaining — binary → variadic

A uniform chain of the same binary operator flattens into a single variadic cone:

```
AND(AND(a, b), c)           → [&, a, b, c]
AND(a, AND(b, AND(c, d)))   → [&, a, b, c, d]
CONCAT(a, CONCAT(b, c))     → [CONCAT, a, b, c]    // operand order preserved (MSB → LSB)
```

Chainable operators: `&`, `|`, `^`, `+`, `CONCAT`. Non-commutative operators (`SUB`, `SHIFTL`, `EQ`, `NEQ`, …) are not flattened — associativity is explicit. Child attrs collapse into the parent's (parent's `width` wins for the result); per-operand widths on leaf cones stay intact.

### 5.3 Catenation — inline single-use intermediates

Producer-consumer inlining for internal signals that are referenced exactly once. Promotes a separate top-level cone into a mid-tree `=` at the single reference site:

```
// before
[['=', 't', ['&', 'a', 'b']],
 ['=', {dir:'out'}, 'y', ['|', 't', 'c']]]

// after
[['=', {dir:'out'}, 'y', ['|', ['=', 't', ['&', 'a', 'b']], 'c']]]
```

**Preconditions** for a producer to be inlined:
1. Its LHS has exactly one reference across all cone bodies.
2. Its attrs have no `dir` (internal signal, not an I/O port).

Producer lookup key: `attrs.label || bareName(LHS-slot)` (so temp wires with empty LHS still match).

### 5.4 Mux fusion — `mux` chain → `pmux`

A nested chain of 2:1 `MUX` cones with ≥ 3 levels, where each outer mux's false-branch is the next mux, folds into a single `pmux` (priority mux):

```
['mux', c3, v3, ['mux', c2, v2, ['mux', c1, v1, v0]]]
    ↓
['pmux', c3, v3, c2, v2, c1, v1, v0]
```

See [symbols.md §2.6](symbols.md#26-multi-input-mux--priority-selector--case) for the visual and the `pmux` cone shape.

### 5.5 Split — behavioral block decomposition

Takes a procedural block (multi-assignment, control-flow-bearing) and produces a forest of per-target cones via symbolic execution. Behavioral sources (SystemVerilog `always` / `initial`, FIRRTL's `when` / `otherwise`, Chisel emit, ...) all reuse the same split semantics; the source-specific walker lives in the producing converter.

---

## 6. Examples

### 6.1 Minimal

```js
// assign y = a & b;
[['=', 'y', ['&', 'a', 'b']]]
```

### 6.2 With port directions and widths

```js
[
  ['=', {dir:'out', width:8}, 'y',
    ['&', {width:8},
      ['a', {dir:'in', width:8}],
      ['b', {dir:'in', width:8}]]]
]
```

### 6.3 With a temp wire (named mid-tree)

```js
[
  ['=', {dir:'out'}, 'y',
    ['|',
      ['=', 't', ['&', 'a', 'b']],           // 't' reified mid-tree
      'c']]
]
```

### 6.4 With a temp-wire anonymized

```js
[
  ['=', {dir:'out'}, 'y',
    ['|',
      ['=', {label:'_GEN_42'}, '', ['&', 'a', 'b']],  // empty LHS, label carries the name
      'c']]
]
```

### 6.5 Sequential with async reset

```js
[
  ['=', {dir:'out', width:8}, 'q',
    ['ffr',
      ['+', {width:8}, 'q', '1'],      // data: q++ every cycle
      'clk',                            // clock signal
      'rst']]                           // reset signal (resets to 0)
]
```

---

## 7. What is **not** in the IR

- **Layout** — `x`, `y`, `fx`, `fy`. These are render-time decorations, assigned by the layout pass and discarded.
- **Timing / physical info** — the IR is structural. Any physical annotation lives in a sibling structure, not in the cone tree.
- **Module boundaries** — a forest is one module's worth of cones. Multi-module netlists are represented externally (typically `{modules: [{name, cones}, ...]}`).
- **Names for anonymous connections** — cones are connected by shared name strings. Anonymous wires in the source (between unnamed cones) don't appear in the IR at all; they become implicit child→parent edges.

---

## 8. IR-level invariants (conformance)

Writers must guarantee and readers may rely on:

1. **Every `=` cone has exactly two children after optional attrs**: the LHS name slot and the body. The LHS slot is a string (possibly empty) or a leaf-cone array. The body is a child (cone or bare name).
2. **No cycles.** A cone tree is a DAG in memory only via shared sub-references across different top-level cones; within a single tree, no node is its own ancestor. Self-reference on a target (e.g. in a latch) is expressed with a **leaf** that matches the target's name, not a back-pointer.
3. **Attrs is always an object at index 1**, or absent. It is never an array.
4. **Width consistency** is **not** enforced by the grammar — a chainable op may have mismatched child widths and a `width` parent attr that's different from any child. Transformations should respect semantic width rules (see §5), but the grammar is permissive.
5. **Bare strings as children** are treated as leaf cones with no attrs. A bare string and `[name]` are interchangeable; most writers emit bare strings for brevity.
