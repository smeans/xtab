// Xtab controller — the public class. Vanilla DOM, no jQuery.
//
// Renders a crosstab / pivot UI into a host element:
//   - a "dimensions" palette and a "values" palette (draggable chips)
//   - drop zones for horizontal dimensions, vertical dimensions, and filters
//   - a scrollable value grid computed by XtabCalc
//
// Public API mirrors the original plugin: reset(), save(), load(), addFilter(),
// removeFilter(), addHDim(), addVDim(), addValue(), refreshData(), exportCsv().

import { filterByObject, uniqueValues } from './data.js';
import { buildDimTree, filtersForLeaf } from './tree.js';
import { XtabCalc } from './calc.js';
import { dimLabelsFromTree, fieldLabel } from './render.js';
import { FilterStrip } from './filter-strip.js';

const DEFAULTS = {
  data: [],
  dimensions: [],
  values: [],
  hideZeros: true,
  dimZeros: false,
  showGrid: false,
};

export class Xtab {
  /**
   * @param {HTMLElement} element host element
   * @param {Object} [options] see DEFAULTS
   */
  constructor(element, options = {}) {
    this.element = element;
    this.options = { ...DEFAULTS, ...options };

    this._dragging = null;
    this._filterStrips = new Map(); // dim -> FilterStrip

    this.init();
  }

  // ---- setup -------------------------------------------------------------

  init() {
    const el = this.element;
    el.classList.add('xtab');
    // NOTE: the elements inside `.xtab-data-top` and `.xtab-data-bottom` are
    // laid out with inline-block at 10%/90% widths, so any whitespace text node
    // between the siblings would overflow 100% and wrap. Keep those pairs on a
    // single line with no whitespace between the tags.
    el.innerHTML =
      '<div class="xtab-dims-list"><label>dimensions</label></div>' +
      '<div class="xtab-vals-list"><label>values</label></div>' +
      '<div class="xtab-filters"><label>filters</label></div>' +
      '<div class="xtab-message">&nbsp;</div>' +
      '<div class="xtab-data">' +
      '<div class="xtab-data-top"><div class="xtab-corner"></div><div class="xtab-dims xtab-h">&nbsp;</div></div>' +
      '<div class="xtab-data-bottom"><div class="xtab-dims xtab-v">&nbsp;</div><div class="xtab-vals-scroll"><div class="xtab-vals">&nbsp;</div></div></div>' +
      '</div>';

    const dimsList = el.querySelector('.xtab-dims-list');
    for (const dim of this.options.dimensions) {
      dimsList.insertAdjacentHTML(
        'beforeend',
        `<div draggable="true" data-name="${dim}">${fieldLabel(dim)}</div>`,
      );
    }
    const valsList = el.querySelector('.xtab-vals-list');
    for (const value of this.options.values) {
      valsList.insertAdjacentHTML(
        'beforeend',
        `<div draggable="true" data-name="${value}">${fieldLabel(value)}</div>`,
      );
    }

    el.addEventListener('dragstart', (e) => this._onDragStart(e));
    el.addEventListener('dragover', (e) => this._onDragOver(e));
    el.addEventListener('drop', (e) => this._onDrop(e));

    el.querySelectorAll('.xtab-data .xtab-dims').forEach((node) =>
      node.addEventListener('scroll', () => this._syncScroll()),
    );
    el.querySelector('.xtab-vals').addEventListener('click', (e) => this._onValueClick(e));
    el.querySelector('.xtab-filters').addEventListener('click', (e) => this._onFilterClick(e));

    this.reset();
  }

  // ---- drag & drop -------------------------------------------------------

  _onDragStart(e) {
    this._dragging = e.target;
  }

  _canDrop(e) {
    const source = this._dragging?.parentElement;
    if (!source) return false;
    const target = e.target;
    if (source.classList.contains('xtab-dims-list')) {
      return !!target.closest('.xtab-dims, .xtab-filters');
    }
    if (source.classList.contains('xtab-vals-list')) {
      return !!target.closest('.xtab-vals-scroll');
    }
    return false;
  }

  _onDragOver(e) {
    if (this._canDrop(e)) e.preventDefault();
  }

  _onDrop(e) {
    const dragged = this._dragging;
    const source = dragged?.parentElement;
    if (!source) return;
    const name = dragged.getAttribute('data-name') ?? dragged.textContent;

    if (source.classList.contains('xtab-dims-list')) {
      if (e.target.closest('.xtab-filters')) this.addFilter(name);
      else if (e.target.closest('.xtab-dims.xtab-h')) this.addHDim(name);
      else if (e.target.closest('.xtab-dims.xtab-v')) this.addVDim(name);
    } else if (source.classList.contains('xtab-vals-list')) {
      if (e.target.closest('.xtab-vals-scroll')) this.addValue(name);
    }

    this._dragging = null;
  }

