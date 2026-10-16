import { mkdir, copyFile } from 'node:fs/promises';

// Publish only browser assets. The local HTTP server is not needed in production.
const assets = ['index.html', 'style.css', 'app.mjs', 'detector.mjs', 'capture.mjs', 'favicon.svg'];
const output = new URL('./dist/', import.meta.url);
await mkdir(output, { recursive: true });
for (const asset of assets) {
  await copyFile(new URL(asset, import.meta.url), new URL(asset, output));
}
console.log(`Pulso: ${assets.length} archivos estáticos preparados en dist/.`);
