import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
const files = new Map([
  ['/', ['index.html', 'text/html; charset=utf-8']],
  ['/favicon.svg', ['favicon.svg', 'image/svg+xml']],
  ['/favicon.ico', ['favicon.svg', 'image/svg+xml']],
  ['/style.css', ['style.css', 'text/css; charset=utf-8']],
  ['/app.mjs', ['app.mjs', 'text/javascript; charset=utf-8']],
  ['/detector.mjs', ['detector.mjs', 'text/javascript; charset=utf-8']],
  ['/capture.mjs', ['capture.mjs', 'text/javascript; charset=utf-8']],
]);
const server = createServer(async (req, res) => {
  const file = files.get(new URL(req.url, 'http://localhost').pathname);
  if (!file) { res.writeHead(404); res.end('No encontrado'); return; }
  try {
    const body = await readFile(new URL(file[0], import.meta.url));
    res.writeHead(200, { 'Content-Type': file[1], 'Cache-Control': 'no-store' });
    res.end(body);
  } catch { res.writeHead(500); res.end('No se pudo cargar el archivo.'); }
});
server.listen(Number(process.env.PORT) || 5173, '127.0.0.1', () => {
  console.log(`Pulso: http://localhost:${server.address().port}`);
});
