const SUPABASE_URL = "https://tzmigdagymfauatjivcl.supabase.co";
const SUPABASE_KEY = "sb_publishable_gZ8cx30ZlxlVjlb00vo1nw_LyDC0yGH";
const EMAIL = process.env.BOT_EMAIL;
const PASSWORD = process.env.BOT_PASSWORD;

if (!EMAIL || !PASSWORD) throw new Error("Faltan BOT_EMAIL y BOT_PASSWORD en los secretos del repositorio.");

const headers = { apikey: SUPABASE_KEY, "Content-Type": "application/json" };

async function json(url, options = {}) {
  const response = await fetch(url, { ...options, headers: { ...headers, ...(options.headers || {}) } });
  if (!response.ok) throw new Error(`HTTP ${response.status} en ${url}: ${(await response.text()).slice(0, 300)}`);
  const text = await response.text();
  if (!text.trim()) return null;
  try { return JSON.parse(text); }
  catch { throw new Error(`Respuesta no válida de ${url}: ${text.slice(0, 300)}`); }
}

const session = await json(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
  method: "POST",
  body: JSON.stringify({ email: EMAIL, password: PASSWORD })
});
const userId = session.user?.id;
if (!session.access_token || !userId) throw new Error("Supabase no devolvió una sesión válida para el usuario bot.");

const authHeaders = { Authorization: `Bearer ${session.access_token}` };
const profileRename = await json(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}`, {
  method: "PATCH",
  headers: { ...authHeaders, Prefer: "return=minimal" },
  body: JSON.stringify({ username: "Informador" })
}).catch(error => { console.log("No se pudo actualizar el nombre del perfil:", error.message); return null; });
const since = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
const existing = await json(
  `${SUPABASE_URL}/rest/v1/posts?select=id,content,link_url,created_at&user_id=eq.${userId}&created_at=gte.${encodeURIComponent(since)}&order=created_at.desc&limit=250`,
  { headers: authHeaders }
);
const recent = Array.isArray(existing) ? existing : [];

async function publish({ title, content, subforum = "NBA", link_url = null }) {
  if (link_url && recent.some(p => p.link_url === link_url)) return false;
  if (recent.some(p => (p.content || "").includes(title))) return false;
  const clean = String(content || "").replace(/\*\*/g, "").trim();
  const body = { user_id: userId, sport: "Baloncesto", subforum, content: title + "\n" + clean + "\n\n— ALLSPORTS Bot · Datos: ESPN", link_url };
  await json(`${SUPABASE_URL}/rest/v1/posts`, {
    method: "POST",
    headers: { ...authHeaders, Prefer: "return=minimal" },
    body: JSON.stringify(body)
  });
  recent.unshift({ content: body.content, link_url, created_at: new Date().toISOString() });
  console.log("Publicado:", title);
  return true;
}

const scoreboardUrl = "https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard";
const scoreboard = await json(scoreboardUrl);
const now = Date.now();
let publishedGames = 0;
const events = scoreboard.events || [];

const engagementPrompts = [
  "La grada tiene la palabra: ¿qué equipo os ha sorprendido más esta noche y por qué?",
  "¿Cuál ha sido para vosotros el partido más atractivo? Contadnos qué os ha llamado la atención.",
  "Si tuvierais que elegir una actuación de la noche, ¿con cuál os quedáis?",
  "¿Qué resultado puede tener más impacto en la clasificación? Os leemos.",
  "¿Ha habido alguna sorpresa o decepción? Queremos conocer vuestro análisis.",
  "Mirando a la próxima jornada, ¿qué equipo sale reforzado y cuál debe reaccionar?",
  "¿Qué partido os gustaría comentar con más detalle? Dejad vuestra opinión.",
  "Balance de la noche: ¿qué equipo ha dado el golpe sobre la mesa?"
];
function choosePrompt(seed) {
  let hash = 0;
  for (const char of String(seed)) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return engagementPrompts[hash % engagementPrompts.length];
}

// Las previas siguen siendo individuales, pero sus preguntas van variando.
for (const event of events) {
  const competition = event.competitions?.[0];
  const competitors = competition?.competitors || [];
  const home = competitors.find(t => t.homeAway === "home");
  const away = competitors.find(t => t.homeAway === "away");
  if (!home || !away) continue;
  const homeName = home.team?.displayName || home.team?.name || "Local";
  const awayName = away.team?.displayName || away.team?.name || "Visitante";
  const start = new Date(event.date).getTime();
  const state = event.status?.type?.state;
  const gameUrl = `https://www.espn.com/nba/game?gameId=${event.id}`;

  if (state === "pre" && start > now && start - now <= 2 * 60 * 60 * 1000) {
    const when = new Date(event.date).toLocaleString("es-ES", { dateStyle: "full", timeStyle: "short", timeZone: "Europe/Madrid" });
    const title = `🏀 PREVIA NBA | ${awayName} vs ${homeName}`;
    const content = `Se acerca el partido **${awayName} – ${homeName}**.\n\n🕒 Inicio previsto: ${when} (hora peninsular).\n\n**${choosePrompt(event.id)}**\n\nDejad vuestro análisis antes del salto inicial.`;
    if (await publish({ title, content, link_url: gameUrl })) publishedGames++;
  }
}

