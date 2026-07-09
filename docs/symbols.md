# Logidrom Visual Language — Symbols & UI/UX

This document is the canonical reference for the **visual vocabulary** used by the logidrom renderer. It describes what each symbol looks like, what data-model operator(s) map to it, and the UI conventions around labels, tooltips, and color.

Data model is specified in [`ir.md`](ir.md). Layout math, slack, and rendering pipeline are in [`rendering.md`](rendering.md). This file only covers what the user sees.

See [`README.md`](README.md) for the three-layer context (converters / IR / rendering).

---

## 1. Visual conventions

* **Grid:** 32 px horizontal, 16 px vertical between rows of leaves. All bodies left-extend from the gate position (output pin = right edge of body).
* **Wire width:** `.scalar` 1 px, `.vector` 3 px (multi-bit), `.zeroer` 0.5 px dashed. Applied per-wire from the `width` attr on the source cone.
* **Font:** monospace, 12 px. Fixed-pitch so width math is just `charCount × CHAR_WIDTH_PX`.
* **Color palette:**
  * gate bodies — `.gate` (colored fill, hover highlight)
  * signal label boxes — `.siglabel` (light gray/yellow fill, thin border)
  * inline slice labels — `.slicelabel` (no box, white stroke-outline text so it's readable when sitting on a wire)
  * wire — black stroke
* **Tooltips:** native SVG `<title>` child. Used for multi-bit width readout, original names of renamed / temp signals, and full descriptions of compact symbols.

---

## 2. Operator families

### 2.1 Combinational gates (`gater1` — shape gates)

IEEE/ANSI distinctive-shape symbols. Left edge is the input back; right tip is the output pin (= logidrom gate position).

| operator | RTL / source | visual | notes |
|---|---|---|---|
| `buf1` | identity / `assign` buffer | right-pointing triangle with a tail | baseline buffer shape |
| `~`    | `~a` / `NOT`          | `buf1` + bubble on output | inverter |
| `&`    | `a & b` / `AND`       | D-shape, flat back, rounded front | |
| `~&`   | `NAND`                | `&` + bubble | |
| `\|`    | `a \| b` / `OR`        | curved back, pointed front | |
| `~\|`   | `NOR`                 | `\|` + bubble | |
| `^`    | `a ^ b` / `XOR`       | OR with an extra curve | |
| `~^`   | `XNOR`                | `^` + bubble | |
| `&1`, `|1`, `^1` | reduction ops (`REDAND` / `REDOR` / `REDXOR`) | the same shapes scaled to 1-input form | input is one vector, output is 1 bit; the `1` suffix lets `draw_body` pick the narrower 1-input shape |
| `+`, `-`, `*` | `ADD` / `SUB` / `MUL` | circle with inline glyph (`+`, `-`, `*`) | arithmetic on vectors |

**Variadic extension.** For 3+ inputs on any shape gate, the back edge grows: two vertical line segments are drawn at `x = gateX - 16`, one from `ymin` up to the natural body top (`gateY - 10`) and one from `gateY + 10` down to `ymax`. The natural D-shape stays intact in the middle and the extension flows out of it.

### 2.2 Combinational gates (`gater2` — IEC/IEEE 91 boxes)

Rectangular IEC 60617-12 / IEEE 91 boxes with a text mnemonic centered. Stretch vertically to fit any input count — no extension lines needed.

| operator | label in box | meaning |
|---|---|---|
| `AND`, `NAND` | `&` | and (optionally inverted) |
| `OR`, `NOR`   | `≥1` | at-least-one |
| `XOR`, `XNOR` | `=1` | odd parity |
| `BUF`, `INV`  | `1` | identity (optionally inverted) |
| `MUX`         | `M` | dedicated mux shape (see §2.5) |
| `eq`, `ne`    | `==`, `!=` | equality |
| `slt`/`sle`/`sgt`/`sge` | `<`, `<=`, `>`, `>=` | signed comparison |
| `ult`/`ule`/`ugt`/`uge` | same glyphs | unsigned comparison |
| `CONCAT`      | `}` | bit concatenation (variadic; order MSB → LSB) |

Negated (`NAND`, `NOR`, `XNOR`, `INV`) get an output bubble. Signed vs unsigned comparisons use the same glyph — the difference lives in the `attrs.signed` (future) or by convention in the operator name.

### 2.3 Slice / bit-select

Constant selects render as **bracket text inline on the wire** — no background box. The source's `width` class colors the wire on the input side; the result width colors the output.

```
═══════[7]─────   // single bit
═══════[15:0]──   // range
═══════[3]═════   // packed-array element (declElWidth > 1)
```

Operator string in the data model is literally the bracket text (e.g. `'[7]'`, `'[15:0]'`). For variable selects (non-constant index), the operator stays `'SEL'` and renders as a normal fallback rect; the two inputs are the source vector and the index expression.

### 2.4 Generic operator fallback

Any operator that isn't in `gater1` / `gater2` / slice / MUX / FF / `=` falls into a text-labeled rect via `draw_body.js` fallback: `.gate`-styled rect extending leftward, `.bodylabel` text centered inside. Covers:

`NEG`, `SEL` (variable), `EXTEND`, `SHIFTL`, `SHIFTR`, `REPLICATE`, `ARRAYSEL`, and anything else with no predefined shape. The symbol grows to accommodate the label.

### 2.5 Multiplexer (2:1)

2:1 mux — dedicated trapezoid shape with `'0'` and `'1'` labels at each data input:

```
    ┌─╲
 0 ─┤  ╲
    │   ├── Y
 1 ─┤  ╱
    └─╱
    ↑
    sel (comes in from the top)
```

Operator `MUX`. Input order in the cone: `[sel, d0, d1]` (converters map a ternary / conditional `COND` to this shape).

### 2.6 Multi-input mux / priority selector / case

**Problem.** Chisel / CIRCT-style generated Verilog decomposes every `Mux()` chain into a staircase of 2-input ternary expressions with a temp wire per level:

```verilog
wire _T_1 = c1 ? a : b;
wire _T_2 = c2 ? c : _T_1;
wire _T_3 = c3 ? d : _T_2;
assign y = _T_3;
```

After catenation this becomes a nested `['mux', c3, 'd', ['mux', c2, 'c', ['mux', c1, 'a', 'b']]]`. Rendered as-is that's **three** stacked trapezoids just to express a single 4-way priority selection — visually noisy and wastes vertical real estate. Native Verilog `if / else if / else` chains, `case`, `casez`, `casex` all share this shape.

**What industry / IEC does.** There is no single established symbol; conventions vary:

| source | how it draws N-way selection |
|---|---|
| IEC 60617-12 / IEEE 91 | A single trapezoid / rectangle labeled `MUX`. Control inputs `G0…Gn-1` on top (binary-encoded select); data inputs `D0…Dn-1` on left; one output. *No dedicated priority symbol* — priority chains are expected to be encoded via a priority encoder feeding a binary mux. |
| Yosys + netlistsvg | `$pmux` becomes a tall trapezoid with one `(sel, val)` pair per case stacked vertically; the select bits come in as a bus on top. |
| Xilinx / Altera schematic viewers | Flat rectangle with all pins listed, no visual priority cue — the designer reads pin names. |
| Cadence Genus / Synopsys DC post-synth views | Typically flattens to 2-input muxes; pre-synth RTL views show a `CASE` box with case labels as text. |
| Kicad / Altium | Generic rectangle with pin names. |

So there's no strong convention to mimic. logidrom can pick the cleanest thing.

**Goals for the logidrom symbol:**

1. Collapse a chain of ≥ 3 nested 2:1 muxes (or a `case` / `casez`) into a **single symbol**.
2. Distinguish **priority-encoded** (ordered) from **parallel** (one-hot / exhaustive `case`) visually so the reader spots race hazards.
3. Keep the footprint linear in the number of cases (unlike stacked 2:1s which also grow vertically, but with ~3× more chrome per case).
4. Preserve individual condition and value wires — each `(cond, val)` pair enters the body at its own row so the reader can hover or click a pin.

**Proposed symbols:**

| operator | when emitted | visual idea |
|---|---|---|
| `pmux`  | priority chain from `if / else if / else` or from a fused nested-`MUX` chain (catenation post-pass) | staircase trapezoid with a small **P** marker in the corner |
| `case`  | synthesized from Verilog `case` (exhaustive, no priority) | trapezoid with case-label text at each data row |
| `casez` | `casez` (don't-cares) | `case` symbol + small **Z** marker |
| `casex` | `casex` (X / Z don't-cares) | `case` symbol + small **X** marker |

#### 2.6.1 `pmux` — priority selector

```
        ┌─ P ─────╮
 c1 ────┤0       │
  a ────┤ ┐       │
 c2 ────┤1├      │
  b ────┤ │      ├──── y
 c3 ────┤2├      │
  c ────┤ │      │
        ├ ━ ━ ━ ━│  ← dashed bar marks "default below"
  d ────┤default│
        ╰──────╯
```

Shape is a **tall rectangle with a tapered (trapezoidal) right edge** so it still reads as "mux family". Each `(ci, vi)` pair takes one row on the left — condition on top, value below, numbered `0, 1, 2, …` top-to-bottom to emphasize the priority order. Default value gets a horizontal dashed separator above it. A small `P` label at the top-left corner is the "priority" discriminator vs. `case`.

**Cone shape (flat, alternating):**

```
['pmux', {width?},
  'c1', 'a',         // pair 0 — highest priority
  'c2', 'b',         // pair 1
  'c3', 'c',         // pair 2
   'd']              // default (odd-length tail)
```

Pair count = `Math.floor((children.length) / 2)`. If the child count is odd, the last child is the default. If even, default is implicit `x` / `0` (undefined-driven — emit a `<title>` warning).

#### 2.6.2 `case` — parallel / exhaustive selector

```
        sel
         │
        ┌┴─────────╮
 2'd0 ──┤ a        │
 2'd1 ──┤ b        │
 2'd2 ──┤ c        ├──── y
 2'd3 ──┤ d        │
        │          │
 dflt ──┤ e        │
        ╰──────────╯
```

Case labels live on the input edges as monospace text (`2'd0`, `3'b1??`, etc.). No `P` marker — rows are parallel, not priority.

**Cone shape** (resolved — selector is always the **first child**, matching `MUX`'s `[sel, d0, d1]` convention; keeps every cone-tree walker uniform and avoids the "attr-as-cone" special case):

```
['case', {width?, priority?, unique?, unique0?},
   sel,                   // selector cone or bare VARREF string
  '2\'d0', 'a',
  '2\'d1', 'b',
  '2\'d2', 'c',
  '2\'d3', 'd',
  'e']                    // default (trailing odd child when present)
```

- Labels are **bare strings** copied verbatim from the source constant (e.g. `"2'd0"`, `"4'b1???"`, `"4'b1xxx"`). `casez` patterns are round-tripped as `?`; `casex` patterns keep `x`/`z`/`?` as the user wrote them. (How a given converter normalizes `z` vs `?` is converter-defined.)
- **Multi-label items** (`2'd0, 2'd1: q = a;`) are **unrolled** at emission: each label gets its own `(label, body)` pair with the body cone repeated (shared reference in memory). One row per label.
- **Modifier attrs** are boolean hints that decorate the cone without changing its shape:
  - `priority` / `unique` / `unique0` — lifted from SV-2009 case modifiers (Cummings / Mills recommend these over the legacy pragmas).
  - `fullCase` / `parallelCase` — lifted from the legacy **Synopsys-branded** comment pragmas `// synopsys full_case` / `// synopsys parallel_case`. Distinct attr names from the SV-2009 family so a rendering pass can tag the box differently (e.g. `P`/`U`/`U0` for modern; `F`/`P` corner badge for the legacy pragma).
  - Whether the generic `// synthesis …` pragma spelling and the SV `(* full_case, parallel_case *)` attribute form reach these attrs is converter-dependent; a converter may strip them upstream so they never surface here.
- `getLabelWidth` counts `?` / `x` / `z` as regular characters — no special width accounting needed.

#### 2.6.3 When does a chain of `MUX` fuse into `pmux`?

A converter post-pass (after catenation) should walk the cone tree and convert:

```
['mux', c_n, v_n, ['mux', c_{n-1}, v_{n-1}, … ['mux', c_1, v_1, v_0] …]]
```

into:

```
['pmux', c_n, v_n, c_{n-1}, v_{n-1}, …, c_1, v_1, v_0]
```

Trigger threshold: only fuse when the chain has **≥ 3** `mux` links (so single ternary stays as `MUX`). Chain must be pure "else-branch" — i.e., each outer mux's `false` child is the next mux. `true` children are the per-priority values. This is exactly the shape Chisel / CIRCT generates.

Parallel `case` / `casez` / `casex` comes from the source directly (a converter lowering a case statement). A `priority case` is emitted as a `case` cone carrying `attrs.priority = true` rather than a `pmux`; `pmux` stays reserved for the nested-MUX fusion shape above.

#### 2.6.4 What about `if (onehot[0]) y = a; else if (onehot[1]) y = b;`?

Looks like `pmux` syntactically but is parallel if the conditions are mutually exclusive. Without formal analysis we can't tell from the source, so default to `pmux`. Users who want `case`-flavor rendering write a Verilog `case` explicitly.

---

## 3. Storage elements (D flip-flop family)

**All FFs are drawn with a body following IEEE 91 / IEC 60617-12 conventions:**

* Rectangular body
* Data input (D) on the left above the clock marker.
* Output (Q) on the right at the same vertical level as the data input.
* clock input marked with a **small right-pointing triangle** on the left edge (the "dynamic input" indicator).
* Negedge clock → bubble on the triangle (inverter).
* Async reset (if any) as a dedicated pin below the clock, with the letter **R** in the pin so it's visually distinct from the data inputs. connected to the reset signal.
* If async reset value is not 0, then async "set" pin with the letter **S** in the pin, and additional pin with the letter **I** connected to constant "initial value".
* Active-low async reset → bubble on the reset/set pin.

### 3.1 Naming pattern

All FF operator names follow a strict hierarchical pattern:

```
ff[n][e][c|p][n][r|s][n]
```

**Position 1: Clock edge** (immediately after `ff`)
- *(empty)* = posedge clock (rising edge)
- `n` = negedge clock (falling edge)

**Position 2: Clock enable**
- *(empty)* = no clock enable
- `e` = clock enable present

**Position 3: Synchronous reset/preset** (mutually exclusive)
- *(empty)* = no sync reset
- `c` = sync reset to zero (clear)
- `p` = sync preset to non-zero value

**Position 4: Sync reset polarity** (only if position 3 is `c` or `p`)
- *(empty)* = active-high sync reset
- `n` = active-low sync reset

**Position 5: Asynchronous reset/set** (mutually exclusive)
- *(empty)* = no async reset
- `r` = async reset to zero
- `s` = async set to non-zero value

**Position 6: Async reset polarity** (only if position 5 is `r` or `s`)
- *(empty)* = active-high async reset
- `n` = active-low async reset

**Constraints:**
- Can't have both `c` and `p` (sync reset and sync preset are mutually exclusive)
- Can't have both `r` and `s` (async reset and async set are mutually exclusive)
- Sync reset (`c`/`p`) always comes before async reset (`r`/`s`) in the name
- Enable (`e`) always comes before sync and async reset controls

**Examples:**
```
ff        — posedge, no controls
ffn       — negedge, no controls
ffe       — posedge + enable
ffc       — posedge + sync reset to 0
ffp       — posedge + sync preset to non-zero
ffr       — posedge + async reset to 0
ffec      — posedge + enable + sync reset
ffcr      — posedge + sync reset + async reset
ffecr     — posedge + enable + sync reset + async reset
ffeprn    — posedge + enable + sync preset + async reset (active-low)
ffnecnrn  — negedge + enable + sync reset (active-low) + async reset (active-low)
```

### 3.2 Base FF variants (no enable, no sync reset)

| Operator  | Clock Edge | Async Reset | Sensitivity List | Positional Children |
|-----------|-----------|-------------|------------------|---------------------|
| `ff`      | posedge   | none        | `@(posedge clk)` | `[data, clock]` |
| `ffn`     | negedge   | none        | `@(negedge clk)` | `[data, clock]` |
| `ffr`     | posedge   | high        | `@(posedge clk or posedge rst)` | `[data, clock, asyncRst]` |
| `ffrn`    | posedge   | low         | `@(posedge clk or negedge rstn)` | `[data, clock, asyncRstn]` |
| `ffnr`    | negedge   | high        | `@(negedge clk or posedge rst)` | `[data, clock, asyncRst]` |
| `ffnrn`   | negedge   | low         | `@(negedge clk or negedge rstn)` | `[data, clock, asyncRstn]` |
| `ffs`     | posedge   | high (set)  | `@(posedge clk or posedge rst)` | `[data, clock, asyncRst, initValue]` |
| `ffsn`    | posedge   | low (set)   | `@(posedge clk or negedge rstn)` | `[data, clock, asyncRstn, initValue]` |
| `ffns`    | negedge   | high (set)  | `@(negedge clk or posedge rst)` | `[data, clock, asyncRst, initValue]` |
| `ffnsn`   | negedge   | low (set)   | `@(negedge clk or negedge rstn)` | `[data, clock, asyncRstn, initValue]` |

**Notes:**
- `r` suffix = async reset to zero (no init value needed)
- `s` suffix = async set to non-zero (requires `initValue` child)
- `n` suffix on reset = active-low
- All children are positional (no attrs dict between operator and children)

**Data model examples:**
```javascript
['ff',    data, clock]                      // no reset
['ffr',   data, clock, rst]                 // async reset to 0
['ffrn',  data, clock, rstn]                // active-low async reset
['ffs',   data, clock, rst, '8'h42']        // async set to 0x42
```

Detecting an async reset and lifting it into an `ffr` / `ffs` variant is converter-specific logic (documented by each converter).

### 3.3 Synchronous reset/preset variants

**Key distinction:** Synchronous reset/preset signals do NOT appear in the sensitivity list — they only affect the FF behavior on the active clock edge. Async reset DOES appear in the sensitivity list (`or posedge rst`).

Synchronous reset is lifted into dedicated FF operators (unlike the older approach where it stayed as a MUX). The sync reset control comes BEFORE async reset in both the operator name and the positional children list.

#### 3.3.1 Sync reset to zero (c variants)

| Operator  | Clock | Enable | Sync Rst | Positional Children |
|-----------|-------|--------|----------|---------------------|
| `ffc`     | pos   | —      | high     | `[data, clock, syncRst]` |
| `ffcn`    | pos   | —      | low      | `[data, clock, syncRstn]` |
| `ffnc`    | neg   | —      | high     | `[data, clock, syncRst]` |
| `ffncn`   | neg   | —      | low      | `[data, clock, syncRstn]` |

**Verilog example:**
```verilog
always @(posedge clk)
  if (rst) q <= 8'h00;    // ffc: sync reset to zero
  else q <= d;
```

#### 3.3.2 Sync preset to non-zero (p variants)

| Operator  | Clock | Enable | Sync Preset | Positional Children |
|-----------|-------|--------|-------------|---------------------|
| `ffp`     | pos   | —      | high        | `[data, clock, syncRst, presetValue]` |
| `ffpn`    | pos   | —      | low         | `[data, clock, syncRstn, presetValue]` |
| `ffnp`    | neg   | —      | high        | `[data, clock, syncRst, presetValue]` |
| `ffnpn`   | neg   | —      | low         | `[data, clock, syncRstn, presetValue]` |

**Verilog example:**
```verilog
always @(posedge clk)
  if (rst) q <= 8'hAA;    // ffp: sync preset to 0xAA
  else q <= d;
```

**Note:** The sync preset value is a positional child (4th position), allowing any constant expression.

#### 3.3.3 Sync + Async reset combinations

| Operator  | Sync | Async | Positional Children |
|-----------|------|-------|---------------------|
| `ffcr`    | c    | r     | `[data, clock, syncRst, asyncRst]` |
| `ffcrn`   | c    | rn    | `[data, clock, syncRst, asyncRstn]` |
| `ffcnr`   | cn   | r     | `[data, clock, syncRstn, asyncRst]` |
| `ffcnrn`  | cn   | rn    | `[data, clock, syncRstn, asyncRstn]` |
| `ffpr`    | p    | r     | `[data, clock, syncRst, presetValue, asyncRst]` |
| `ffprn`   | p    | rn    | `[data, clock, syncRst, presetValue, asyncRstn]` |
| `ffpnr`   | pn   | r     | `[data, clock, syncRstn, presetValue, asyncRst]` |
| `ffpnrn`  | pn   | rn    | `[data, clock, syncRstn, presetValue, asyncRstn]` |
| `ffcs`    | c    | s     | `[data, clock, syncRst, asyncRst, asyncInitValue]` |
| `ffps`    | p    | s     | `[data, clock, syncRst, presetValue, asyncRst, asyncInitValue]` |

**Verilog example:**
```verilog
always @(posedge clk or posedge async_rst)
  if (async_rst) q <= 8'h00;      // async has priority (in sensitivity)
  else if (sync_rst) q <= 8'h00;  // sync checked on clock edge
  else q <= d;                    // ffcr: sync + async both reset to 0
```

**Priority rule:** Async reset (in sensitivity list) takes priority over sync reset (checked on clock edge).

**Positional order invariant:**
```
data, clock, [syncRst, [syncPresetValue]], [asyncRst, [asyncInitValue]]
```

Sync reset signals/values always appear before async reset signals/values in the children list.

Detecting a sync reset/preset and lifting it into an `ffc` / `ffp` variant is converter-specific logic (documented by each converter).

### 3.4 Clock enable (CE) variants

Clock enable is a synchronous control that gates when the FF loads new data. The enable condition is checked on the active clock edge. The `e` code appears immediately after the clock edge indicator in the operator name.

**Symbol:** Same rectangle as standard FF, but with an **EN** pin on the side. The enable input can be:
- A simple signal (shown connected directly to EN)
- A complex expression (shown as combinational logic feeding into EN)

#### 3.4.1 Enable-only variants

| Operator  | Clock | Enable | Positional Children |
|-----------|-------|--------|---------------------|
| `ffe`     | pos   | yes    | `[data, clock, enable]` |
| `ffne`    | neg   | yes    | `[data, clock, enable]` |

**Verilog example:**
```verilog
// Simple enable
always @(posedge clk)
  if (en) q <= d;           // ffe

// Complex enable expression
always @(posedge clk)
  if (valid & mask[0]) q <= d;   // ffe with enable = ['&', 'valid', ['[0]', 'mask']]
```

#### 3.4.2 Enable + Async reset variants

| Operator  | Clock | Enable | Async | Positional Children |
|-----------|-------|--------|-------|---------------------|
| `ffer`    | pos   | yes    | r     | `[data, clock, enable, asyncRst]` |
| `ffern`   | pos   | yes    | rn    | `[data, clock, enable, asyncRstn]` |
| `ffner`   | neg   | yes    | r     | `[data, clock, enable, asyncRst]` |
| `ffnern`  | neg   | yes    | rn    | `[data, clock, enable, asyncRstn]` |
| `ffes`    | pos   | yes    | s     | `[data, clock, enable, asyncRst, initValue]` |
| `ffesn`   | pos   | yes    | sn    | `[data, clock, enable, asyncRstn, initValue]` |
| `ffnes`   | neg   | yes    | s     | `[data, clock, enable, asyncRst, initValue]` |
| `ffnesn`  | neg   | yes    | sn    | `[data, clock, enable, asyncRstn, initValue]` |

**Verilog example:**
```verilog
always @(posedge clk or posedge rst)
  if (rst) q <= 8'h00;
  else if (en) q <= d;      // ffer: enable + async reset
```

#### 3.4.3 Enable + Sync reset variants

| Operator  | Sync | Positional Children |
|-----------|------|---------------------|
| `ffec`    | c    | `[data, clock, enable, syncRst]` |
| `ffecn`   | cn   | `[data, clock, enable, syncRstn]` |
| `ffep`    | p    | `[data, clock, enable, syncRst, presetValue]` |
| `ffepn`   | pn   | `[data, clock, enable, syncRstn, presetValue]` |

**Verilog example:**
```verilog
always @(posedge clk)
  if (sync_rst) q <= 8'h00;
  else if (en) q <= d;      // ffec: enable + sync reset
```

#### 3.4.4 Enable + Sync + Async reset variants

| Operator  | Sync | Async | Positional Children |
|-----------|------|-------|---------------------|
| `ffecr`   | c    | r     | `[data, clock, enable, syncRst, asyncRst]` |
| `ffecrn`  | c    | rn    | `[data, clock, enable, syncRst, asyncRstn]` |
| `ffecnr`  | cn   | r     | `[data, clock, enable, syncRstn, asyncRst]` |
| `ffecnrn` | cn   | rn    | `[data, clock, enable, syncRstn, asyncRstn]` |
| `ffepr`   | p    | r     | `[data, clock, enable, syncRst, presetValue, asyncRst]` |
| `ffeprn`  | p    | rn    | `[data, clock, enable, syncRst, presetValue, asyncRstn]` |
| `ffepnr`  | pn   | r     | `[data, clock, enable, syncRstn, presetValue, asyncRst]` |
| `ffepnrn` | pn   | rn    | `[data, clock, enable, syncRstn, presetValue, asyncRstn]` |

**Verilog example:**
```verilog
always @(posedge clk or posedge async_rst)
  if (async_rst) q <= 8'h00;      // async priority (in sensitivity)
  else if (sync_rst) q <= 8'h00;  // sync checked on clock edge
  else if (en) q <= d;            // ffecr: enable + sync + async
```

**Enable expression types:**
The `enable` child can be any cone:
- Bare signal: `'en'`
- Signal with attrs: `['en', {dir: 'in'}]`
- Complex expression: `['&', 'valid', ['[0]', 'mask']]`

When the enable is a complex expression, the renderer draws combinational logic feeding into the EN pin.

**Positional order:** `data, clock, enable, [syncRst, [syncPresetValue]], [asyncRst, [asyncInitValue]]`

The enable signal always comes immediately after the clock (3rd position), before any reset controls.

Detecting a clock enable and lifting it into an `ffe` variant is converter-specific logic (documented by each converter).

### 3.5 Complete FF family summary

The FF family follows a strict hierarchical pattern: `ff[n][e][c|p][n][r|s][n]`

**Control hierarchy (left to right in name):**
1. **Clock edge** (`n` = negedge)
2. **Enable** (`e` = clock enable present)
3. **Sync reset** (`c` = clear to 0, `p` = preset to non-zero, `n` = active-low)
4. **Async reset** (`r` = reset to 0, `s` = set to non-zero, `n` = active-low)

**Positional children order:**
```
[data, clock, [enable], [syncRst, [syncPresetValue]], [asyncRst, [asyncInitValue]]]
```

**Key distinctions:**
- **Async reset:** Appears in sensitivity list (`or posedge rst`), takes priority
- **Sync reset:** NOT in sensitivity list, only checked on clock edge
- **Enable:** Synchronous gate for data loading, checked on clock edge
- **Reset values:**
  - `r`/`c` = reset to zero (no value child needed)
  - `s`/`p` = set/preset to non-zero (requires value child)

**Total operator count:** ~80+ variants covering all valid combinations

**Rendering:**
- Base FF: Rectangle with clock triangle (posedge) or bubble+triangle (negedge)
- Enable: Additional **EN** pin, may show feeding logic
- Sync reset: Additional **SR** pin (part of synchronous data path)
- Async reset: Additional **R** or **S** pin (higher priority, async)
- Active-low: Bubble on the control pin

### 3.6 Latch

Level-sensitive storage, inferred from a combinational always block where a signal isn't assigned in all branches. Symbol: same rectangle as FF but **no clock triangle** — replaced with a plain horizontal line for the level-sensitive gate signal. Naming:

| Operator | Gate Polarity | Positional Children |
|----------|---------------|---------------------|
| `latch`  | transparent when gate high | `[data, gate]` |
| `nlatch` | transparent when gate low  | `[data, gate]` |

**Data model:**
```javascript
['latch',  data, gateCone]   // transparent when gate = 1
['nlatch', data, gateCone]   // transparent when gate = 0
```

Latches are usually a design smell in synchronous designs; renderer should visually flag them (e.g., a faint "⚠" in a corner or a distinct fill tint) to help the reader catch unintended latches.

### 3.7 Design philosophy: Why dedicated operators?

**Why not one `ff` operator with boolean attrs?**

Encoding control signals in the operator name (rather than just attrs) has several benefits:

1. **Rendering dispatch:** The renderer can dispatch on `cone[0]` without unpacking attrs. Each variant gets a distinct pre-computed SVG path.
2. **Visual clarity:** Reading JSON, `'ffecr'` immediately communicates "posedge + enable + sync reset + async reset" without decoding attrs.
3. **Type safety:** Invalid combinations (e.g., `ffcps` = both sync clear and preset) are syntactically impossible.
4. **Positional precision:** The strict ordering ensures renderers can reliably extract control signals without ambiguity.

**Cost:** Combinatorial explosion (~80+ operators). Acceptable because:
- The enumeration is finite and small
- Each variant represents a genuinely distinct hardware primitive
- Modern design tools generate these patterns frequently

### 3.8 Cross-references

- **IR specification:** See [`ir.md`](ir.md) for the complete operator catalog with examples
- **Reset / enable lift:** Detecting async-reset, sync-reset/preset, and clock-enable patterns and lifting them into `ffr`/`ffs`/`ffc`/`ffp`/`ffe` variants is converter-specific — see the producing converter's documentation.
- **Rendering implementation:** See `lib/draw_body.js` for FF drawing logic

---

## 4. Port / signal labels

### 4.1 Input leaf (`.pinname`)

* Right-anchored text, `siglabel` rect extending leftward.
* If the leaf carries `attrs.dir === 'in'`, prepend `▶ ` (U+25B6) to the displayed name. Indicates the signal is entering the module.
* The `siglabel` rect is sized to `getLabelWidth(displayName) + 8`.

### 4.2 Output / root `=` (`drawOutLabel`)

* Left-anchored text, `siglabel` rect extending rightward.
* If `attrs.dir === 'out'`, append ` ▶` to the displayed name.
* Temp-wire names (LHS slot empty, original stored in `attrs.label`) fall back to `attrs.label` — **the original name is visible at root**, tooltip also shows it.
* Minimum box width: 32 px, so even very short names have a clickable target.

### 4.3 Mid-tree `=` (`drawInlineBox`)

* `siglabel` rect between input and output wires, `.bodylabel` text centered.
* Temp-wire (empty LHS) → **empty box**, tooltip shows `attrs.label` on hover.
* Produces the "named intermediate signal" look used for multi-use signals promoted out of catenation, or for temp wires inlined by catenation.

---

## 5. Wires

| class            | meaning                         | stroke            |
|------------------|---------------------------------|-------------------|
| `.wire`          | any wire                        | 1 px black        |
| `.wire.scalar`   | 1-bit (default when no class)   | 1 px              |
| `.wire.vector`   | > 1 bit                         | 3 px            |
| `.wire.zeroer`   | 0-bit / unreachable             | 0.5 px dashed     |

Width class is applied per-wire based on the source cone's `width` attr. Wires carrying multi-bit buses get a hover `<title>N bits</title>` for the exact width.

Routing: horizontal `h runLen` or Z-stepped `h half v Δ h half` when input pin y ≠ child y. Always 16 px wire connector, regardless of body width.

---

## 6. Open design questions

* **Signed vs unsigned on the body.** `signed(node)` in fir-forest adds a `signed` / `unsigned` class. Useful for comparisons; less so for pure bitwise ops. Not yet mirrored in logidrom.
* **Port shape.** Today the direction indicator is `▶` (a character). fir-forest uses a distinct pentagon for inputs and arrow for outputs. Consider migrating when we can afford a second SVG path per port leaf.
* **FF D-input placement.** The data input is on the same left edge as the clock — we may need to reserve a fixed vertical position for it (e.g. 8 px above clock) so multiple data bits on a wide FF don't overlap the clock triangle.
* **Reset value display.** Showing the reset value inside the FF body as small italic text would save one external MUX in the visual. Consider once the reset-pattern-detection post-pass is in.
* **CASE statement.** `['case', sel, [label1, val1], [label2, val2], ...]` or cascade of MUX? Cascading MUX is easier but loses the case-label annotation. Open.
