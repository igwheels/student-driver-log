import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// IMPORTANT: base must match your GitHub repo name for project-site Pages
// (e.g. https://yourname.github.io/student-driver-log/).
// If you're deploying to a user/org site (yourname.github.io) instead,
// set base back to '/'.
export default defineConfig({
  plugins: [react()],
  base: '/student-driver-log/',
});
