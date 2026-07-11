import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    outDir: 'dist',
    lib: {
      entry: 'src/index.ts',
      name: 'IONAI',
      formats: ['iife'],
      fileName: () => 'widget.js',
    },
    rollupOptions: {
      output: {
        extend: true,
      },
    },
  },
  define: {
    'process.env.NODE_ENV': JSON.stringify('production'),
  },
});
