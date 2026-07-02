// Aggregation engine — framework-agnostic, no DOM.
//
// XtabCalc flattens the horizontal and vertical dimension trees into a single
// dense grid and sums the selected value fields into a typed array.

import { filterByObject } from './data.js';
import { countLeaves } from './tree.js';

function repeatString(pattern, count) {
  if (count < 1) return '';
  return pattern.repeat(count);
}

const isLeaf = (node) => typeof node === 'string' || node instanceof String;

export class XtabCalc {
  /**
   * @param {Array<Object>} data     already-filtered rows
   * @param {Array<string>} hDims    horizontal dimension names
   * @param {Array}         hTree    horizontal dimension tree
   * @param {Array<string>} vDims    vertical dimension names
   * @param {Array}         vTree    vertical dimension tree
   * @param {Array<string>} values   value/measure field names
   */
  constructor(data, hDims, hTree, vDims, vTree, values) {
    this._data = data;
    this._hDims = hDims;
    this._hTree = hTree;
    this._vDims = vDims;
    this._vTree = vTree;
    this._values = values;

    this.cols = countLeaves(hTree);
    this.rows = countLeaves(vTree);
    this.vals = values.length;
    this.values = new Int32Array(this.cols * this.rows * this.vals);
  }

  recalc() {
    this._visitRow({}, this._data, this._vTree, 0, 0);
    return this;
  }

  _visitRow(filter, data, tree, level, row) {
    for (const node of tree) {
      if (isLeaf(node)) {
        filter[this._vDims[level]] = node;
        this._visitCols(filter, filterByObject(data, filter), this._hTree, 0, row, 0);
        delete filter[this._vDims[level]];
        row += 1;
      } else {
        filter[this._vDims[level]] = node.name;
        row = this._visitRow(filter, filterByObject(data, filter), node.children, level + 1, row);
        delete filter[this._vDims[level]];
      }
    }
    return row;
  }

  _visitCols(filter, data, tree, level, row, col) {
    for (const node of tree) {
      if (isLeaf(node)) {
        const dim = this._hDims[level];
        const val = node;
        const matched = data.filter((el) => !(dim in el) || el[dim] == val);
        for (const el of matched) {
          for (let i = 0; i < this.vals; i++) {
            const field = this._values[i];
            if (field in el) {
              this.values[row * this.cols * this.vals + col * this.vals + i] += parseInt(el[field], 10);
            }
          }
        }
        col += 1;
      } else {
        filter[this._hDims[level]] = node.name;
        col = this._visitCols(filter, filterByObject(data, filter), node.children, level + 1, row, col);
        delete filter[this._hDims[level]];
      }
    }
    return col;
  }

  /**
   * Export the crosstab as a tab-separated string (spreadsheet-friendly).
   * @returns {string}
   */
  exportCsv() {
    const vDims = this._vDims;
    const values = this._values;

    const header = [];
    for (let i = 0; i < this._hDims.length; i++) {
      header.push(repeatString('\t', vDims.length - 1));
    }
    if (values.length > 1) {
      header.push(repeatString('\t', vDims.length - 1));
    }

    const exportHDim = (tree, level, valueFields) => {
      let colCount = 0;
      for (const node of tree) {
        if (isLeaf(node)) {
          header[level] += '\t' + node;
          if (valueFields) {
            const width = exportHDim(valueFields, level + 1);
            header[level] += repeatString('\t', width - 1);
            colCount += width;
          } else {
            colCount += 1;
          }
        } else {
          header[level] += '\t' + node.name;
          const width = exportHDim(node.children, level + 1, valueFields);
          header[level] += repeatString('\t', width - 1);
          colCount += width;
        }
      }
      return colCount;
    };

    exportHDim(this._hTree, 0, values.length === 1 ? false : values);

    let row = 0;
    const exportVDim = (tree, prefix) => {
      for (const node of tree) {
        if (isLeaf(node)) {
          const vc = values.length;
          const start = this.cols * vc * row;
          let line = prefix;
          if (line !== '') line += '\t';
          line += '="' + node + '"';
          for (let i = 0; i < this.cols * vc; i++) {
            line += '\t' + this.values[start + i];
          }
          header.push(line);
          row += 1;
        } else {
          const sep = prefix === '' ? '' : '\t';
          exportVDim(node.children, prefix + sep + '="' + node.name + '"');
        }
      }
    };

    exportVDim(this._vTree, '');

    return header.join('\n');
  }
}
