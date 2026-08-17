import { defineConfig } from 'vite';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, join, relative } from 'node:path';

const root = resolve(import.meta.dirname);

/**
 * Tiny HTML partial include.
 *   <!-- @include partials/nav.html -->
 * Paths are resolved from the project root. Includes may nest.
 * Runs in dev and build, before Vite processes asset URLs, so anything
 * inside a partial (images, scripts) is handled like inline markup.
 */
function htmlIncludes() {
  const expand = (html, depth = 0) => {
    if (depth > 10) return html;
    return html.replace(/<!--\s*@include\s+([^\s]+)\s*-->/g, (_, file) => {
      const partial = readFileSync(join(root, file), 'utf-8');
      return expand(partial, depth + 1);
    });
  };
  return {
    name: 'html-includes',
    enforce: 'pre',
    transformIndexHtml: { order: 'pre', handler: (html) => expand(html) },
    // Rebuild the page when a partial changes
    handleHotUpdate({ file, server }) {
      if (file.includes(`${join(root, 'partials')}`)) {
        server.ws.send({ type: 'full-reload' });
      }
    },
  };
}

/** Every .html at the root and one level down (blog/, …) becomes a build entry. */
function htmlEntries() {
  const skip = new Set(['node_modules', 'dist', 'public', 'partials', '.git', 'src']);
  const entries = {};
  const walk = (dir, depth) => {
    for (const name of readdirSync(dir)) {
      if (skip.has(name)) continue;
      const full = join(dir, name);
      const st = statSync(full);
      if (st.isDirectory()) { if (depth < 1) walk(full, depth + 1); continue; }
      if (!name.endsWith('.html')) continue;
      if (name === 'tc-test.html') continue;
      const key = relative(root, full).replace(/\\/g, '/').replace(/\.html$/, '');
      entries[key] = full;
    }
  };
  walk(root, 0);
  return entries;
}

export default defineConfig({
  plugins: [htmlIncludes()],
  build: {
    rollupOptions: { input: htmlEntries() },
  },
});