// Un único resumen de resultados cuando TODOS los partidos del marcador han terminado.
if (events.length && events.every(event => event.status?.type?.state === "post")) {
  const dayKey = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Madrid" });
  const dateLabel = new Date().toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Madrid" });
  const results = [];
  for (const event of events) {
    const competitors = event.competitions?.[0]?.competitors || [];
    const home = competitors.find(t => t.homeAway === "home");
    const away = competitors.find(t => t.homeAway === "away");
    if (!home || !away) continue;
    const homeScore = Number(home.score);
    const awayScore = Number(away.score);
    if (!Number.isFinite(homeScore) || !Number.isFinite(awayScore)) continue;
    const homeName = home.team?.displayName || home.team?.name || "Local";
    const awayName = away.team?.displayName || away.team?.name || "Visitante";
    const winner = homeScore > awayScore ? homeName : awayScore > homeScore ? awayName : "Empate";
    const margin = Math.abs(homeScore - awayScore);
    const detail = winner === "Empate" ? " (empate)" : margin >= 20 ? ` (victoria por ${margin})` : "";
    results.push(`• **${awayName} ${awayScore} – ${homeScore} ${homeName}**${detail}`);
  }
  if (results.length) {
    const title = `🌙 NBA | Resumen de la noche · ${dateLabel}`;
    const content = `[[NBA_RESUMEN:${dayKey}]]\n\n**Resultados de la noche:**\n\n${results.join("\n")}\n\n**${choosePrompt(dayKey)}**\n\n¿Qué os deja esta jornada? Os leemos en ALLSPORTS.`;
    if (await publish({ title, content, link_url: `https://www.espn.com/nba/scoreboard?date=${dayKey.replace(/-/g,"")}` })) {
      publishedGames++;
    }
  }
}

const newsData = await json("https://site.api.espn.com/apis/site/v2/sports/basketball/nba/news?limit=12");
let publishedNews = 0;
const lastNewsPost = recent.find(p => (p.content || "").startsWith("📰 NBA |"));
const newsCooldownActive = lastNewsPost && now - new Date(lastNewsPost.created_at).getTime() < 24 * 60 * 60 * 1000;
const importantNewsPattern = /trade|traded|transfer|signs|signed|waiv|release|injur|surgery|out for (the )?season|suspend|fired|resign|retires|retirement|record|mvp|playoff|finals|champion|all-star|all star|coach|star player|superstar|franchise|deal|contract extension/i;
for (const article of (newsData.articles || []).slice(0, 12)) {
  if (publishedNews >= 1 || newsCooldownActive) break;
  const publishedAt = new Date(article.published || article.lastModified || 0).getTime();
  if (!publishedAt || now - publishedAt > 24 * 60 * 60 * 1000 || publishedAt > now + 5 * 60 * 1000) continue;
  const originalTitle = article.headline?.trim();
  const url = article.links?.web?.href || article.links?.api?.self?.href;
  if (!originalTitle || !url) continue;
  if (!importantNewsPattern.test(originalTitle + " " + (article.description || ""))) { console.log("Noticia descartada por no parecer relevante:", originalTitle); continue; }
  const originalDescription = (article.description || "ESPN informa de una novedad en la actualidad de la NBA.").trim();
  async function translateToSpanish(value) {
    const endpoint = "https://api.mymemory.translated.net/get?q=" + encodeURIComponent(value) + "&langpair=en|es";
    const result = await json(endpoint);
    const translated = result?.responseData?.translatedText?.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&").trim();
    if (result?.responseStatus !== 200 || !translated) throw new Error("No se pudo traducir al español.");
    return translated;
  }
  let titleEs, descriptionEs;
  try {
    titleEs = await translateToSpanish(originalTitle);
    descriptionEs = await translateToSpanish(originalDescription);
  } catch (error) {
    console.log("Noticia omitida:", error.message);
    continue;
  }
  const sentence = (descriptionEs.replace(/\s+/g, " ").match(/^[^.!?]+[.!?]?/)?.[0] || "").trim().replace(/[.!?]+$/, "") + ".";
  if (!sentence || sentence.length < 25 || sentence.toLowerCase().includes(titleEs.toLowerCase().slice(0, 35))) {
    console.log("Noticia omitida: resumen vacío, demasiado corto o repetido.");
    continue;
  }
  const engagementPrompts = [
    "¿Cómo valoráis esta noticia y qué consecuencias puede tener para los equipos implicados?",
    "Os leemos: ¿creéis que este movimiento cambiará el rumbo de la temporada?",
    "¿Quién sale más beneficiado de esta situación? Contadnos vuestro punto de vista.",
    "La pregunta queda abierta: ¿estáis de acuerdo con esta decisión? ¿Por qué?",
    "¿Qué haríais vosotros en el lugar de los protagonistas? Os leemos.",
    "¿Esto puede marcar un antes y un después en la NBA? Queremos conocer vuestra opinión.",
    "Turno para la grada: ¿qué detalle de esta noticia os parece más importante?",
    "¿Esperabais que ocurriera algo así? Compartid vuestro análisis con la comunidad."
  ];
  let promptHash = 0;
  for (const char of originalTitle) promptHash = (promptHash * 31 + char.charCodeAt(0)) >>> 0;
  const prompt = engagementPrompts[promptHash % engagementPrompts.length];
  if (await publish({ title: "📰 NBA | " + titleEs, content: sentence + "\n\n" + prompt, link_url: url })) publishedNews++;
}

console.log(`Proceso terminado. Temas de partidos: ${publishedGames}. Temas de actualidad: ${publishedNews}.`);
