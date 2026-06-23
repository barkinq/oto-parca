import { createServer } from 'http';
import { readFileSync, existsSync } from 'fs';
import { join, extname } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;

const mimeTypes = {
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.html': 'text/html',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

// SSR server'ı import et
const { default: handler } = await import('./dist/server/server.js');

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost`);
  const pathname = url.pathname;

  // Static dosyaları serve et
  const clientPath = join(__dirname, 'dist/client', pathname);
  if (pathname !== '/' && existsSync(clientPath) && !clientPath.endsWith('/')) {
    const ext = extname(clientPath);
    const mime = mimeTypes[ext] || 'application/octet-stream';
    res.setHeader('Content-Type', mime);
    res.setHeader('Cache-Control', 'public, max-age=31536000');
    res.end(readFileSync(clientPath));
    return;
  }

  // SSR handler'a aktar
  handler(req, res);
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
