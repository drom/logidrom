# I/O shapes

logi IR to express input / output nodes in free and bound state.

### free io

Cone with input and output ports

```json
[["=", {"dir": "out"}, "a",
  ["&", ["b", {"dir": "in"}], ["c", {"dir": "in"}]]
]]
```

### output bound

cone driving output port that is bound in the parent

```json
[["=", {}, "z1",
  ["pout", {"instance": "u1", "pin": "z"},
    ["&", "A", "B"]
  ]
]]
```

### input bound

cone is driven by input port that is bound in the parent

```json
[
  ["=", "X",
    ["&",
      ["pin", {"instance": "u1", "pin": "a"},
        "A1"
      ],
      "B"
    ]
  ]
]
```


## Cleanup plan

### Bugs (current)

- `pout` not in `isPinRoot` ([lib/tree-utils.js:84](../lib/tree-utils.js#L84)). Mid-tree pout (hier1) falls through to generic gate path; renders as 32×16 rect with bodylabel `"pout"` instead of pin label.
- `pin` / `pinout` mid-tree forced to `drawAssign(isRoot=true)` ([lib/draw_boxes.js:283-286](../lib/draw_boxes.js#L283-L286)) → `drawOutLabel` extends right of gateFx into the next column, overlapping consumer gate (hier2).
- `measureExtents` ([lib/render-assign.js:73-79](../lib/render-assign.js#L73-L79)) inflates `acc.root` for any pin/pinout regardless of `isRoot`. Wrong: mid-tree label is interior, not right edge.
- `collectSlacks` skips pout entirely; no per-branch shift exists for pin ops, so consumer gates collide with the inline label.
- `shiftInlineExprs` ([lib/render-assign.js:168-188](../lib/render-assign.js#L168-L188)) only handles `=`. No analogous shift for pin/pout/pinout.
- Pre-existing: `inlineBoxW(inlineDisplay(node))` at [lib/render-assign.js:177](../lib/render-assign.js#L177) missing `fontWidth` arg.

### Target body shapes

No arrow glyph text. Chevron `>` is drawn into the polygon outline itself via path moves `l 6 8 l -6 8` (going down) or `l 6 -8 l -6 -8` (going up). Each shape is a single `<path>` element. Class is `gate` (uses gate styling, not `siglabel`).

Width formulas:

- two-section (pin / pout): `w = 8 + gwidth.inst + 8 + gwidth.pin + 8`
- one-section (`=` with `dir`): `w = 8 + gwidth.pin + 8`

`gwidth.inst` = label width of `attrs.instance`; `gwidth.pin` = label width of `attrs.pin` (for `pin`/`pout`/`pinout`) or LHS name (for `=` with dir).

#### pin shape

Two closed subpaths: rounded-left section (instance) `(>` + chevron-fed section (port) `>]`.

```
['path', {w: 8 + gwidth.inst + 8 + gwidth.pin + 8, class: 'gate', h: 16, d: [
    // pin section (drawn first, sits on right)
    'm', -gwidth.pin -6 - 8, -8,
    'l', 6, 8, 'l', -6, 8,
    'h', gwidth.pin + 6 + 8,
    'v', -16,
    'z',
    // instance section (sits on left)
    'm', -2, 0,
    'l', 6, 8, 'l', -6, 8,
    'h', -gwidth.inst,
    'a', 8, 8, 0, 1, 1, 0, -16,
    'z'
  ]}]
```

#### pout shape

Two closed subpaths. Per spec `[ output_port_name >> instance_name )`: LEFT section = port (square left), RIGHT section = instance (rounded right). Wire flows out of cone → into instance pin.

Anchor at x=0 (rightmost extent = arc apex).

```
['path', {w: 8 + gwidth.inst + 8 + gwidth.pin + 8, class: 'gate', h: 16, d: [
    // inst section (drawn first, sits on RIGHT; rounded `)` right edge)
    'm', -gwidth.inst - 6 - 8, -8,
    'l', 6, 8, 'l', -6, 8,
    'h', gwidth.inst + 6,
    'a', 8, 8, 0, 1, 0, 0, -16,         // arc chord at x=-8, apex at x=0
    'z',
    // port section (drawn second, sits on LEFT; square `[` left edge)
    'm', -2, 0,
    'l', 6, 8, 'l', -6, 8,
    'h', -gwidth.pin - 8,
    'v', -16,
    'z'
  ]}]
```

User draft adjusted: shifted whole inst section left by 8 so arc apex sits AT anchor x=0 (not 8 past it). Total width unchanged: `8 + gwidth.inst + 8 + gwidth.pin + 8`.

#### `=` with `dir: "in"` (replaces current `drawOutLabel`/inline rect for input-direction cones)

One section: chevron-fed `>]`.

```
['path', {w: 8 + gwidth.pin + 8, class: 'gate', h: 16, d: [
    'm', -gwidth.pin -6 - 8, -8,
    'l', 6, 8, 'l', -6, 8,
    'h', gwidth.pin + 6 + 8,
    'v', -16,
    'z'
  ]}]
```

#### `=` with `dir: "out"`

One section: chevron-tipped right `[>`. Drawn upside-down (`l 6 -8 l -6 -8` going up).

```
['path', {w: 8 + gwidth.pin + 8, class: 'gate', h: 16, d: [
    'm', -6, 8,
    'l', 6, -8, 'l', -6, -8,
    'h', -gwidth.pin -8 -2,
    'v', 16,
    'z'
  ]}]
```

### Wire connection points

All shapes anchor at x=0 (right edge); body extends from -w to 0; vertically centered on `fy`.

- **pin**: driver wire ends **touching `(` arc apex** at x = -w (leftmost extent). Consumer wire starts at `]` square right edge x = 0.
- **pout**: driver wire ends at `[` chevron-tip-left of port section x = -w. Consumer wire starts **touching `)` arc apex** at x = 0.
- **dir:in leaf**: terminus only — driver inside cone exits at square right edge x = 0; no left wire (the chevron `>` left edge IS the module boundary).
- **dir:out `=`**: terminus only — driver wire from cone interior enters at chevron-tip-LEFT (x = -w); the `>` right edge IS the module boundary.

Driver wire ALWAYS touches the bracket shape (arc or chevron), never stops short.

### Resolved decisions

1. `dir:in` shape applies to **leaves** with `dir:in` attr (current IR usage in `ports` fixture). Replaces `drawLeaf` rendering for that case.
2. `dir:out` shape replaces **both** root `=` (`drawOutLabel`) and mid-tree `=` (`drawInlineBox`) when `attrs.dir === 'out'`.
3. **Remove `▶` triangle prefix/suffix** from `leafDisplay` / `outDisplay` / `inlineDisplay` — direction now encoded by shape; triangle in label text is redundant.
4. **Remove auxiliary boundary `<line>`** at [draw_boxes.js:139-148](../lib/draw_boxes.js#L139-L148). Boundary now in path.
5. Anchor x=0 for all shapes (including pout — arc apex AT x=0, not past it). pout draft adjusted above.
6. Driver wire touches the bracket (arc or chevron-tip).
7. Label x-position: center of section's bounding rect (right of chevron tip + arc inset).
8. `pins` fixture's `["=", {dir:out}, "z", ["pout", ...]]` represents two independent port levels: outer `=` (unbound module port) gets `dir:out` chevron; inner `pout` (bound to instance) gets two-section pin/pout shape. Both rendered.
9. Vertical centering: `translate(fx, fy)` only; paths use y in [-8, +8].
10. **New CSS class `port`** (distinct from `gate`); add to [insert-svg-template-assign.js](../lib/insert-svg-template-assign.js) with distinct fill color.

### Files touched

- [lib/tree-utils.js](../lib/tree-utils.js): rename `isPinRoot` → `isPinOp` (covers `pin`/`pout`/`pinout`); add `pinLabels(op, attrs)` returning `{instance, pin}` strings; keep `pinLabel` for tooltips. **Drop `▶` triangle** from `leafDisplay` / `outDisplay` / `inlineDisplay` — return raw label when `dir` set; shape carries direction.
- [lib/draw_boxes.js](../lib/draw_boxes.js): add `portBoxWidth`, `portBoxPath`, `drawPortBox` (used for pin/pout/pinout/dir-leaf/dir-`=`). Replace forced-root pin branch; route mid-tree pin ops through new shape; pass actual `isRoot` to `drawAssign`. For `=` with `attrs.dir`, replace `drawOutLabel`/`drawInlineBox` outputs with new dir-shape paths. Remove auxiliary boundary `<line>` at [draw_boxes.js:139-148](../lib/draw_boxes.js#L139-L148). For `drawLeaf` with `attrs.dir === 'in'`, route to `drawPortBox` dir-in variant.
- [lib/render-assign.js](../lib/render-assign.js): swap `inlineBoxW` / `outBoxW` for pin ops and dir-attributed nodes with new width formulas. All shapes span -w..0 → contribute to `acc.left` (pin/pout/pinout root) or `acc.root` (dir:out `=` at root, since it sits at the right edge of cone). Add pin-op branch in `shiftInlineExprs`. Fix missing `fontWidth` arg at line 177.
- [lib/insert-svg-template-assign.js](../lib/insert-svg-template-assign.js): add `.port { fill: #cce; stroke: #000; stroke-width: 1 }` (or chosen distinct color).
- [lib/render.js](../lib/render.js): no change.

### Step-by-step

1. **tree-utils**: rename predicate `isPinRoot` → `isPinOp` (add `pout`); add `pinLabels(op, attrs) → {instance, pin}`.
2. **draw_boxes**: implement width helpers:
   - `pinBoxWidth(op, gwidthInst, gwidthPin) = 8 + gwidthInst + 8 + gwidthPin + 8` for two-section (pin/pout/pinout)
   - `dirBoxWidth(gwidthPin) = 8 + gwidthPin + 8` for `=` with `dir`
   `gwidth*` from `getLabelWidth(label, fontWidth)`.
3. **draw_boxes**: implement `pinBoxPath(op, gwidthInst, gwidthPin)` returning `d` array per op. Also `dirInPath`, `dirOutPath`.
4. **draw_boxes**: implement `drawPinBox(tree, fx, fy, fontWidth)`:
   - compute labels via `pinLabels`
   - emit `<g transform>`, `<title>` (composed `inst.pin`), `<path class="gate" d="...">`
   - emit two `<text class="bodylabel">` elements positioned in each section's center
   - propagate `nodeId`/`module`/`name`/`loc` data-attrs (mirror `drawInlineBox` lines 38-45)
5. **draw_boxes**: implement `drawDirBox(tree, fx, fy, fontWidth, dir)` analogous, single label centered in the shape.
6. **draw_boxes**: rewrite `drawAssign`:
   - if `pinRoot`: call `drawPinBox`. Wire passthru from `exprFx` to shape's left-entry (gateFx - w + entry-offset). Skip nameBranch/inlineBox branches.
   - if `=` with `attrs.dir`: call `drawDirBox` instead of `drawOutLabel`/`drawInlineBox`.
   - else (`=` no dir): existing inline-box / out-label paths.
7. **draw_boxes**: at line 283-286, pass actual `isRoot` (drop `true`).
8. **render-assign**: thread new widths through `measureExtents`, `collectSlacks`, `shiftInlineExprs`. All three pin ops + dir-`=` shapes contribute to `acc.left`. Add pin-op branch in `shiftInlineExprs`:
   ```
   gap = node[0].fx - exprNode.fx
   need = pinBoxWidth + MIN_PASSTHRU_PX - gap
   if (need > 0) shiftFxSubtree(exprBranch, need)
   ```
9. **render-assign**: fix missing `fontWidth` at [line 177](../lib/render-assign.js#L177).
10. **Verify**: `npx mocha test/basic.js`; inspect [../report.html](../report.html) for `ports`, `hier1`, `hier2`, `pins`:
    - hier1: `& → wire → [ z >> u1 ) → wire → z1` outLabel.
    - hier2: `A1 leaf → wire → ( u1 >> a ] → wire → &`. No overlap with `&` body.
    - ports: `=` with `dir:in` and `dir:out` render the chevron paths.
    - pins: top-level pin/pout/pinout render new two-section shape.

### pinout

**Render twice — once as `pin`, once as `pout`. No dedicated `pinout` shape.**

A `pinout` (bidirectional inout) cone is materialized into the schematic as two separate shapes: a `pin` occurrence representing the inbound flow and a `pout` occurrence representing the outbound flow. Both reuse the existing `pin` / `pout` paths and labels (`<inst>.<pin>`). The two occurrences sit at independent layout positions (driven by the cone forest where `pinout` is referenced).

Implementation status: deferred. Current code path falls back to the `pin` shape via `drawPortBox` when `op === 'pinout'` (see `isPout` branch in [drawPortBox](../lib/draw_boxes.js#L107)). When a producer starts emitting separate `pin` + `pout` cones for inout pins, this fallback becomes unreachable and can be removed.

No follow-up shape variants needed.

### Implementation notes (post-merge)

- **Text alignment**: label x-positions use `Math.round((... + offset) / 2)` for crisp text rendering on the SVG grid. Minor offset tweaks vs. the rect-bbox center improved visual centering inside the chevron-bounded sections — see [drawPortBox lines 121-132](../lib/draw_boxes.js#L121-L132), [drawDirInBox line 150](../lib/draw_boxes.js#L150), [drawDirOutBox line 167](../lib/draw_boxes.js#L167).
- **Width formulas (final)**: `portBoxWidth(gwInst, gwPin) = gwInst + gwPin + 24`; `dirInBoxWidth(gw) = gw + 14`; `dirOutBoxWidth(gw) = gw + 16`. `gw*` comes from `textWidth` (raw label text width, no padding).
- **Two classes for pin/pout**: each shape is emitted as **two separate `<path>` elements** within the group:
  - `.port` — port-name section (square `]` for pin, square `[` for pout). Module-side. Fill `#cce`, hover `#aaf`.
  - `.bind` — instance-name section (rounded `(` for pin, rounded `)` for pout). Instance-side. Fill `#ecc`, hover `#faa`.
  This lets CSS distinguish module-port boundary from instance-bind region. dir:in / dir:out single-section shapes keep `.port` only (no instance section).
  Path generators are split: [pinPortPathD](../lib/draw_boxes.js#L37) / [pinBindPathD](../lib/draw_boxes.js#L48) / [poutBindPathD](../lib/draw_boxes.js#L60) / [poutPortPathD](../lib/draw_boxes.js#L71). Each emits one closed subpath; combined geometry matches the original single-path shape.
- **Pin-op leaf cones**: a `pin`/`pout`/`pinout` cone with no body (e.g. `["pout", attrs]` inside `["=", {dir:out}, "z", ["pout", attrs]]`) is rendered by `drawLeaf` via the same `drawPortBox` renderer used for cone-form pin ops.

