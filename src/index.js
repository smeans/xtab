// Public entry point for the xtab library.
//
// Usage:
//   import { Xtab } from 'xtab';
//   import 'xtab/style.css';
//
//   const xtab = new Xtab(document.querySelector('#chart'), {
//     data: rows,
//     dimensions: ['country', 'product'],
//     values: ['sales'],
//   });
//
// The modules are filled in over the course of the migration. This file only
// re-exports the stable public surface so consumers have a single import path.

export { Xtab, createXtab } from './xtab.js';
