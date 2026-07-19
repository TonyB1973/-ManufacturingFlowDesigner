import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    open: false,
    watch: {
      ignored: ['**/.vs/**'],
    },
  },
  preview: { open: false },
});
