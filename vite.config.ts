import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

// base: './' -> the build works on GitHub Pages under any repo name
export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
});
