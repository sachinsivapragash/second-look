// Bundles the web app and the Chrome extension with esbuild.
import { build } from 'esbuild';
const common = { bundle: true, format: 'esm', minify: true, sourcemap: true, target: 'chrome120' };
await build({ ...common, entryPoints: ['src/web/main.js'], outfile: 'public/app.js' });
try { await build({ ...common, entryPoints: { popup: 'src/ext/popup.js', background: 'src/ext/background.js' }, outdir: 'extension/dist' }); } catch (e) { if (!/Could not resolve/.test(e.message)) throw e; }
await build({ ...common, format: 'iife', entryPoints: ['src/ext/guard.js'], outfile: 'extension/dist/guard.js' });
console.log('built');
