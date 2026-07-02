# xtab

A small, framework-agnostic **crosstab / pivot table** widget for tabular
JavaScript datasets. Drag dimensions into row / column / filter zones and values
into the grid, and xtab renders an aggregated pivot with drill-down and TSV
export.

This is a modernized rewrite of an original 2015 jQuery plugin. It now ships as
an ES module with no runtime dependencies (no jQuery, no Font Awesome).

## Install

```bash
npm install
```

## Develop

Run the demo with hot reload:

```bash
npm run dev
```

Then open the printed local URL. The demo lives in [`index.html`](index.html) and
[`demo/`](demo/), backed by synthetic sample data.

## Build the library

```bash
npm run build
```

This produces ESM and UMD bundles plus the stylesheet in `dist/`.

## Usage

```js
import { Xtab } from 'xtab';
import 'xtab/style.css';

const rows = [
  { region: 'North', product: 'Widget', units: 12, revenue: 240 },
  { region: 'South', product: 'Gadget', units: 7, revenue: 210 },
  // ...
];

const xtab = new Xtab(document.querySelector('#chart'), {
  data: rows,
  dimensions: ['region', 'product'], // draggable grouping fields
  values: ['units', 'revenue'],      // numeric measures (summed)
  hideZeros: true,
  showGrid: true,
});

// Optionally seed a layout programmatically:
xtab.addVDim('region');
xtab.addHDim('product');
xtab.addValue('units');
```

### Options

| Option       | Type       | Default | Description                                         |
| ------------ | ---------- | ------- | --------------------------------------------------- |
| `data`       | `Object[]` | `[]`    | Rows to pivot; each row is a flat object.           |
| `dimensions` | `string[]` | `[]`    | Field names available as draggable dimensions.      |
| `values`     | `string[]` | `[]`    | Numeric field names available as measures (summed). |
| `hideZeros`  | `boolean`  | `true`  | Hide cells whose aggregated value is zero.          |
| `dimZeros`   | `boolean`  | `false` | Dim (reduce opacity of) zero cells instead.         |
| `showGrid`   | `boolean`  | `false` | Draw alternating row bands behind the values.       |

### Instance methods

| Method                     | Description                                             |
| -------------------------- | ------------------------------------------------------- |
| `addHDim(dim)`             | Add a horizontal (column) dimension.                    |
| `addVDim(dim)`             | Add a vertical (row) dimension.                         |
| `addValue(field)`          | Add a value/measure field.                              |
| `addFilter(dim, selected)` | Add a filter strip for a dimension.                     |
| `removeFilter(dim)`        | Remove a filter.                                        |
| `refreshData()`            | Recompute and re-render (debounced).                    |
| `reset()`                  | Clear all dimensions, values, and filters.              |
| `save()`                   | Serialize the current layout to a plain object.         |
| `load(state)`              | Restore a layout previously returned by `save()`.       |
| `exportCsv()`              | Return the crosstab as a tab-separated string.          |

### Events

The host element dispatches a `xtab:cellclick` `CustomEvent` when a value cell is
clicked. `event.detail` contains `{ col, row, value, hFilter, vFilter }`, where
`hFilter` / `vFilter` are the dimension→value criteria selecting that cell.

## Project structure

```
src/
  index.js        public entry (exports Xtab, createXtab)
  xtab.js         Xtab controller (vanilla DOM, drag/drop, render pipeline)
  calc.js         XtabCalc aggregation engine + TSV export
  tree.js         dimension-tree building (pure)
  data.js         filter / distinct-value helpers (pure)
  render.js       label markup helpers
  filter-strip.js vanilla multi-select filter widget
  xtab.css        styles
demo/             sample data + demo bootstrap
index.html        demo page
```

## License

MIT
