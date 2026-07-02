// Vanilla replacement for the original (missing) `selStrip` jQuery plugin.
//
// A FilterStrip renders a horizontal strip of toggleable value chips. Clicking a
// chip toggles whether that value is selected. It emits a "change" event and
// exposes the currently selected values.

import { escapeHtml, nameToLabel } from './render.js';

export class FilterStrip {
  /**
   * @param {HTMLElement} el       container element
   * @param {Object}      options
   * @param {Array<*>}    options.values    all selectable values
   * @param {Array<*>}    [options.selected] initially selected values (default: all)
   * @param {Function}    [options.onChange] called with the selected values array
   */
  constructor(el, { values = [], selected, onChange } = {}) {
    this.el = el;
    this.values = values.slice();
    this.selected = new Set(selected ?? values);
    this.onChange = onChange;
    this.readonly = false;

    this.el.classList.add('xtab-selstrip');
    this.el.addEventListener('click', (e) => this._handleClick(e));
    this.render();
  }

  render() {
    this.el.innerHTML = this.values
      .map((value) => {
        const on = this.selected.has(value);
        return (
          '<span class="xtab-chip' +
          (on ? ' is-selected' : '') +
          '" data-value="' +
          escapeHtml(value) +
          '">' +
          escapeHtml(nameToLabel(value)) +
          '</span>'
        );
      })
      .join('');
  }

  _handleClick(e) {
    if (this.readonly) return;
    const chip = e.target.closest('.xtab-chip');
    if (!chip || !this.el.contains(chip)) return;

    // Map the clicked chip's text back to the original value.
    const idx = Array.prototype.indexOf.call(this.el.children, chip);
    if (idx < 0) return;
    const value = this.values[idx];

    if (this.selected.has(value)) {
      this.selected.delete(value);
    } else {
      this.selected.add(value);
    }
    this.render();
    this.onChange?.(this.getValues());
  }

  /** @returns {Array<*>} selected values, in original order. */
  getValues() {
    return this.values.filter((v) => this.selected.has(v));
  }

  setReadonly(flag) {
    this.readonly = !!flag;
    this.el.classList.toggle('is-readonly', this.readonly);
  }
}
