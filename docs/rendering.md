# Logidrom rendering

IR → SVG. See [`README.md`](README.md) for the three-layer context and [`ir.md`](ir.md) for the input format. Symbol-by-symbol visuals are catalogued in [`symbols.md`](symbols.md); this doc covers the **pipeline**, **layout math**, **CSS**, **gotchas**, and **output targets** (web / PDF / paper).

---

## 1. Pipeline

```
IR forest
   → render.js          (grid-unit x/y assigned into tree nodes)
   → render-assign.js   (slacks, pixel fx/fy, SVG frame, margins)
       ├─ drawBoxes     (walks tree, builds SVG)
       ├─ drawGate      (wires + body invocation, per-input Z-wire routing)
       └─ drawBody      (body shape library + leftExtent)
```

**Supporting modules:**

- `lib/font-metrics.js` — `getLabelWidth(s)`. Fixed-pitch monospace; `CHAR_WIDTH_PX = 7.23`. CSS (`.pinname`, `.wirename`, `.slicelabel`, `.bodylabel`) all declare `font-family: monospace; font-size: 12px`.
- `lib/tree-utils.js` — `isAttrs`, `firstChildIdx`, `getAttrs`, `isLeafCone`, `getWidth`, `widther`, `leafDisplay`, `outDisplay`, `outTooltip`. Cone-format predicates and display-name helpers. `outDisplay(tree)` falls back to `attrs.label` when the LHS slot is empty; `outTooltip(tree)` prefers `attrs.label`, else the visible name.

