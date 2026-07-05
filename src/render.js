// Rendering helpers: turn dimension trees into label markup.
// These produce HTML strings (no jQuery). Values are escaped to avoid injecting
// markup from the dataset.

/** Human label for a raw dimension value (empty string -> "(blank)"). */
export function nameToLabel(name) {
  return name === '' ? '(blank)' : String(name);
}

/**
 * Human label for a raw JSON property (field) name: Title_Snake_Case becomes a
 * space-separated label for display. The raw name is kept elsewhere for identity.
 */
export function fieldLabel(name) {
  return String(name).replace(/_/g, ' ');
}

/**
 * Normalize a value initializer element into a `{ field, type }` pair.
 *
 * Accepts either a plain field-name string (legacy form) or an object of the
 * shape `{ field, type }`. Strings and objects without a `type` yield
 * `type: undefined`, which renders identically to the original integer output.
 *
 * @param {string|{field: string, type?: string}} spec
 * @returns {{ field: string, type: (string|undefined) }}
 */
export function normalizeValueSpec(spec) {
  if (spec && typeof spec === 'object') {
    return { field: spec.field, type: spec.type };
  }
  return { field: spec, type: undefined };
}

/**
 * Format an aggregated numeric value for display according to its type.
 *
 * - `currency`: prefixed with `$`. Magnitudes >= 1000 are rounded to one
 *   decimal place with a scale suffix (`k` = 1e3, `m` = 1e6, `b` = 1e9), e.g.
 *   `$1.2k`, `$10.3m`. Smaller magnitudes render as a plain `$`-prefixed
 *   integer (e.g. `$847`). Negative values keep their sign (`-$1.2k`).
 * - `integer` / unspecified: the plain integer string (legacy behaviour).
 *
 * @param {number} value
 * @param {string} [type]
 * @returns {string}
 */
export function formatValue(value, type) {
  if (type !== 'currency') return String(value);

  const sign = value < 0 ? '-' : '';
  const abs = Math.abs(value);

  if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(1)}b`;
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(1)}m`;
  if (abs >= 1e3) return `${sign}$${(abs / 1e3).toFixed(1)}k`;
  return `${sign}$${abs}`;
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
    html += '<li>' + escapeHtml(fieldLabel(value)) + '</li>';
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
