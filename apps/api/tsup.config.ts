import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/server.ts'],
  format: ['esm'],
  target: 'node20',
  outDir: 'dist',
  clean: true,
  sourcemap: true,
  // @mira/shared se empaqueta dentro del bundle (no se publica a npm),
  // el resto de dependencias se resuelve desde node_modules en runtime.
  noExternal: ['@mira/shared'],
});
