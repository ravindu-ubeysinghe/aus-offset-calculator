import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

/** `STATIC=1 vite build` produces one self-contained HTML file. */
const singleFile = process.env.STATIC === '1';

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Replace via a callback so `$&`, `$1` etc. in bundled code stay literal. */
const replaceOnce = (html: string, pattern: RegExp, replacement: string) =>
  html.replace(pattern, () => replacement);

const decode = (source: string | Uint8Array) =>
  typeof source === 'string' ? source : new TextDecoder().decode(source);

/**
 * Fold every emitted chunk and stylesheet into index.html and drop the separate
 * asset files.
 *
 * The point is opening the result straight off disk. A `file://` page has an
 * opaque origin, so the browser refuses to fetch its sibling files — both the
 * `<script type="module">` and the `<link rel="stylesheet">` that a normal Vite
 * build emits fail there. Inlining removes every fetch, and the matching
 * `format: 'iife'` below removes the module type, which is the other half of
 * the problem.
 */
function singleFilePlugin(): Plugin {
  return {
    name: 'offset-calc:single-file',
    enforce: 'post',
    generateBundle(_options, bundle) {
      const htmlKey = Object.keys(bundle).find((key) => key.endsWith('.html'));
      const htmlAsset = htmlKey ? bundle[htmlKey] : undefined;
      if (!htmlKey || !htmlAsset || htmlAsset.type !== 'asset') {
        throw new Error('single-file build: no HTML entry found in the bundle');
      }

      let html = decode(htmlAsset.source);
      const scripts: string[] = [];

      for (const [key, output] of Object.entries(bundle)) {
        if (key === htmlKey) continue;

        if (output.type === 'chunk') {
          // Collect now, inject at the end of <body> below. Vite puts its tag
          // in <head>, which is fine for a module script (those are deferred)
          // but not for the classic script this build emits — that would run
          // before #root exists and React would fail to mount.
          scripts.push(output.code.replace(/<\/script/gi, '<\\/script'));
          html = replaceOnce(
            html,
            new RegExp(`\\s*<script[^>]*src="[^"]*${escapeRegExp(key)}"[^>]*>\\s*</script>`),
            '',
          );
          delete bundle[key];
        } else if (key.endsWith('.css')) {
          const css = decode(output.source).replace(/<\/style/gi, '<\\/style');
          html = replaceOnce(
            html,
            new RegExp(`<link[^>]*href="[^"]*${escapeRegExp(key)}"[^>]*>`),
            `<style>\n${css}\n</style>`,
          );
          delete bundle[key];
        }
      }

      const body = scripts.map((code) => `<script>\n${code}\n</script>`).join('\n');
      html = html.includes('</body>')
        ? replaceOnce(html, /<\/body>/, `${body}\n</body>`)
        : html + body;

      // Fail the build rather than shipping a file that silently breaks on disk.
      const leftover = /(?:src|href)="\.?\/?assets\//.exec(html);
      if (leftover) {
        throw new Error(`single-file build: an external reference survived — ${leftover[0]}`);
      }
      if (/<script[^>]*type="module"/.test(html)) {
        throw new Error('single-file build: a module script survived; it cannot load over file://');
      }
      // A classic script is not deferred, so it must come after the mount node.
      if (html.indexOf('<script') < html.indexOf('id="root"')) {
        throw new Error('single-file build: script runs before #root exists; React cannot mount');
      }

      delete bundle[htmlKey];
      bundle['offset-calculator.html'] = {
        ...htmlAsset,
        fileName: 'offset-calculator.html',
        source: html,
      };
    },
  };
}

export default defineConfig({
  plugins: [react(), ...(singleFile ? [singleFilePlugin()] : [])],
  // Relative base so the built bundle also works from file:// inside a
  // Capacitor WebView, not just from a web server root.
  base: './',
  build: {
    outDir: singleFile ? 'dist-static' : 'dist',
    sourcemap: !singleFile,
    emptyOutDir: true,
    // Inline any binary asset as a data URI rather than emitting a sibling file.
    assetsInlineLimit: singleFile ? Number.MAX_SAFE_INTEGER : 4096,
    cssCodeSplit: !singleFile,
    rollupOptions: singleFile
      ? {
          output: {
            // A classic script, not a module — see the plugin comment above.
            format: 'iife',
            // The lazy @capacitor/preferences import would otherwise be a
            // second file to fetch, which file:// cannot do.
            inlineDynamicImports: true,
          },
        }
      : {},
  },
});
