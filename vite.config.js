import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { execSync } from 'node:child_process';

// Stamped into the bundle and shown on the Account page, so which build a
// device is actually running is a thing you can read rather than infer. A
// stale cached copy of index.html has more than once looked like a feature
// failing to deploy.
const buildId = (() => {
  let commit = 'unknown';
  try {
    commit = execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim();
  } catch {
    // Not a git checkout (or git unavailable) — the date alone still helps.
  }
  return `${commit} · ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC`;
})();

// IMPORTANT: base must match your GitHub repo name for project-site Pages
// (e.g. https://yourname.github.io/student-driver-log/).
// If you're deploying to a user/org site (yourname.github.io) instead,
// set base back to '/'.
export default defineConfig({
  plugins: [react()],
  base: '/student-driver-log/',
  define: {
    __BUILD_ID__: JSON.stringify(buildId),
  },
});
