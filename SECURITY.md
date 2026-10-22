# Seguridad

## Modelo de amenazas (básico)

Es un sitio estático sin servidor propio, sin cuentas y sin datos personales. Lo que hay que proteger es que **el juego siga funcionando y sea seguro para un niño**.

| Dato                               | De dónde viene             | ¿Confiable?                                                                                                  | Cómo se trata                                                                                                                                                                                                    |
| ---------------------------------- | -------------------------- | ------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Textos, colores, ids de operación  | `js/config.js`             | Sí (es código)                                                                                               | Se interpolan en HTML directamente.                                                                                                                                                                              |
| Números de cada ronda              | `js/rules.js`              | Sí (calculados)                                                                                              | Se interpolan directamente.                                                                                                                                                                                      |
| Ajustes guardados                  | `localStorage`             | **No**: cualquiera puede editarlos desde las herramientas del navegador, o pueden venir de una versión vieja | `normalizeSettings()` compara cada campo con una lista cerrada; descarta tipos, rangos, ids y claves heredadas (`__proto__`, `toString`) inválidos; nunca copia texto libre. Probado en `tests/storage.test.js`. |
| Lo que elige el adulto en el panel | Formularios del `<dialog>` | Valores de listas cerradas                                                                                   | Se convierten a número o se comparan con las opciones válidas antes de entrar al borrador.                                                                                                                       |
| Atributos `data-*` de los botones  | El propio HTML             | Sí, pero se validan igual                                                                                    | `game.js` ignora operaciones, niveles y platos que no existen.                                                                                                                                                   |

**Qué podría salir mal y qué lo evita:**

- _Inyección de HTML (XSS):_ nada de texto libre llega a `innerHTML`. Si en el futuro hiciera falta, `escapeHTML()` (`js/dom.js`) ya existe y se usa en `icon()`. Además, la CSP impide ejecutar scripts que no sean archivos del propio sitio.
- _Ajustes alterados que rompen el juego:_ `normalizeSettings()` (ver arriba).
- _Que otro sitio muestre el juego dentro de un iframe (clickjacking):_ `frame-ancestors 'none'` y `X-Frame-Options: DENY`.
- _Que un tercero sepa quién juega:_ no hay peticiones a terceros (ver PRIVACY.md).
- _Dependencias comprometidas:_ el sitio publicado no tiene dependencias. Las herramientas de desarrollo están en `devDependencies`, con versiones fijadas en `package-lock.json`, y no se publican.
- _Secretos en el repositorio:_ no hay claves, tokens ni `.env`. `.gitignore` excluye `.env` por si acaso.

## Content Security Policy

Se aplica de dos formas: la cabecera HTTP en `_headers` (Cloudflare Pages y Netlify) y una etiqueta `<meta>` en `index.html`, que funciona también en GitHub Pages.

| Directiva                    | Valor    | Por qué                                                                                                                                                                                                             |
| ---------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `default-src`                | `'self'` | Por defecto, solo archivos del propio sitio.                                                                                                                                                                        |
| `script-src`                 | `'self'` | Solo los módulos de `js/`. Ningún `<script>` escrito dentro del HTML ni `eval`.                                                                                                                                     |
| `style-src`                  | `'self'` | Solo `css/styles.css`. No hace falta `'unsafe-inline'`: los colores que antes iban en `style="--x:…"` ahora van en `data-vars` y los aplica `applyStyleVars()` con `element.style.setProperty`, que la CSP permite. |
| `img-src`                    | `'self'` | Favicon e íconos. Los SVG del juego van dentro del HTML y no son peticiones.                                                                                                                                        |
| `font-src`                   | `'self'` | Fredoka se sirve desde `fonts/`.                                                                                                                                                                                    |
| `connect-src`                | `'self'` | El service worker solo pide archivos del propio sitio.                                                                                                                                                              |
| `manifest-src`, `worker-src` | `'self'` | `manifest.webmanifest` y `sw.js`.                                                                                                                                                                                   |
| `object-src`                 | `'none'` | Nada de plugins.                                                                                                                                                                                                    |
| `base-uri`                   | `'none'` | Nadie puede cambiar la base de las URLs relativas.                                                                                                                                                                  |
| `form-action`                | `'none'` | El juego no envía formularios.                                                                                                                                                                                      |
| `frame-ancestors`            | `'none'` | Ningún sitio puede mostrar el juego en un iframe (solo en la cabecera: en `<meta>` no tiene efecto).                                                                                                                |
| `upgrade-insecure-requests`  | —        | Solo en la cabecera: si algo se pidiera por http, se pide por https.                                                                                                                                                |

## Otras cabeceras (`_headers`)

| Cabecera                                    | Para qué                                                                         |
| ------------------------------------------- | -------------------------------------------------------------------------------- |
| `X-Content-Type-Options: nosniff`           | El navegador no adivina tipos: un archivo de texto nunca se ejecuta como script. |
| `Referrer-Policy: no-referrer`              | Al salir del sitio no se informa desde dónde se venía.                           |
| `Permissions-Policy`                        | Apaga cámara, micrófono, ubicación, pagos y otras APIs que el juego no usa.      |
| `Cross-Origin-Opener-Policy: same-origin`   | Aísla la pestaña de ventanas de otros sitios.                                    |
| `Cross-Origin-Resource-Policy: same-origin` | Otros sitios no pueden incrustar los archivos del juego.                         |
| `X-Frame-Options: DENY`                     | Lo mismo que `frame-ancestors`, para navegadores antiguos.                       |

En GitHub Pages solo se aplica la CSP de la etiqueta `<meta>` (sin `frame-ancestors`). Ver la tabla de hostings en README.md.

## Cómo verificarlo

```bash
npm start
curl -sI http://localhost:3000/ | grep -iE "content-security|x-content|referrer|permissions|cross-origin"
npm run test:e2e   # los recorridos corren con estas cabeceras y fallan ante cualquier error de consola
```

## Reportar un problema

Abre un issue en el repositorio describiendo el problema (sin publicar un ataque que funcione) o escribe al autor del repositorio.
