import { Xtab } from '../src/index.js';
import { sampleData, dimensions, values } from './sample-data.js';

let host = document.querySelector('#xtab');
const dataInput = document.querySelector('#data-input');
const dataError = document.querySelector('#data-error');
const fieldConfigBody = document.querySelector('#field-config-body');

let xtab = null;
let currentData = sampleData;

/**
 * Replace the host element with a fresh clone so that event listeners attached
 * by a previous Xtab instance are discarded. Without this, every rebuild leaves
 * the old instance's drag/drop handlers on the node and a single drop fires them
 * all (which duplicated dropped chips once per stale instance).
 */
function freshHost() {
  const replacement = host.cloneNode(false);
  host.replaceWith(replacement);
  host = replacement;
  // Log cell clicks so you can see the drill-down filter payload.
  host.addEventListener('xtab:cellclick', (e) => {
    // eslint-disable-next-line no-console
    console.log('cell clicked', e.detail);
  });
}

/**
 * Collect the ordered list of field names present in a dataset.
 * @param {Array<Object>} data
 * @returns {string[]}
 */
function fieldsFromData(data) {
  const seen = new Set();
  const fields = [];
  for (const row of data) {
    if (row && typeof row === 'object') {
      for (const key of Object.keys(row)) {
        if (!seen.has(key)) {
          seen.add(key);
          fields.push(key);
        }
      }
    }
  }
  return fields;
}

/**
 * Read the current ignore/dimension/value status for every field from the form.
 * @returns {{ dimensions: string[], values: string[] }}
 */
function readFieldConfig() {
  const dims = [];
  const vals = [];
  fieldConfigBody.querySelectorAll('tr[data-field]').forEach((row) => {
    const field = row.getAttribute('data-field');
    const checked = row.querySelector('input[type="radio"]:checked');
    const status = checked ? checked.value : 'ignore';
    if (status === 'dimension') dims.push(field);
    else if (status === 'value') vals.push(field);
  });
  return { dimensions: dims, values: vals };
}

/**
 * Build the field configuration table with a three-state radio group per field.
 * @param {string[]} fields
 * @param {Set<string>} dimSet fields to preselect as dimensions
 * @param {Set<string>} valSet fields to preselect as values
 */
function buildFieldConfig(fields, dimSet, valSet) {
  fieldConfigBody.innerHTML = '';
  for (const field of fields) {
    let status = 'ignore';
    if (valSet.has(field)) status = 'value';
    else if (dimSet.has(field)) status = 'dimension';

    const tr = document.createElement('tr');
    tr.setAttribute('data-field', field);

    const nameCell = document.createElement('td');
    nameCell.className = 'field-name';
    nameCell.textContent = field;
    tr.appendChild(nameCell);

    for (const option of ['ignore', 'dimension', 'value']) {
      const td = document.createElement('td');
      td.className = 'radio-cell';
      const input = document.createElement('input');
      input.type = 'radio';
      input.name = `field-${field}`;
      input.value = option;
      input.checked = option === status;
      input.addEventListener('change', rebuildFromConfig);
      td.appendChild(input);
      tr.appendChild(td);
    }

    fieldConfigBody.appendChild(tr);
  }
}

/**
 * (Re)create the Xtab instance from the current data and field configuration.
 * @param {Array<Object>} data
 */
function buildXtab(data) {
  const { dimensions: dims, values: vals } = readFieldConfig();

  freshHost();

  xtab = new Xtab(host, {
    data,
    dimensions: dims,
    values: vals,
    showGrid: true,
  });

  // Seed a starting layout so the grid shows something immediately.
  if (dims[0]) xtab.addVDim(dims[0]);
  if (dims[1]) xtab.addHDim(dims[1]);
  if (vals[0]) xtab.addValue(vals[0]);
}

/** Rebuild the Xtab when the field configuration changes. */
function rebuildFromConfig() {
  buildXtab(currentData);
}

/** Parse the textarea, and if valid, rebuild the config form and Xtab. */
function onDataChanged() {
  let parsed;
  try {
    parsed = JSON.parse(dataInput.value);
  } catch (err) {
    dataError.textContent = `Invalid JSON: ${err.message}`;
    return;
  }
  if (!Array.isArray(parsed)) {
    dataError.textContent = 'Data must be a JSON array of row objects.';
    return;
  }
  if (!parsed.length) {
    dataError.textContent = 'Data array is empty.';
    return;
  }

  dataError.innerHTML = '&nbsp;';
  currentData = parsed;

  const fields = fieldsFromData(parsed);
  // Infer numeric fields as values and the rest as dimensions.
  const dimSet = new Set();
  const valSet = new Set();
  for (const field of fields) {
    if (typeof parsed[0][field] === 'number') valSet.add(field);
    else dimSet.add(field);
  }

  buildFieldConfig(fields, dimSet, valSet);
  buildXtab(parsed);
}

dataInput.addEventListener('input', onDataChanged);

document.querySelector('#export').addEventListener('click', async () => {
  if (!xtab) return;
  const tsv = xtab.exportCsv();
  try {
    await navigator.clipboard.writeText(tsv);
    // eslint-disable-next-line no-alert
    alert('Copied TSV to clipboard.');
  } catch (err) {
    // eslint-disable-next-line no-alert
    alert(`Could not copy to clipboard: ${err.message}`);
  }
});

document.querySelector('#reset').addEventListener('click', () => xtab && xtab.reset());

// Initial load: seed the textarea and form from the random sample data.
dataInput.value = JSON.stringify(sampleData, null, 2);
buildFieldConfig(fieldsFromData(sampleData), new Set(dimensions), new Set(values));
buildXtab(sampleData);
