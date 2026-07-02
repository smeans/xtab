// Pure data helpers — no DOM, no framework, no global side effects.
//
// NOTE: The original 2015 code monkey-patched `Array.prototype.filterByObject`.
// Here it is a standalone pure function instead, so we never touch global state.

/**
 * Filter an array of row objects by a plain "criteria" object.
 *
 * For each key in `criteria`:
 *   - if the value is an array, the row matches when its field value is one of them;
 *   - otherwise the row matches when its field value strictly equals the criterion.
 * Keys that are not present on a row are ignored (treated as a match).
 *
 * @param {Array<Object>} rows
 * @param {Object} criteria
 * @returns {Array<Object>}
 */
export function filterByObject(rows, criteria) {
  return rows.filter((row) => {
    for (const key in criteria) {
      if (!Object.prototype.hasOwnProperty.call(criteria, key)) continue;
      if (!(key in row)) continue;

      const want = criteria[key];
      if (Array.isArray(want)) {
        if (want.indexOf(row[key]) < 0) return false;
      } else if (want != row[key]) {
        return false;
      }
    }
    return true;
  });
}

/**
 * Return the sorted list of distinct values a dimension takes across the rows.
 *
 * @param {Array<Object>} rows
 * @param {string} dimension
 * @returns {Array<*>}
 */
export function uniqueValues(rows, dimension) {
  const seen = [];
  for (const row of rows) {
    if (seen.indexOf(row[dimension]) < 0) {
      seen.push(row[dimension]);
    }
  }
  seen.sort();
  return seen;
}
