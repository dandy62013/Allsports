const MODEL = "@cf/google/gemma-4-26b-a4b-it";
const FOOTBALL_LEAGUES = [
  { name: "Primera División", slug: "esp.1" },
  { name: "Segunda División", slug: "esp.2" },
  { name: "Liga F", slug: "esp.w.1" },
  { name: "Premier League", slug: "eng.1" },
  { name: "Champions League", slug: "uefa.champions" },
  { name: "Europa League", slug: "uefa.europa" },
  { name: "Conference League", slug: "uefa.europa.conf" }
];

function corsHeaders(origin, allowedOrigin) {
  const allowed = allowedOrigin || "https://dandy62013.github.io";
  const permitted = origin === allowed || origin === "http://localhost:8788";
  return {
    "Access-Control-Allow-Origin": permitted ? origin : allowed,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Vary": "Origin"
  };
}

function madridDateKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Madrid", year: "numeric", month: "2-digit", day: "2-digit"
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return values.year + values.month + values.day;
}

function madridToday(date = new Date()) {
  return new Intl.DateTimeFormat("es-ES", {
    timeZone: "Europe/Madrid", dateStyle: "full", timeStyle: "short"
  }).format(date);
}

async function getJson(url) {
  const response = await fetch(url, {
    headers: { "Accept": "application/json", "User-Agent": "ALLSPORTS/1.0" },
    signal: AbortSignal.timeout(6500)
  });
  if (!response.ok) throw new Error("Fuente deportiva HTTP " + response.status);
  return response.json();
}

function wantsLiveData(question) {
  return /(ahora|hoy|en directo|directo|marcador|resultado|resultados|cómo va|como va|quién va ganando|quien va ganando|quién ha ganado|quien ha ganado|quién ganó|quien ganó|quien gano|partido|partidos|juega|jugando|clasificación|clasificacion|tabla|próximo|proximo|calendario|horario|a qué hora|a que hora|último partido|ultimo partido|goleador|ha marcado|han marcado)/i.test(question)
    && !/(historia|histórico|historico|\b(?:19\d{2}|20(?:0\d|1\d|2[0-5]))\b|temporada pasada|temporadas pasadas|hace años|hace décadas)/i.test(question);
}

function isFootballQuestion(q) {
  return /(fútbol|futbol|laliga|liga f|premier|champions|europa league|conference|segunda división|segunda division|copa del rey|selección|seleccion|mundial|eurocopa|valencia cf|barcelona|barça|real madrid|atlético|atletico|sevilla|betis|athletic|girona|osasuna|espanyol|getafe|rayo|celta|alavés|alaves|elche|levante)/i.test(q);
}

function isBasketballQuestion(q) {
  return /(baloncesto|basket|nba|acb|euroliga|euroleague|eurocup|valencia basket|real madrid basket|barça basket|barcelona basket|liga femenina endesa)/i.test(q);
}

function formatEspnEvent(event, leagueName) {
  const competition = event.competitions?.[0];
  const competitors = competition?.competitors || [];
  const home = competitors.find(team => team.homeAway === "home") || competitors[0];
  const away = competitors.find(team => team.homeAway === "away") || competitors[1];
  if (!home || !away) return null;
  const state = event.status?.type?.state || "";
  const status = event.status?.type?.shortDetail || event.status?.type?.description || event.status?.type?.detail || "Estado no indicado";
  const score = team => team.score !== undefined && team.score !== null ? String(team.score) : "—";
  const when = event.date ? new Intl.DateTimeFormat("es-ES", {
    timeZone: "Europe/Madrid", hour: "2-digit", minute: "2-digit"
  }).format(new Date(event.date)) : "";
  const marker = state === "in" ? "EN JUEGO" : event.status?.type?.completed ? "FINAL" : status;
  return leagueName + ": " + (home.team?.displayName || home.team?.name || "Local") + " " + score(home) +
    " - " + score(away) + " " + (away.team?.displayName || away.team?.name || "Visitante") +
    " | " + marker + (when ? " | " + when : "");
}

