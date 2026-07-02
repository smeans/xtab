// Rendering helpers: turn dimension trees into label markup.
// These produce HTML strings (no jQuery). Values are escaped to avoid injecting
// markup from the dataset.

/** Human label for a raw dimension value (empty string -> "(blank)"). */
export function nameToLabel(name) {
  return name === '' ? '(blank)' : String(name);
}

/** Escape a string for safe insertion as HTML text content. */
export function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const isLeaf = (node) => typeof node === 'string' || node instanceof String;

/** Markup for the list of value/measure labels shown under a leaf. */
export function valLabels(values) {
  let html = '<ul class="xtab-leaf xtab-val-leaf">';
  for (const value of values) {
    html += '<li>' + escapeHtml(nameToLabel(value)) + '</li>';
  }
  html += '</ul>';
  return html;
}

/**
 * Recursively render dimension-tree labels.
 *
 * @param {Array} tree
 * @param {Array<string>} [values] value fields; when >1 they are shown per leaf
 * @returns {string}
 */
export function dimLabelsFromTree(tree, values) {
  if (!tree) return '';

  let html = '';
  let leafOnly = true;

  for (const node of tree) {
    html += '<li>';
    if (isLeaf(node)) {
      if (!values || values.length <= 1) {
        html += escapeHtml(nameToLabel(node));
      } else {
        html += escapeHtml(nameToLabel(node)) + valLabels(values);
        leafOnly = false;
      }
    } else {
      html += escapeHtml(nameToLabel(node.name)) + dimLabelsFromTree(node.children, values);
      leafOnly = false;
    }
    html += '</li>';
  }

  return leafOnly
    ? '<ul class="xtab-leaf">' + html + '</ul>'
    : '<ul>' + html + '</ul>';
}
