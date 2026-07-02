// Pure dimension-tree helpers — no DOM.
//
// A "dimension tree" describes the nested grouping produced by a list of
// dimensions. A leaf is a plain string (the value of the deepest dimension);
// an internal node is `{ name, children }`.

import { filterByObject, uniqueValues } from './data.js';

/**
 * Build the nested dimension tree for `dimensions` over `rows`.
 *
 * @param {Array<Object>} rows
 * @param {Array<string>} dimensions ordered outermost -> innermost
 * @returns {Array} tree (array of strings and/or {name, children})
 */
export function buildDimTree(rows, dimensions) {
  const tree = buildLevel(rows, dimensions, 0, {});
  return tree ?? [];
}

function buildLevel(rows, dimensions, level, filter) {
  if (level >= dimensions.length) return null;

  const nodes = [];
  const values = uniqueValues(rows, dimensions[level]);
  values.sort();

  for (const value of values) {
    filter[dimensions[level]] = value;
    const children = buildLevel(
      filterByObject(rows, filter),
      dimensions,
      level + 1,
      filter,
    );
    delete filter[dimensions[level]];

    nodes.push(children ? { name: value, children } : value);
  }

  return nodes;
}

/**
 * Count the leaves of a dimension tree. Side effect: caches `leafcount` on each
 * internal node (matching the original behaviour, used by callers).
 *
 * @param {Array} tree
 * @returns {number}
 */
export function countLeaves(tree) {
  let count = 0;
  for (const node of tree) {
    if (typeof node === 'string' || node instanceof String) {
      count += 1;
    } else {
      node.leafcount = countLeaves(node.children);
      count += node.leafcount;
    }
  }
  return count;
}

/**
 * Given a leaf index, reconstruct the filter object (dimension -> value) that
 * selects the data contributing to that leaf.
 *
 * @param {Array<string>} dimensions
 * @param {Array} tree
 * @param {number} leafIndex
 * @returns {Object}
 */
export function filtersForLeaf(dimensions, tree, leafIndex) {
  const filter = {};
  let counter = 0;

  function walk(nodes, depth) {
    for (const node of nodes) {
      if (typeof node === 'string' || node instanceof String) {
        if (counter === leafIndex) {
          filter[dimensions[depth]] = node;
          return true;
        }
        counter += 1;
      } else if (walk(node.children, depth + 1)) {
        filter[dimensions[depth]] = node.name;
        return true;
      }
    }
    return false;
  }

  walk(tree, 0);
  return filter;
}