**Runtime-only decorations.** `render.js` assigns `x`, `y` (grid units) onto layout nodes; `render-assign.js` then assigns `fx`, `fy` (pixels) on every layout node via `assignFx`. Drawing code reads `node.fx` / `node.fy` directly — no `32 * (xmax − x)` math at draw time. These decorations are not part of the IR on disk (see [ir.md §4.2](ir.md#42-post-layout-annotations-not-part-of-the-ir-on-disk)).

---

## 2. Layout conventions

- **Gate position is the body's right edge (output pin).** Bodies extend leftward from this point.
- **Wire connectors are always `grid/2` = 16 px.** The body varies in width; the wire does not.
- `drawBody.leftExtent(type)` is the **single source of truth** for how far a body reaches to the left of the gate position:

| type | `leftExtent` |
|---|---|
| `gater1` shape gates (`buf1`, `~`, `&`, `\|`, `^`, `+`, `*`, `-`, + aliases) | `16` |
| `gater2` iec gates (`AND`, `OR`, `MUX`, `eq`, `slt`, …) | `16` |
| slice ops (`type[0] === '['`) | `getLabelWidth(type) + 8` |
| fallback (anything else, incl. `NEG`, `SEL` (variable), `EXTEND`, `SHIFTL`, `CONCAT`, `SUB`, …) | `getLabelWidth(type) + 4` |

- `draw_gate.js` uses this for `runLen = gateX - cx - leftExtent(spec[0])`.
- `render-assign.js` `collectSlacks` uses `leftExtent(name) - 16` as one-sided slack added to `slacks[col]` on the child side.
- `computeTrailing` walks right-to-left: `trailing[xmax] = 0; trailing[x] = trailing[x+1] + slacks[x]`.
- Final `fx(x) = 32 * (xmax - x) + trailing[x]`; canvas width includes `totalSlack = trailing[0]`.

### 2.1 Variadic shape-gate back extension

For `gater1` shape gates (AND / OR / XOR / ADD / …) with more than 2 inputs, `draw_gate.js` draws **two vertical segments** on the gate's back edge (`x = gateX - 16`) — one from `ymin` up to the natural body top (`gateY - 10`) and one from `gateY + 10` down to `ymax`. The natural D-shape stays intact in the middle.

Detected via `drawBody.isShape(type)`. Non-shape bodies are unaffected — iec rects stretch on their own via `ymin - 3 … ymax + 3`.

### 2.2 Mid-tree `=` rendering

- Root `=`: renders as `expr ─── [name]` via `drawOutLabel` — `siglabel` rect on the right. Minimum 32 px box width so empty-LHS temp wires are still visible.
- Mid-tree `=`: renders as `── [name] ──` via `drawInlineBox` — `siglabel` rect between input and output wires, `.bodylabel` text centered, `<title>` tooltip from `attrs.label`. Empty LHS → empty box.
- `isRoot` flag is threaded through `drawBoxes` → `drawAssign` and `collectSlacks` / `measureCone` so mid-tree `=` cones reserve left-side slack based on box width without inflating `acc.root` (the right-margin accumulator).
- **Mid-tree `=` slack** — `inlineBoxWidth(visible) = max(getLabelWidth(visible) + 8, 32)`. Slack `= boxW - grid/2` is applied to the `=` column's left gap so the input wire between expr and box ends up exactly 16 px.

### 2.3 `=` layout quirk

`render.js` skips the name child's y-slot, then places the name at the gate position (`state.x, gateY`) after layout. `assignFx` copies the gate's `fx/fy` onto the name node. This avoids leaving a ghost y-gap above the diagram.

### 2.4 Port direction triangles

- Input leaves (`[name, {dir:'in'}]`) get `▶ ` prefixed via `leafDisplay`.
- Root `=` with `{dir:'out'}` appends ` ▶` via `outDisplay(assignTree)`.
- Internal signals, constants, and `inout` get no triangle.

Glyph is `U+25B6`; it renders in the same monospace font as the label, so `getLabelWidth` counts it as a regular char and `leftPad` / `rightPad` / `boxW` grow to accommodate.

### 2.5 Wire hover tooltips

Wire `<path>` elements carry a `<title>N bits</title>` child when `width > 1`. Applied in `draw_gate.js` (gate input wires) and `drawAssign`'s passthrough wire.

### 2.6 Canvas width accounting

```
width = leftPad + 32*(xmax+1) + 1 + rightPad + totalSlack
```

- `leftPad = ceilGrid(acc.leaf + LEAF_ANCHOR_OFFSET_PX)` — room for the widest input-leaf label.
- `rightPad = ceilGrid(max(0, acc.root - (grid + 1)))` where `acc.root` holds the **full box width** (not just the label width). `outBoxW(tree) = max(getLabelWidth(outDisplay(tree)) + 2*BOX_PAD_X, MIN_BOX_W)`. Minimum box width (32 px) ensures empty-LHS temp wires at the root still produce a visible box.
- `totalSlack = trailing[0]` — accumulated per-column slacks (slice bodies, long fallback labels).

Measurement in `measureCone` and drawing in `drawOutLabel` share the same formula so they stay in sync.

---

## 3. CSS class taxonomy

| class | purpose |
|---|---|
| `.pinname`     | leaf input signal-name text (`text-anchor: end`) |
| `.wirename`    | output / inline signal-name text (`text-anchor: start`) |
| `.siglabel`    | signal-label rect (around pinname / wirename at leaves and root `=` output) |
| `.gate`        | operator body (shape or rect) — used by `gater1`, `gater2`, and fallback |
| `.slicelabel`  | slice-operator text — centered, white `paint-order: stroke` outline for readability when sitting on a wire |
| `.bodylabel`   | fallback-operator body text — centered, plain |
| `.wire`        | wire path (black 1 px stroke) |
| `.wire.vector` | multi-bit wire — 3 px stroke |
| `.wire.zeroer` | zero-width wire — 0.5 px dashed |

---

## 4. Output targets

### 4.1 Web (interactive SVG)

Primary target. SVG embedded in an HTML page; native hover tooltips (via `<title>`); optional click-through to source when `attrs.fl` is present (handled by the host page, not the renderer).

The renderer outputs a self-contained `<svg>` with inline `<style>` (see CSS taxonomy above). The consumer can wrap it in any HTML container.

**Navigation hooks.** When a leaf cone or `=` cone carries navigation metadata (`attrs.nodeId`, `attrs.module`, `attrs.name`, `attrs.loc` — see [`ir.md §2.2`](ir.md#22-optional-metadata-attrs)), the renderer surfaces them on the group element:

- `class="rtl-node"` — marks the element as clickable by a host webview.
- `data-node-id`, `data-module`, `data-name`, `data-loc` — exposed for the host script to wire up file / symbol navigation (e.g. VS Code's `rtlviz` panel jumping to the source line).

Host pages are free to ignore these; the renderer adds them only when the converter attached them and otherwise produces plain `<g>` groups.

### 4.2 PDF (vector print)

The rendered SVG is inherently vector and resolution-independent, so:

- **Browser print** → PDF: works out of the box for simple layouts.
- **Headless conversion** (e.g. `rsvg-convert`, `cairosvg`, Chrome's `--print-to-pdf`): also works; the SVG uses only basic shapes, paths, text, and title — no complex filters or scripts.

Constraints for reliable print output:

- Monospace font must resolve to a real monospace face in the renderer. Defaulting to CSS `monospace` picks a system face — fine in browsers; for offline PDF generation, the consumer should bundle a specific font.
- `paint-order: stroke` on `.slicelabel` is used for the white text outline; check PDF converter support (Chrome and librsvg handle it; older tools may not).

### 4.3 Paper (printed page)

The visual language in [`symbols.md`](symbols.md) is tuned so shapes remain distinguishable at common print sizes:

- 12 pt labels (unchanged from screen).
- 1 px / 3 px wire stroke — wide enough at 300 dpi print to differentiate scalar vs vector without merging.
- High-contrast palette (black strokes on white/light-gray fills). No reliance on color alone for operator identity — shape is primary, color is secondary.

Large diagrams often want to wrap across multiple pages. That's an output-stage concern, not the renderer's: the renderer produces one SVG per module; pagination is handled by the host.

---

## 5. Gotchas & findings

- **`state.xmax` bug, hidden by `+3` fudge.** The old `render-assign.js` had `const xmax = state.xmax + 3`. That was primarily compensating for `render.js` never bumping `state.xmax` when it placed a string leaf at `state.x + 1`. When feature #1 (Proper SVG sizing) removed the `+3`, leaves rendered at negative `fx`. Fix: `render.js` now does `state.xmax = Math.max(state.xmax, state.x + 1)` on string-leaf assignment. Array children still bump `xmax` via the recursive-call entry guard (`state.xmax = max(state.xmax, state.x)`).
- **`'='` conflicted with the buffer shape.** The original `gates` table used key `'='` for the `buf1` buffer path. Renamed the key to `'buf1'` (and `input` alias now maps to `'buf1'`) so `=` falls through to the operator fallback path and can be special-cased by `drawBoxes` / `drawAssign`.
- **`=` name child placement vs layout.** Treating `[=, name, expr]` naïvely would leave `name` taking its own y-slot on the left. `render.js` detects `tree[0] === '='` with ≥ 2 children and skips the name child during y-allocation, then places it at the gate position after layout.
- **`attrs` collision with post-render layout nodes.** Both attrs objects (`{width, dir}`) and layout nodes (`{name, x, y}`) are plain non-array objects. The `isAttrs` check uses `!Object.prototype.hasOwnProperty.call(v, 'x')` to discriminate, since layout nodes always have `x`.
- **`dir` attr lives on the `=` cone, not the name child.** `makeAssign` emits `['=', {dir:'out', width}, name, ...body]`, so reading `getAttrs(nameBranch)` for the output triangle gave nothing. Fixed by having `outDisplay(assignTree)` take the whole `=` tree, read its attrs, and resolve the name child inside. (Input leaves are different — `leafDisplay(branch)` correctly reads attrs off leaf cones, where the leaf carries its own dir.)
- **Temp-wire name-lookup asymmetry.** For root rendering we want the full name visible; for mid-tree we want an empty box. `outDisplay` falls back to `attrs.label` when the LHS is empty (used by `drawOutLabel` at root); `drawInlineBox` (mid-tree) reads the LHS slot directly and sees `''`. Both share `outTooltip` which always prefers `attrs.label`.
- **Variadic `gater1` shape gates.** `and2` / `or2` / `xor2` path strings are fixed-size (body from ±10). Four or more inputs (spaced 16 px apart from `INPUT_SPACING`) spill outside the D-shape's back. `draw_gate.js` adds two vertical back-edge extensions (top and bottom) when `nInputs > 2 && drawBody.isShape(type)`. `gater2` iec rects stretch dynamically — no extension needed.
- **`isRoot` must be threaded through THREE pipes.** `drawBoxes` (rendering), `collectSlacks` (layout reservation for mid-tree `=` boxes), and `measureCone` (to avoid bumping `acc.root` from mid-tree `=` cones) all need to know whether the current cone is a top-level one. The flag is `true` on the initial call per cone in `renderAssign` and `false` on every recursion.
- **Leaf `siglabel` boxes don't carry `widther`.** Only wires get the `.vector` / `.zeroer` class today. Input-port visual thickness is not yet reflected on the box itself.
- **Intermediate `=` labels don't reserve extra slack beyond their box.** Mostly fine; ultra-long temp names on mid-tree inline boxes could still collide if the enclosing gate is tight. Tracked.
- **Direction-specific port shapes deferred.** `{dir: 'in'|'out'}` is carried on leaf cones; renderer draws a plain rect plus the `▶` triangle as the direction indicator. fir-forest-style pentagons / arrows are not yet ported.
- **Slice labels and `declElWidth`.** Slice `sliceLabel(lsbVal, widthConst, declElWidth)` divides by `declElWidth` for packed-array element selects: `mem[3]` on `logic [3:0][31:0] mem` → `lsb=96, widthConst=32, declElWidth=32` → `'[3]'`, not `'[96]'`. Rendering is oblivious to this — it just displays the bracket label.
- **Bundled `public/index.html`** contains an inlined copy of `lib/` modules — it is not auto-rebuilt by source edits. Changes won't be visible there until the bundler runs.

---

## 6. Deferred / TODO

- Direction-specific port shapes (fir-forest pentagon / arrow). Today the direction indicator is the `▶` unicode triangle; fir-forest-style shaped boxes are deferred.
- `widther` class on leaf `siglabel` boxes (for thick input / output pins matching wire class).
- Variadic body extension for non-`gater1` operator boxes (MUX, fallback rects).
- Slack allocation for intermediate `=` inline labels (long names can collide with the parent gate).
- Reset-value rendered as in-body italic text inside the FF symbol (once the reset-lifting post-pass is in).
- Pagination for large diagrams at print time.
