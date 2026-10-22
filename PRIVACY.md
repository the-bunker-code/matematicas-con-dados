# Privacidad

Este juego lo usan niños pequeños. Por eso está hecho para que **nada salga del dispositivo**.

## Qué se guarda

Solo los ajustes que elige el adulto, para no tener que configurarlos cada vez:

| Dato                                         | Ejemplo                    |
| -------------------------------------------- | -------------------------- |
| Operación y nivel                            | Sumar, 2 dados             |
| Caras del dado y rondas por sesión           | 1 a 3, 5 rondas            |
| Voz y sonidos encendidos o apagados          | sí / sí                    |
| Tapitas en pantalla o reales                 | reales                     |
| Color de cada dado                           | azul, verde, rojo, naranja |
| Cuántas tapitas de cada color hay en la caja | 16 azules, 11 verdes…      |

**No se guarda nada sobre el niño:** ni nombre, ni edad, ni respuestas, ni aciertos, ni tiempos de juego.

## Dónde se guarda

En el propio navegador (`localStorage`), bajo la clave `matematica-con-dados:v1`. Además, si se usa el juego sin internet, el navegador guarda una copia de los archivos del juego (HTML, CSS, JS, fuente e íconos) en su caché. Esa copia no tiene datos.

## Qué sale del dispositivo

- **Nada que identifique al niño ni al adulto.** No hay analíticas, cookies, identificadores, publicidad ni formularios.
- **Ninguna petición a terceros.** La letra (Fredoka), los íconos y los sonidos están dentro del sitio. Una prueba automática (`tests/e2e/offline.spec.js`) verifica que todas las peticiones van al propio sitio.
- **La voz.** El juego usa la voz del sistema (Web Speech API). Algunas voces, como las "Google" de Chrome, envían el texto a un servidor para convertirlo en audio. El juego **elige primero una voz que funcione en el propio dispositivo** (`localService`) y solo usa una remota si no hay ninguna local en español. El texto que se envía en ese caso son frases del juego ("¿Cuántas hay?", "tres"), nunca datos personales. Para evitarlo del todo, se puede apagar "Voz que cuenta" en los ajustes o instalar una voz en español en el sistema.
- **El servidor del sitio** recibe las peticiones normales de cualquier página web (dirección IP, navegador). Eso depende del hosting elegido, no del juego.

## Cómo borrarlo

- **Desde el navegador:** Ajustes → Privacidad → Borrar datos de sitios → buscar el sitio del juego.
- **Si está instalado en la pantalla de inicio:** desinstalarlo borra también sus datos.
