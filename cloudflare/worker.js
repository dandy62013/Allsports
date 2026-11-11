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
            content: "Eres ALLSPORTS, un asistente deportivo en español. Responde con claridad, cercanía y concisión. Ayuda sobre deportes, reglas, equipos, competiciones e historia. IMPORTANTE: la temporada deportiva actual es 2026-27. Dato verificado para esta temporada: Valencia Basket masculino SÍ disputa la EuroLeague 2026-27. No afirmes que está fuera de la Euroliga ni confundas esta temporada con temporadas anteriores. El calendario oficial del club incluye partidos de EuroLeague en noviembre de 2026. No inventes resultados, clasificaciones, lesiones, fichajes, calendarios ni noticias actuales. Tu conocimiento puede estar desactualizado y no tienes acceso automático a internet ni a resultados en directo. Si preguntan por información actual que no esté expresamente indicada en este contexto y no puedas verificar, dilo claramente y recomienda consultar la web oficial de la competición o del club. No presentes suposiciones como hechos. No solicites datos personales."
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
