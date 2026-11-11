# Activar el asistente IA de ALLSPORTS

La web ya incluye la interfaz de chat. Este Worker mantiene la clave/ejecución de IA fuera del navegador y utiliza Cloudflare Workers AI.

## 1. Crear el Worker (plan gratuito disponible)

1. Crea una cuenta en https://dash.cloudflare.com/ si todavía no tienes una.
2. Entra en **Workers & Pages** y crea un Worker llamado `allsports-chat`.
3. Abre **Edit code** y copia el contenido de `cloudflare/worker.js`.
4. En **Settings → Bindings**, añade un binding de **Workers AI** con el nombre `AI`.
5. En **Settings → Variables and Secrets**, añade la variable `ALLOWED_ORIGIN` con el origen real de tu web. Si GitHub Pages publica en el dominio habitual del proyecto, será `https://dandy62013.github.io`. No añadas la ruta `/Allsports`.
6. Guarda y despliega el Worker. Su dirección será parecida a `https://allsports-chat.TU-CUENTA.workers.dev`.

Cloudflare Workers AI anuncia una asignación gratuita diaria limitada; consulta los límites y precios vigentes antes de publicar el servicio a mucho público: https://developers.cloudflare.com/workers-ai/platform/pricing/

## 2. Conectar la web

En `index.html`, busca la constante `CHAT_API_URL` y sustituye el valor vacío por:

`https://allsports-chat.TU-CUENTA.workers.dev/api/chat`

Sustituye `TU-CUENTA` por el subdominio real que Cloudflare te asigne. Guarda el archivo en GitHub.

## 3. Comprobar

Abre la web, pulsa «Pregunta a ALLSPORTS» y pregunta algo como «¿Cuáles son las reglas básicas del fuera de juego?».

**Seguridad:** no pongas claves API, tokens ni contraseñas en `index.html`, en este repositorio ni en mensajes públicos. El Worker utiliza el binding de Cloudflare AI y limita el origen permitido.

## Noticias automáticas

El flujo `.github/workflows/update-news.yml` consulta feeds RSS de Google News en español cada cuatro horas y actualiza `news.json`. La web muestra titulares, fecha, categoría, medio y enlace a la noticia original. La selección depende de los resultados que Google News incluya en sus feeds; revisa atribución y condiciones de uso de cada fuente antes de un uso comercial.
