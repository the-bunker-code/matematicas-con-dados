# Matemáticas con Dados

Juego para que niños de 3 a 7 años aprendan a **contar, sumar, restar, multiplicar y dividir** con dados y tapitas de botella reales. Nació para una niña de casi 4 años, que aprende mejor tocando objetos que mirando números.

Está hecho con **HTML, CSS y JavaScript, sin framework ni paso de compilación**. La idea es que cualquier persona que esté empezando pueda leer el código de arriba a abajo y entenderlo. Lo que se publica son exactamente los archivos del repositorio.

- Qué datos guarda (ninguno del niño): [PRIVACY.md](PRIVACY.md)
- Seguridad y modelo de amenazas: [SECURITY.md](SECURITY.md)
- Cambios: [CHANGELOG.md](CHANGELOG.md)

## Cómo abrirlo

El código usa módulos de JavaScript (`import` / `export`). Por seguridad, los navegadores no cargan módulos si abres el archivo con doble clic (`file://`), así que hace falta un servidor local:

```bash
npm start                    # Node 22 o superior. No descarga nada: usa scripts/serve.js
python3 -m http.server 3000  # si tienes Python (sin las cabeceras de _headers)
```

Luego abre `http://localhost:3000`.

`npm start` aplica las mismas cabeceras de seguridad que el sitio publicado (las lee de `_headers`) y comprime con gzip, así lo que ves en local se comporta como en producción.

## Pruebas y herramientas

Las herramientas son solo para desarrollo (`devDependencies`); el sitio publicado no las usa.

```bash
npm install          # una vez, para instalar las herramientas
npx playwright install chromium   # una vez, para los recorridos en el navegador

npm test             # pruebas unitarias con node:test (sin navegador)
npm run test:coverage  # lo mismo, y falla si rules, storage o spanish bajan del 90 %
npm run test:e2e     # recorridos reales con Playwright, en 390×844 y 1366×900
npm run lint         # ESLint
npm run format       # Prettier (format:check solo revisa)
npm run typecheck    # tipos a partir de los comentarios JSDoc (tsc --noEmit)
npm run validate:html
npm run check        # todo lo anterior junto
```

Las pruebas unitarias recorren todas las combinaciones de operación, nivel, caras del dado y modo de juego, con 300 rondas cada una, y verifican, entre otras cosas:

- La respuesta nunca es negativa y siempre está entre las 3 opciones.
- **Con tapitas reales, ninguna ronda pide más tapitas de un color de las que hay en la caja**, incluso con cajas muy chicas.
- No se repite la misma tirada dos veces seguidas.
- Los ajustes guardados con valores inválidos o alterados se corrigen solos.
- Al equivocarse, la app ayuda y nunca dice "no"; el aviso "dos más y guardamos" y los botones del final a los 4 segundos.

Los recorridos de Playwright (`tests/e2e/`) juegan las 5 operaciones en todos sus niveles, una sesión completa, el panel de ajustes, el uso solo con teclado y el funcionamiento sin internet. Fallan si aparece cualquier error en la consola.

## Estructura

```
index.html            estructura de las 3 pantallas y el panel de ajustes
css/styles.css        todos los estilos, en 9 secciones numeradas
js/
  main.js             punto de entrada: conecta todo y escucha los clics
  game.js             estado del juego y acciones (empezar, tocar, responder)
  rules.js            reglas: genera cada ronda. Lógica pura, sin DOM
  render.js           dibuja la pantalla a partir del estado
  dom.js              ayudas para dibujar: escapar texto, colores sin style="", no perder el foco
  settings-panel.js   panel de ajustes para adultos (<dialog>)
  config.js           datos fijos: colores, operaciones, niveles, tiempos
  audio.js            voz (Web Speech API) y sonidos (Web Audio API)
  storage.js          guarda los ajustes en localStorage y los valida
  mascot.js           la mascota en SVG, con 3 expresiones
  icons.js            íconos de Lucide copiados como SVG
  spanish.js          números y frases en español
fonts/                Fredoka (woff2) y su licencia OFL
icons/                íconos de la app (generados con npm run icons)
sw.js                 service worker: el juego funciona sin internet
manifest.webmanifest  para instalarlo en la pantalla de inicio
_headers              cabeceras de seguridad y caché (Cloudflare Pages y Netlify)
scripts/              servidor local, generador de íconos y chequeo de sintaxis
tests/                pruebas unitarias (node:test) y recorridos (tests/e2e, Playwright)
```

## Cómo fluye la información

```
   clic del niño
        │
        ▼
   main.js ── busca el data-action del botón ──▶ game.js (acción)
                                                    │
                                     cambia `state` y llama a notify()
                                                    │
                                                    ▼
                                    render.js dibuja lo que cambió
```

## Decisiones de diseño para el niño

