# Logidrom documentation

`logidrom` is the **IR + rendering engine**: it defines the native intermediate
representation (`logidrom` / `wavedrom.assign`) and renders it to SVG. It is
**source-agnostic** — converters that import external formats live in downstream
packages and produce this IR.

```
                  ┌───────────────────────┐
 external RTL ──▶ │  CONVERTERS           │   ← downstream packages, not here
 (any source →    │  import / export path │
  IR producers)   └──────────┬────────────┘
                             │
                             ▼
                  ┌───────────────────────┐
                  │  IR                   │   ← the center of gravity
                  │  logidrom =           │
                  │  wavedrom.assign      │
                  │  (JSONML / ONML)      │
                  └──────────┬────────────┘
                             │
                             ▼
                  ┌───────────────────────┐
                  │  RENDERING            │
                  │  IR → SVG → web /     │
                  │  PDF / paper          │
                  └───────────────────────┘
```

## IR — native format (`logidrom` / `wavedrom.assign`)

The IR is a JSONML / ONML-style array of cones. It is designed to be:

- **human-comprehensible** — a small, regular grammar you can read and write by hand;
- **LLM-comprehensible** — flat, nested arrays with named operators and attrs, no cyclic structure;
- **readable and writable** — `JSON.stringify` / `JSON.parse` round-trips; can be typed into a test file directly;
- **visual-language-mappable** — every operator has a canonical symbol (see [`symbols.md`](symbols.md));
- **attr-graceful** — UI/UX-enriching attrs (`label`, `fl`, …) are **optional**. Tools that don't need them can emit minimal IR; readers must tolerate their absence.

The IR is **source-agnostic** and **sink-agnostic**: it defines a format, a set
of canonical transformations (fuse, chain, catenate, mux-fuse, …), and the
invariants those transformations must preserve. Transformations take IR → IR.

## Rendering — IR out to SVG / PDF / paper

The renderer consumes IR and produces SVG. Output targets:

- **Web** — interactive SVG served in a browser; hover tooltips, click-through to source (if `fl` attrs present).
- **PDF** — the same SVG embedded or printed; the layout is resolution-independent, so print output retains vectors.
- **Paper** — PDF → printed page. The visual language in [`symbols.md`](symbols.md) is tuned so shapes remain distinguishable at common print sizes (12 pt labels, 1 / 3 px wire stroke, high-contrast palette).

The renderer is **agnostic of the IR's origin**. It relies on a small set of
core attrs (`width`, `dir`) and falls back gracefully when optional attrs
(`label`, `fl`, `clock`, …) are absent.

## File map

| file | layer | what it covers |
|---|---|---|
| [`ir.md`](ir.md) | IR | cone data model, core attrs, canonical transformations (fuse, chaining, catenation, split), temp-wire convention |
| [`io-render.md`](io-render.md) | IR | input / output node shapes in free and bound state |
| [`symbols.md`](symbols.md) | IR → visual | per-operator symbol catalog: shapes, labels, colors, UX conventions |
| [`rendering.md`](rendering.md) | rendering | SVG pipeline, layout math (slacks, fx/fy, body left-extent), CSS classes, output targets, gotchas |

## Layer boundaries — what each layer may assume

- **Converters** (downstream) may assume the IR grammar defined in [`ir.md`](ir.md) is complete. They must not embed renderer-specific attrs (e.g. `attrs.fx`, `attrs.fy`) — those belong to the render pipeline.
- **IR transformations** are pure IR → IR. They may add / remove / rewrite cones; they must not reference AST node types from any particular source, and must not call into the renderer.
- **Rendering** reads the IR's core attrs and any optional attrs present; it must not throw when optional attrs are absent. It assigns layout attrs (`fx`, `fy`) on post-layout nodes but these are **runtime decorations**, not part of the IR on disk.

## Contributing a new output target

1. Read [`symbols.md`](symbols.md) and [`rendering.md`](rendering.md).
2. Your target consumes SVG (or the pre-SVG JSONML tree) — not the IR directly. Rendering canonicalizes IR into geometry once; every output target reuses that.
3. If the target introduces a new visual (e.g. animated waveform), add a section to [`symbols.md`](symbols.md) defining the symbol, then add geometry to [`rendering.md`](rendering.md).
