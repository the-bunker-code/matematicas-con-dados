/**
 * `node --check` sobre cada archivo de js/: detecta errores de sintaxis sin ejecutar nada.
 * Ejecutar con: npm run check:syntax
 */

import { readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const files = readdirSync('js').filter((name) => name.endsWith('.js'));
for (const name of files) execFileSync(process.execPath, ['--check', `js/${name}`], { stdio: 'inherit' });
console.log(`Sintaxis correcta en ${files.length} archivos de js/`);
