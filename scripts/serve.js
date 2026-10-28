/**
 * Servidor local para desarrollo: `npm start` → http://localhost:3000
 *
 * Por qué uno propio y no `npx serve`: no descarga nada de internet al
 * arrancar y aplica las cabeceras de _headers (la CSP, entre otras). Así lo
 * que se prueba en local se comporta igual que el sitio publicado.
 *
 * Solo para desarrollo: escucha en 127.0.0.1, no en la red.
 */

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const PORT = Number(process.env.PORT ?? 3002);

/** @type {Record<string, string>} */
const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};

/**
 * Lee _headers: líneas sin sangría son rutas ("/*", "/fonts/*"), líneas con
 * sangría son cabeceras de la ruta anterior. Ignora comentarios (#).
 * @returns {Promise<{ pattern: RegExp, headers: [string, string][] }[]>}
 */
async function loadHeaderRules() {
  const text = await readFile(join(ROOT, '_headers'), 'utf8');
  /** @type {{ pattern: RegExp, headers: [string, string][] }[]} */
  const rules = [];
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim() || line.trim().startsWith('#')) continue;
    if (!/^\s/.test(line)) {
      const pattern = new RegExp(
        `^${line
          .trim()
          .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
          .replace(/\*/g, '.*')}$`,
      );
      rules.push({ pattern, headers: [] });
    } else {
      const [name, ...value] = line.trim().split(':');
      // En local no hay https: upgrade-insecure-requests mandaría todo a https://localhost.
      const cleanValue = value
        .join(':')
        .trim()
        .replace(/;\s*upgrade-insecure-requests/, '');
      rules.at(-1)?.headers.push([name.trim(), cleanValue]);
    }
  }
  return rules;
}

const headerRules = await loadHeaderRules();

createServer(async (request, response) => {
  try {
    const url = new URL(request.url ?? '/', 'http://localhost');
    const path = decodeURIComponent(url.pathname); // lanza un error si la URL trae un % inválido
    const filePath = normalize(join(ROOT, path.endsWith('/') ? `${path}index.html` : path));

    // Nunca servir archivos fuera de la carpeta del juego (por ejemplo /../secreto)
    // ni archivos ocultos (.git, .env).
    if (!filePath.startsWith(ROOT + sep) || path.split('/').some((part) => part.startsWith('.'))) {
      response.writeHead(403).end();
      return;
    }

    let body = await readFile(filePath);
    // Aquí una regla posterior reemplaza la cabecera; en producción se unen con coma.
    // Por eso _headers no debe definir la misma cabecera en reglas que se superponen.
    for (const rule of headerRules) {
      if (rule.pattern.test(path)) for (const [name, value] of rule.headers) response.setHeader(name, value);
    }
    response.setHeader('Content-Type', CONTENT_TYPES[extname(filePath)] ?? 'application/octet-stream');
    // Comprimir como lo hacen Cloudflare Pages, Netlify y GitHub Pages: así las
    // mediciones de peso y velocidad en local se parecen a las del sitio publicado.
    if (extname(filePath) !== '.woff2' && /\bgzip\b/.test(String(request.headers['accept-encoding']))) {
      body = gzipSync(body);
      response.setHeader('Content-Encoding', 'gzip');
      response.setHeader('Vary', 'Accept-Encoding');
    }
    response.writeHead(200).end(body);
  } catch {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('No encontrado');
  }
}).listen(PORT, '127.0.0.1', () => {
  console.log(`Matemáticas con Dados en http://localhost:${PORT}`);
});