async function fetchFootballData(question) {
  const q = question.toLowerCase();
  let selected = FOOTBALL_LEAGUES;
  const specific = FOOTBALL_LEAGUES.filter(league => {
    if (league.slug === "esp.1") return /(primera|laliga|la liga|liga española)/i.test(q);
    if (league.slug === "esp.2") return /(segunda|segunda división)/i.test(q);
    if (league.slug === "esp.w.1") return /(liga f|fútbol femenino|futbol femenino)/i.test(q);
    if (league.slug === "eng.1") return /premier/i.test(q);
    if (league.slug === "uefa.champions") return /champions/i.test(q);
    if (league.slug === "uefa.europa") return /europa league/i.test(q);
    if (league.slug === "uefa.europa.conf") return /conference/i.test(q);
    return false;
  });
  if (specific.length) selected = specific;
  const date = madridDateKey();
  const results = await Promise.allSettled(selected.map(async league => {
    const payload = await getJson("https://site.api.espn.com/apis/site/v2/sports/soccer/" + league.slug + "/scoreboard?dates=" + date);
    return { league, events: payload.events || [] };
  }));
  const lines = [];
  let failed = 0;
  for (const result of results) {
    if (result.status !== "fulfilled") { failed++; continue; }
    for (const event of result.value.events) {
      const line = formatEspnEvent(event, result.value.league.name);
      if (line) lines.push(line);
    }
  }
  if (!lines.length && failed === selected.length) return "No se pudo consultar ESPN para los marcadores de fútbol en esta petición.";
  if (!lines.length) return "ESPN no muestra partidos para las competiciones consultadas hoy.";
  return "Fuente: ESPN. Partidos del día (hora peninsular española):\n" + lines.join("\n");
}

function euroDateIsRelevant(game, now) {
  const raw = game.utcDate || game.date || game.localDate;
  if (!raw) return false;
  const start = Date.parse(raw);
  if (!Number.isFinite(start)) return false;
  const age = now - start;
  const today = madridDateKey(now);
  return madridDateKey(new Date(start)) === today &&
    (game.played === true ? age >= 0 && age <= 4 * 60 * 60 * 1000 :
      age >= 0 ? age < 4 * 60 * 60 * 1000 : start - now <= 18 * 60 * 60 * 1000);
}

async function fetchNbaData() {
  const payload = await getJson("https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard?dates=" + madridDateKey());
  const lines = (payload.events || []).map(event => formatEspnEvent(event, "NBA")).filter(Boolean);
  if (!lines.length) return "ESPN no muestra partidos de NBA para hoy.";
  return "Fuente: ESPN. Partidos NBA del día (hora peninsular española):\n" + lines.join("\n");
}

async function fetchEuroBasketballData() {
  const year = new Date().getFullYear() - (new Date().getMonth() < 6 ? 1 : 0);
  const now = Date.now();
  const competitions = await Promise.allSettled(["E", "U"].map(async code => {
    const base = "https://api-live.euroleague.net/v2/competitions/" + code + "/seasons/" + code + year;
    const payload = await getJson(base + "/games?limit=500");
    let spanishCodes = new Set();
    if (code === "U") {
      const clubs = await getJson(base + "/clubs");
      spanishCodes = new Set((clubs.data || []).filter(club => club.country?.code === "ESP").map(club => club.code));
    }
    return { code, games: payload.data || [], spanishCodes };
  }));
  const lines = [];
  let failed = 0;
  for (const result of competitions) {
    if (result.status !== "fulfilled") { failed++; continue; }
    const { code, games, spanishCodes } = result.value;
    for (const game of games.filter(item => euroDateIsRelevant(item, now))) {
      if (code === "U" && !spanishCodes.has(game.local?.club?.code) && !spanishCodes.has(game.road?.club?.code)) continue;
      const local = game.local?.club?.name || "Local";
      const road = game.road?.club?.name || "Visitante";
      const localScore = game.local?.score ?? "—";
      const roadScore = game.road?.score ?? "—";
      const status = game.played === true ? "FINAL" : (game.gameStatus || "HORARIO");
      const date = game.utcDate || game.date || game.localDate;
      const time = date ? new Intl.DateTimeFormat("es-ES", { timeZone: "Europe/Madrid", hour: "2-digit", minute: "2-digit" }).format(new Date(date)) : "";
      lines.push((code === "E" ? "Euroliga" : "EuroCup (con equipo español)") + ": " + local + " " + localScore + " - " + roadScore + " " + road + " | " + status + (time ? " | " + time : ""));
    }
  }
  if (!lines.length && failed === 2) return "No se pudieron consultar las fuentes de Euroliga y EuroCup en esta petición.";
  return lines.length ? "Fuente: API oficial de EuroLeague. Partidos del día (hora peninsular española):\n" + lines.join("\n") :
    "Las fuentes consultadas no muestran partidos de Euroliga o EuroCup con equipos españoles para hoy.";
}