- **Sin "no" ni castigo.** Al equivocarse suena un tono suave, la app cuenta en voz alta con el niño y la respuesta correcta empieza a latir.
- **Ancla visual.** Cada operación tiene siempre el mismo color y la mascota es siempre la misma.
- **Anticipar el final.** La voz avisa "dos más y guardamos". Los botones de la pantalla final aparecen a los 4 segundos, para que el cierre se sienta como cierre.
- **Tapitas reales primero.** En el modo "Reales", la pantalla solo muestra los dados y le dice al adulto qué sacar de la caja. Nunca pide más tapitas de las que hay.
- **Pocas animaciones**, y ninguna si el sistema pide "reducir movimiento".

## Despliegue

Es un sitio estático: se publica la carpeta tal como está. No hace falta compilar. Las carpetas de desarrollo (`node_modules`, `tests`, `scripts`) se pueden publicar sin riesgo, pero conviene excluirlas.

| Hosting              | Cabeceras de seguridad       | Qué hacer                                                                                                                                                                                                                                                                                                                                                                                     |
| -------------------- | ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Cloudflare Pages** | Sí, desde `_headers`         | Conectar el repositorio. Comando de build: ninguno. Carpeta de salida: `/`.                                                                                                                                                                                                                                                                                                                   |
| **Netlify**          | Sí, desde `_headers`         | Conectar el repositorio. Build command: vacío. Publish directory: `.`.                                                                                                                                                                                                                                                                                                                        |
| **GitHub Pages**     | No permite cabeceras propias | Publicar desde la rama `main`, carpeta `/`. La CSP igual se aplica gracias a la etiqueta `<meta http-equiv="Content-Security-Policy">` de `index.html`. Lo que se pierde: `frame-ancestors` (otro sitio podría mostrar el juego en un iframe), `Permissions-Policy`, `Cross-Origin-Opener-Policy` y el control de caché. El archivo `.nojekyll` evita que GitHub procese el sitio con Jekyll. |

Recomendación: Cloudflare Pages o Netlify, porque aplican todas las cabeceras.

### Caché y versiones

- `index.html`, CSS y JS: `Cache-Control: no-cache`. El navegador guarda una copia pero pregunta si cambió antes de usarla. Sin bundler no hay nombres con huella (`main.3f2a.js`), y cambiar a mano la versión en cada `import` es fácil de olvidar.
- La fuente lleva la versión en el nombre (`fredoka-latin-v17.woff2`) y se guarda un año.

### Service worker (funcionar sin internet)

`sw.js` usa la estrategia "primero la red": con internet siempre se baja la versión publicada; sin internet se usa la última copia. Nadie queda atrapado en una versión vieja.

- **Al agregar, quitar o renombrar un archivo**: agrégalo a `FILES` en `sw.js` (y a los `modulepreload` de `index.html` si es un módulo) y sube `VERSION` (`'v1'` → `'v2'`).
- **Para desactivarlo si algo sale mal**, reemplaza todo `sw.js` por esto y publica:

  ```js
  // Service worker que se borra a sí mismo y borra las copias guardadas.
  self.addEventListener('install', () => self.skipWaiting());
  self.addEventListener('activate', async () => {
    for (const name of await caches.keys()) await caches.delete(name);
    await self.registration.unregister();
    for (const client of await self.clients.matchAll()) client.navigate(client.url);
  });
  ```

  Cada dispositivo lo aplica la próxima vez que abra el juego con internet. Para un solo dispositivo: Ajustes del navegador → Privacidad → Borrar datos del sitio.

### Instalarlo en la pantalla de inicio

- **Android (Chrome):** abrir el juego → menú ⋮ → "Agregar a la pantalla principal" (o "Instalar app").
- **iPhone o iPad (Safari, iOS 16.4 o superior):** abrir el juego → botón Compartir → "Agregar a inicio".

Instalado, se abre a pantalla completa y funciona sin internet después de la primera visita.

## Ejercicio: agregar una operación nueva

Una buena forma de entender el código es agregar una operación. Por ejemplo, "Comparar": dos grupos, ¿cuál tiene más?

1. **`config.js`:** agrega `comparar` a `OPERATIONS` (y al tipo `OperationId`) con su nombre, ícono, colores y consejos. Revisa el contraste: el texto sobre `main` es oscuro y `dark` necesita 4,5:1 sobre blanco.
2. **`rules.js`:** escribe `buildComparar(settings, random)` y regístrala en `BUILDERS`.
3. **`tests/rules.test.js`:** agrega las reglas que debe cumplir.
4. **`render.js`:** solo si necesita un dibujo distinto en la mesa.

Corre `npm test` en cada paso y `npm run check` al terminar.

## Créditos

- Íconos: [Lucide](https://lucide.dev), licencia ISC.
- Letra: [Fredoka](https://github.com/hafontia/Fredoka-One), licencia SIL Open Font License 1.1 (`fonts/OFL.txt`). Se sirve desde este sitio; no se usa Google Fonts.

## Licencia

[MIT](LICENSE) © 2026 Enrique Lazo Bello (ENLABE), The Bunker Code y colaboradores.

La licencia MIT cubre el código de este repositorio. Los íconos de Lucide y la letra Fredoka mantienen sus propias licencias (ver Créditos).