  _onFilterClick(e) {
    // The remove control is the little "×" before the label.
    if (e.target.closest('.xtab-filter-remove')) {
      const holder = e.target.closest('div[data-dim]');
      if (holder) this.removeFilter(holder.getAttribute('data-dim'));
    }
  }

  _onValueClick(e) {
    const coords = e.target._coords;
    if (!coords) return;
    const hf = filtersForLeaf(this._hDims, this._hTree, coords[0]);
    const vf = filtersForLeaf(this._vDims, this._vTree, coords[1]);
    this.element.dispatchEvent(
      new CustomEvent('xtab:cellclick', {
        bubbles: true,
        detail: { col: coords[0], row: coords[1], value: coords[2], hFilter: hf, vFilter: vf },
      }),
    );
  }

  _syncScroll() {
    const data = this.element.querySelector('.xtab-data');
    const dx = data.querySelector('.xtab-h').scrollLeft;
    const dy = data.querySelector('.xtab-v').scrollTop;
    const vals = data.querySelector('.xtab-vals');
    vals.style.top = `${-dy}px`;
    vals.style.left = `${-dx}px`;
  }

  // ---- state -------------------------------------------------------------

  reset() {
    this._filters = [];
    this._hDims = [];
    this._vDims = [];
    this._value = undefined;
    this._xc = undefined;

    this.clearMessage();
    this._filterStrips.clear();
    this.element.querySelectorAll('.xtab-filters div[data-dim]').forEach((n) => n.remove());
    this.refreshData();
  }

  save() {
    const filters = [];
    for (const [dim, strip] of this._filterStrips) {
      filters.push({ name: dim, values: strip.getValues() });
    }
    return { filters, h_dims: this._hDims, v_dims: this._vDims, value: this._value };
  }

  load(state) {
    this.reset();
    for (const f of state.filters ?? []) this.addFilter(f.name, f.values);
    for (const dim of state.h_dims ?? []) this.addHDim(dim);
    for (const dim of state.v_dims ?? []) this.addVDim(dim);
    for (const value of state.value ?? []) this.addValue(value);
    this.refreshData();
  }

  // ---- data access -------------------------------------------------------

  getFilteredData() {
    const criteria = {};
    for (const [dim, strip] of this._filterStrips) {
      criteria[dim] = strip.getValues();
    }
    return filterByObject(this.options.data, criteria);
  }

  getDimValues(dim, data) {
    return uniqueValues(data ?? this.getFilteredData(), dim);
  }

  // ---- mutators ----------------------------------------------------------

  addFilter(dim, selected) {
    if (this._filters.indexOf(dim) > -1) return;
    this._filters.push(dim);

    const holder = document.createElement('div');
    holder.setAttribute('data-dim', dim);
    holder.innerHTML =
      `<label><span class="xtab-filter-remove" title="remove">\u00d7</span>&nbsp;${fieldLabel(dim)}</label>` +
      `<div class="xtab-selstrip-host"></div>`;

    const host = holder.querySelector('.xtab-selstrip-host');
    const strip = new FilterStrip(host, {
      values: this.getDimValues(dim),
      selected,
      onChange: () => this.refreshData(),
    });
    this._filterStrips.set(dim, strip);

    // Existing strips become read-only once another filter is added, matching
    // the original behaviour.
    for (const [d, s] of this._filterStrips) {
      if (d !== dim) s.setReadonly(true);
    }

    this.element.querySelector('.xtab-filters').appendChild(holder);
    this.refreshData();
  }

  removeFilter(dim) {
    const i = this._filters.indexOf(dim);
    if (i >= 0) {
      this._filters.splice(i, 1);
      this._filterStrips.delete(dim);
      const holder = this.element.querySelector(`.xtab-filters div[data-dim="${dim}"]`);
      holder?.remove();
    }
    this.refreshData();
  }

  isActiveDim(dim) {
    return this._hDims.indexOf(dim) > -1 || this._vDims.indexOf(dim) > -1;
  }

  addHDim(dim) {
    if (this.isActiveDim(dim)) return;
    this._hDims.push(dim);
    this.refreshData();
  }

  addVDim(dim) {
    if (this.isActiveDim(dim)) return;
    this._vDims.push(dim);
    this.refreshData();
  }

  addValue(value) {
    if (this._value) {
      if (this._value.indexOf(value) < 0) this._value.push(value);
    } else {
      this._value = [value];
    }
    this.refreshData();
  }

  // ---- export ------------------------------------------------------------

