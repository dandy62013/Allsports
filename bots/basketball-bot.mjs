const SUPABASE_URL = "https://tzmigdagymfauatjivcl.supabase.co";
const SUPABASE_KEY = "sb_publishable_gZ8cx30ZlxlVjlb00vo1nw_LyDC0yGH";
const EMAIL = process.env.BOT_EMAIL;
const PASSWORD = process.env.BOT_PASSWORD;

if (!EMAIL || !PASSWORD) throw new Error("Faltan BOT_EMAIL y BOT_PASSWORD en los secretos del repositorio.");

const headers = { apikey: SUPABASE_KEY, "Content-Type": "application/json" };

async function json(url, options = {}) {
  const response = await fetch(url, { ...options, headers: { ...headers, ...(options.headers || {}) } });
  if (!response.ok) throw new Error(`HTTP ${response.status} en ${url}: ${(await response.text()).slice(0, 300)}`);
  return response.status === 204 ? null : response.json();
}

const session = await json(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
  method: "POST",
  body: JSON.stringify({ email: EMAIL, password: PASSWORD })
});
const userId = session.user?.id;
if (!session.access_token || !userId) throw new Error("Supabase no devolvió una sesión válida para el usuario bot.");

const authHeaders = { Authorization: `Bearer ${session.access_token}` };
const since = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
const existing = await json(
  `${SUPABASE_URL}/rest/v1/posts?select=id,content,link_url,created_at&user_id=eq.${userId}&created_at=gte.${encodeURIComponent(since)}&order=created_at.desc&limit=250`,
  { headers: authHeaders }
);
const recent = Array.isArray(existing) ? existing : [];

async function publish({ title, content, subforum = "NBA", link_url = null }) {
  if (link_url && recent.some(p => p.link_url === link_url)) return false;
  if (recent.some(p => (p.content || "").includes(title))) return false;
  const body = { user_id: userId, sport: "Baloncesto", subforum, content: `**${title}**\n\n${content}\n\n— ALLSPORTS Bot · Datos: ESPN`, link_url };
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
    if (await publish({ title, content, link_url: gameUrl.replace("game?", "game?result=") })) publishedGames++;
  }
}

const newsData = await json("https://site.api.espn.com/apis/site/v2/sports/basketball/nba/news?limit=12");
let publishedNews = 0;
for (const article of (newsData.articles || []).slice(0, 8)) {
  if (publishedNews >= 2) break;
  const publishedAt = new Date(article.published || article.lastModified || 0).getTime();
  if (!publishedAt || now - publishedAt > 18 * 60 * 60 * 1000 || publishedAt > now + 5 * 60 * 1000) continue;
  const title = article.headline?.trim();
  const url = article.links?.web?.href || article.links?.api?.self?.href;
  if (!title || !url) continue;
  const description = (article.description || "La actualidad de la NBA deja un nuevo asunto para debatir.").trim();
  const discussion = `**La noticia:** ${description}\n\n**Queremos leer a la comunidad:**\n- ¿Cómo valoráis esta información?\n- ¿Qué impacto puede tener en el equipo o en la competición?\n- ¿Estáis de acuerdo?\n\nFuente original: ESPN.`;
  if (await publish({ title: `📰 NBA | ${title}`, content: discussion, link_url: url })) publishedNews++;
}

console.log(`Proceso terminado. Temas de partidos: ${publishedGames}. Temas de actualidad: ${publishedNews}.`);