async function getLiveContext(question) {
  if (!wantsLiveData(question)) return "";
  const q = question.toLowerCase();
  const tasks = [];
  if (isFootballQuestion(q) || (!isBasketballQuestion(q) && /(partido|marcador|resultado|en directo|hoy|ahora)/i.test(q))) {
    tasks.push(fetchFootballData(question).then(value => "FÚTBOL:\n" + value).catch(error => "FÚTBOL: No se pudo consultar la fuente (" + String(error?.message || error) + ")."));
  }
  if (isBasketballQuestion(q) || (!isFootballQuestion(q) && /(partido|marcador|resultado|en directo|hoy|ahora)/i.test(q))) {
    tasks.push(Promise.allSettled([fetchNbaData(), fetchEuroBasketballData()]).then(results => {
      const labels = ["NBA", "Euroliga y EuroCup"];
      return "BALONCESTO:\n" + results.map((result, index) =>
        labels[index] + ": " + (result.status === "fulfilled" ? result.value : "No se pudo consultar la fuente (" + String(result.reason?.message || result.reason) + ").")
      ).join("\n");
    }));
  }
  if (!tasks.length) return "";
  const values = await Promise.all(tasks);
  return "\n\nDATOS DEPORTIVOS CONSULTADOS AHORA (" + madridToday() + "):\n" + values.join("\n\n");
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const headers = corsHeaders(origin, env.ALLOWED_ORIGIN);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });
    if (origin && headers["Access-Control-Allow-Origin"] !== origin) {
      return Response.json({ error: "Origen no autorizado." }, { status: 403, headers });
    }
    if (new URL(request.url).pathname !== "/api/chat") {
      return Response.json({ error: "Ruta no encontrada." }, { status: 404, headers });
    }
    if (request.method !== "POST") return Response.json({ error: "Método no permitido." }, { status: 405, headers });

    try {
      const body = await request.json();
      const question = typeof body.message === "string" ? body.message.trim() : "";
      if (!question || question.length > 700) {
        return Response.json({ error: "Escribe una pregunta de hasta 700 caracteres." }, { status: 400, headers });
      }

      const history = Array.isArray(body.messages) ? body.messages
        .filter(item => item && ["user", "assistant"].includes(item.role) && typeof item.content === "string")
        .slice(-10)
        .map(item => ({ role: item.role, content: item.content.slice(0, 1800) })) : [];
      const liveContext = await getLiveContext(question);
      const systemPrompt = [
        "Eres ALLSPORTS, un asistente deportivo en español, cercano, claro y bien informado.",
        "Tu función principal es resolver dudas deportivas, no limitarte a describir la web. Habla de fútbol, baloncesto, tenis, motor y otros deportes.",
        "Responde preguntas históricas con tu conocimiento: temporadas anteriores, campeones, finales, resultados históricos, récords, reglas, trayectorias, jugadores, equipos y comparaciones. No rechaces una pregunta solo porque sea antigua. Si falta contexto, pregunta por la temporada, competición o fecha.",
        "Mantén el contexto de los mensajes anteriores y entiende referencias como 'ese equipo', 'y el año siguiente' o '¿y en la vuelta?'. No repitas preguntas que ya quedaron respondidas.",
        "Para datos actuales o en directo, utiliza exclusivamente los DATOS DEPORTIVOS CONSULTADOS que aparecen al final del último mensaje. No inventes marcadores, goleadores, clasificaciones, lesiones, fichajes, calendarios ni noticias.",
        "Si la fuente no devuelve datos o falla, dilo claramente y explica qué competición o fuente no se pudo consultar. No presentes una estimación como si fuera un dato real.",
        "La consulta actual disponible cubre fútbol: Primera, Segunda, Liga F, Premier League, Champions, Europa League y Conference; baloncesto: NBA, Euroliga y EuroCup cuando participa un equipo español. ACB y Liga Femenina Endesa aún no están conectadas a esta consulta.",
        "Distingue hora peninsular española de la hora local de la competición. Da respuestas útiles y naturales, normalmente breves; amplía si el usuario lo pide. Si una pregunta es ambigua, haz una sola pregunta concreta.",
        "No solicites datos personales, no inventes fuentes y no afirmes tener actualización segundo a segundo."
      ].join(" ");

      const messages = [
        { role: "system", content: systemPrompt },
        ...history,
        { role: "user", content: question + liveContext }
      ];
      const answer = await env.AI.run(MODEL, {
        messages,
        max_tokens: 850,
        temperature: 0.35
      });
      const text = answer?.response || answer?.result || "No he podido preparar una respuesta. Prueba otra vez.";
      return Response.json({ answer: String(text) }, { headers });
    } catch (error) {
      return Response.json({ error: String(error?.message || error || "Error desconocido") }, { status: 500, headers });
    }
  }
};