  exportCsv() {
    if (!this._xc) return '';

    let out = '';
    for (const [dim, strip] of this._filterStrips) {
      if (out === '') out = 'filters\n';
      out += `${dim}:\t${strip.getValues().join('\t')}\n`;
    }
    if (out !== '') out += '\ndata\n';
    if (this._value.length === 1) out += `value:\t${this._value[0]}\n`;
    out += this._xc.exportCsv();
    return out;
  }

  // ---- rendering pipeline ------------------------------------------------

  refreshData() {
    if (this._refreshing) return;
    this._refreshing = true;
    // Defer so multiple synchronous mutations coalesce into one refresh.
    setTimeout(() => this.refreshWorker(), 1);
  }

  refreshWorker() {
    const el = this.element;
    this.setMessage('recalculating...');
    const data = this.getFilteredData();

    this._hTree = buildDimTree(data, this._hDims);
    el.querySelector('.xtab-dims.xtab-h').innerHTML = dimLabelsFromTree(this._hTree, this._value);

    this._vTree = buildDimTree(data, this._vDims);
    el.querySelector('.xtab-dims.xtab-v').innerHTML = dimLabelsFromTree(this._vTree);

    const valsEl = el.querySelector('.xtab-vals');
    valsEl.innerHTML = '';

    if (!this._hTree.length || !this._vTree.length) {
      valsEl.innerHTML = `<i>${this._value ? this._value.map(fieldLabel).join() : '&nbsp;'}</i>`;
      this.clearMessage();
      this._refreshing = false;
      return;
    }

    if (!this._value) {
      this.clearMessage();
      this._refreshing = false;
      return;
    }

    const xc = (this._xc = new XtabCalc(
      data,
      this._hDims,
      this._hTree,
      this._vDims,
      this._vTree,
      this._value,
    ));
    xc.recalc();

    this._renderGrid(xc);

    this.clearMessage();
    this._refreshing = false;
  }

  _renderGrid(xc) {
    const el = this.element;
    const valsEl = el.querySelector('.xtab-vals');

    const colLeaves = el.querySelectorAll('.xtab-dims.xtab-h .xtab-leaf li');
    const colOrigin = colLeaves[0].closest('.xtab-dims').getBoundingClientRect().left;
    const colX = [];
    const colW = [];
    colLeaves.forEach((li) => {
      const r = li.getBoundingClientRect();
      colX.push(r.left - colOrigin);
      colW.push(li.clientWidth);
    });

    const rowLeaves = el.querySelectorAll('.xtab-dims.xtab-v .xtab-leaf li');
    const rowOrigin = rowLeaves[0].closest('.xtab-dims').getBoundingClientRect().top;
    const rowY = [];
    const rowH = [];
    rowLeaves.forEach((li) => {
      const r = li.getBoundingClientRect();
      rowY.push(r.top - rowOrigin);
      rowH.push(li.clientHeight);
    });

    const totalW = colX[colX.length - 1] + colW[colW.length - 1];
    const totalH = rowY[rowY.length - 1] + rowH[rowH.length - 1];

    let lastParent = null;
    let groupRow = 0;

    for (let row = 0; row < xc.rows; row++, groupRow++) {
      if (rowLeaves[row].parentNode !== lastParent) {
        groupRow = 0;
        lastParent = rowLeaves[row].parentNode;
      }

      if (this.options.showGrid && groupRow % 2) {
        const band = document.createElement('div');
        band.className = 'xtab-grid';
        band.innerHTML = '&nbsp;';
        Object.assign(band.style, {
          top: `${rowY[row]}px`,
          left: '0px',
          width: `${totalW}px`,
          height: `${rowH[row]}px`,
        });
        valsEl.appendChild(band);
      }

      for (let col = 0; col < xc.cols; col++) {
        for (let val = 0; val < xc.vals; val++) {
          const v = xc.values[row * xc.cols * xc.vals + (col * xc.vals + val)];
          if (this.options.hideZeros && !v) continue;

          const cell = document.createElement('div');
          cell.textContent = String(v);
          Object.assign(cell.style, {
            top: `${rowY[row]}px`,
            left: `${colX[col * xc.vals + val]}px`,
            width: `${colW[col * xc.vals + val]}px`,
          });
          if (!v && this.options.dimZeros) cell.style.opacity = '0.7';
          cell._coords = [col, row, this._value[val]];
          valsEl.appendChild(cell);
        }
      }
    }

    valsEl.style.width = `${totalW}px`;
    valsEl.style.height = `${totalH}px`;
  }

  // ---- messages ----------------------------------------------------------

  setMessage(msg) {
    this.element.querySelector('.xtab-message').textContent = msg;
  }

  clearMessage() {
    this.element.querySelector('.xtab-message').textContent = '';
  }
}

/**
 * Convenience factory.
 * @param {HTMLElement} element
 * @param {Object} [options]
 * @returns {Xtab}
 */
export function createXtab(element, options) {
  return new Xtab(element, options);
}
