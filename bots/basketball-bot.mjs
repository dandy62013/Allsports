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

for (const event of (scoreboard.events || [])) {
  if (publishedGames >= 5) break;
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
    const content = `Se acerca el partido **${awayName} – ${homeName}**.\n\n🕒 Inicio previsto: ${when} (hora peninsular).\n\n**Abrimos el debate:**\n- ¿Quién llega en mejor momento?\n- ¿Qué jugador puede ser decisivo?\n- ¿Cuál es vuestro pronóstico?\n\nDejad vuestro análisis antes del salto inicial.`;
    if (await publish({ title, content, link_url: gameUrl })) publishedGames++;
  }

  if (state === "post" && now - start <= 20 * 60 * 60 * 1000) {
    const homeScore = home.score ?? "—";
    const awayScore = away.score ?? "—";
    const winner = Number(homeScore) > Number(awayScore) ? homeName : Number(awayScore) > Number(homeScore) ? awayName : "Empate";
    const title = `🏁 RESULTADO NBA | ${awayName} ${awayScore} - ${homeScore} ${homeName}`;
    const content = `**Resultado final:** ${awayName} ${awayScore} – ${homeScore} ${homeName}.\n\n${winner === "Empate" ? "El encuentro terminó igualado." : `Victoria de **${winner}**.`}\n\n**¿Qué os ha parecido el partido?**\n- ¿Quién ha sido el jugador más determinante?\n- ¿Qué ha decidido el encuentro?\n- ¿Qué consecuencias puede tener este resultado?`;
    if (await publish({ title, content, link_url: gameUrl + "#resultado" })) publishedGames++;
  }
}

const newsData = await json("https://site.api.espn.com/apis/site/v2/sports/basketball/nba/news?limit=12");
let publishedNews = 0;
for (const article of (newsData.articles || []).slice(0, 8)) {
  if (publishedNews >= 2) break;
  const publishedAt = new Date(article.published || article.lastModified || 0).getTime();
  if (!publishedAt || now - publishedAt > 18 * 60 * 60 * 1000 || publishedAt > now + 5 * 60 * 1000) continue;
  const originalTitle = article.headline?.trim();
  const url = article.links?.web?.href || article.links?.api?.self?.href;
  if (!originalTitle || !url) continue;
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
  if (await publish({ title: "📰 NBA | " + titleEs, content: sentence + "\\n\\n" + prompt, link_url: url })) publishedNews++;
}

console.log(`Proceso terminado. Temas de partidos: ${publishedGames}. Temas de actualidad: ${publishedNews}.`);
