const MODEL = "@cf/google/gemma-4-26b-a4b-it";

function corsHeaders(origin, allowedOrigin) {
  const allowed = allowedOrigin || "https://dandy62013.github.io";
  const permitted = origin === allowed || origin === "http://localhost:8788";
  return {
    "Access-Control-Allow-Origin": permitted ? origin : allowed,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Vary": "Origin",
  };
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const headers = corsHeaders(origin, env.ALLOWED_ORIGIN);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers });
    }
    if (origin && headers["Access-Control-Allow-Origin"] !== origin) {
      return Response.json({ error: "Origen no autorizado." }, { status: 403, headers });
    }
    if (new URL(request.url).pathname !== "/api/chat") {
      return Response.json({ error: "Ruta no encontrada." }, { status: 404, headers });
    }
    if (request.method !== "POST") {
      return Response.json({ error: "Método no permitido." }, { status: 405, headers });
    }

    try {
      const body = await request.json();
      const question = typeof body.message === "string" ? body.message.trim() : "";
      if (!question || question.length > 700) {
        return Response.json({ error: "Escribe una pregunta de hasta 700 caracteres." }, { status: 400, headers });
      }
      const answer = await env.AI.run(MODEL, {
        messages: [
          {
            role: "system",
            content: "Eres ALLSPORTS, un asistente deportivo en español. Responde con claridad, cercanía y concisión. Ayuda sobre deportes, reglas, equipos, competiciones e historia. No inventes resultados, clasificaciones, lesiones, fichajes ni noticias actuales. Si preguntan por datos en directo o actualidad que no puedas verificar, dilo claramente y recomienda consultar fuentes oficiales. No afirmes tener acceso a internet ni a datos en tiempo real. No solicites datos personales."
          },
          { role: "user", content: question }
        ],
        max_tokens: 450,
        temperature: 0.35
      });
      const text = answer?.response || answer?.result || "No he podido preparar una respuesta. Prueba otra vez.";
      return Response.json({ answer: String(text) }, { headers });
    } catch (error) {
      return Response.json({ error: String(error?.message || error || "Error desconocido") }, { status: 500, headers });
    }
  }
};
