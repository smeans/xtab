import { defineConfig } from 'vite';
import { resolve } from 'node:path';

// The project has two Vite "modes":
//   - `vite` / `vite dev`  -> serves the demo page (index.html) for local development
//   - `vite build`         -> builds the reusable library from src/index.js
//
// We switch behaviour based on the command so a single config serves both needs.
export default defineConfig(({ command }) => {
  if (command === 'build') {
    return {
      build: {
        lib: {
          entry: resolve(__dirname, 'src/index.js'),
          name: 'Xtab',
          fileName: 'xtab',
          formats: ['es', 'umd'],
        },
        sourcemap: true,
      },
    };
  }

  // dev server: serve the demo
  return {
    root: '.',
  };
});
