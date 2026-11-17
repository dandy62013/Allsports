const SUPABASE_URL = "https://tzmigdagymfauatjivcl.supabase.co";
const SUPABASE_KEY = "sb_publishable_gZ8cx30ZlxlVjlb00vo1nw_LyDC0yGH";
const EMAIL = process.env.BOT_EMAIL;
const PASSWORD = process.env.BOT_PASSWORD;
const ZONE = "Europe/Madrid";

if (!EMAIL || !PASSWORD) throw new Error("Faltan BOT_EMAIL y BOT_PASSWORD.");

const headers = { apikey: SUPABASE_KEY, "Content-Type": "application/json" };
async function json(url, options = {}) {
  const response = await fetch(url, { ...options, headers: { ...headers, ...(options.headers || {}) } });
  if (!response.ok) throw new Error(`HTTP ${response.status} en ${url}: ${(await response.text()).slice(0, 300)}`);
  const raw = await response.text();
  if (!raw.trim()) return null;
  try { return JSON.parse(raw); } catch { throw new Error("ESPN/Supabase devolvió una respuesta no válida."); }
}

const session = await json(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
  method: "POST", body: JSON.stringify({ email: EMAIL, password: PASSWORD })
});
const userId = session.user?.id;
if (!session.access_token || !userId) throw new Error("No se pudo iniciar sesión con el usuario Informador.");
const auth = { Authorization: `Bearer ${session.access_token}` };
await json(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}`, {
  method: "PATCH", headers: { ...auth, Prefer: "return=minimal" },
  body: JSON.stringify({ username: "Informador" })
}).catch(error => console.log("Aviso al actualizar el perfil:", error.message));

const since = new Date(Date.now() - 7 * 86400000).toISOString();
const rows = await json(`${SUPABASE_URL}/rest/v1/posts?select=id,content,created_at&user_id=eq.${userId}&created_at=gte.${encodeURIComponent(since)}&order=created_at.desc&limit=500`, { headers: auth });
const recent = Array.isArray(rows) ? rows : [];

function madridDate(date) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: ZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(date).replaceAll("-", "");
}
function madridLabel(date) {
  return date.toLocaleString("es-ES", { timeZone: ZONE, dateStyle: "full", timeStyle: "short" });
}
function teamName(team) {
  return team?.displayName || team?.name || team?.shortDisplayName || team?.abbreviation || "";
}
function allEventText(event) {
  const competition = event.competitions?.[0] || {};
  return [
    event.name, event.shortName, event.season?.name, event.season?.slug,
    event.league?.name, event.league?.abbreviation, competition.name,
    competition.shortName, competition.notes?.map(x => x.headline || x.text || "").join(" ")
  ].filter(Boolean).join(" ").toLowerCase();
}
function isSpain(team) {
  const name = teamName(team).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  return /^(spain|espana|espagne|espanha)( women| femenino| fem)?$/.test(name) || /^(spain|espana|espagne|espanha)\s+(women|femenina)$/.test(name);
}
function genderOf(event, spainTeam) {
  const text = (allEventText(event) + " " + teamName(spainTeam)).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  if (/women|woman|womens|femenin|fem\b|female/.test(text)) return "femenina";
  if (/men\b|mens|masculin|male/.test(text)) return "masculina";
  // ESPN/FIBA publica las competiciones absolutas masculinas con frecuencia sin la etiqueta "men".
  return "masculina";
}
const now = Date.now();
const startDate = madridDate(new Date(now));
const endDate = madridDate(new Date(now + 14 * 86400000));
// Consultamos cada día por separado: el endpoint FIBA puede rechazar rangos de fechas amplios.
const eventMap = new Map();
let successfulDays = 0;
for (let day = 0; day <= 14; day++) {
  const date = madridDate(new Date(now + day * 86400000));
  try {
    const scoreboard = await json(`https://site.api.espn.com/apis/site/v2/sports/basketball/fiba/scoreboard?dates=${date}&limit=500`);
    successfulDays++;
    for (const event of (Array.isArray(scoreboard?.events) ? scoreboard.events : [])) {
      if (event?.id) eventMap.set(String(event.id), event);
    }
  } catch (error) {
    console.log(`Aviso: ESPN FIBA no respondió para ${date}: ${error.message}`);
  }
}
if (successfulDays === 0) throw new Error("ESPN FIBA no respondió correctamente para ninguna de las 15 fechas consultadas.");
const events = [...eventMap.values()];
let published = 0, ignored = 0;

for (const event of events) {
  const competition = event.competitions?.[0];
  const competitors = competition?.competitors || [];
  const spain = competitors.find(entry => isSpain(entry.team));
  if (!spain) continue;
  const away = competitors.find(entry => entry.homeAway === "away");
  const home = competitors.find(entry => entry.homeAway === "home");
  if (!home || !away) continue;

  const details = allEventText(event);
  // Solo selecciones absolutas de 5 contra 5; no se mezclan categorías de formación ni 3x3.
  if (/u\s?1[6789]|u\s?20|under\s?1[6789]|under\s?20|youth|junior|3x3|three\s?\.?\s?on\s?three/.test(details)) {
    ignored++;
    continue;
  }
  const kickoff = Date.parse(event.date || "");
  if (!Number.isFinite(kickoff) || kickoff <= now || kickoff - now > 2 * 60 * 60 * 1000) continue;
  const gender = genderOf(event, spain.team);
  const subforum = gender === "femenina" ? "Selección femenina" : "Selección masculina";
  const label = gender === "femenina" ? "FEMENINA" : "MASCULINA";
  const homeName = teamName(home.team) || "Local";
  const awayName = teamName(away.team) || "Visitante";
  const eventMarker = `[[ASBASKET_PREVIA:${event.id}]]`;
  if (recent.some(post => (post.content || "").includes(eventMarker))) continue;

  const when = madridLabel(new Date(kickoff));
  const tournament = competition?.name || event.season?.name || "Competición internacional";
  const venue = competition?.venue?.fullName || competition?.venue?.address?.city || "";
  const gameUrl = event.links?.web?.href || `https://www.espn.com/basketball/game/_/gameId/${event.id}`;
  const title = `🇪🇸 BALONCESTO | SELECCIÓN ${label} · ${awayName} – ${homeName}`;
  const question = gender === "femenina"
    ? "¿Qué esperáis de España en este partido? ¿Qué jugadora puede ser decisiva?"
    : "¿Qué esperáis de España en este partido? ¿Qué aspecto debe cuidar para llevarse la victoria?";
  const content = [
    eventMarker,
    `🏀 **PREVIA DEL PARTIDO**`,
    `🇪🇸 **${awayName} – ${homeName}**`,
    `🏆 Competición: ${tournament}`,
    `🕒 Fecha y hora: ${when} (hora peninsular)`,
    venue ? `📍 Pabellón: ${venue}` : "",
    "",
    "España afronta un nuevo compromiso internacional. En ALLSPORTS queremos conocer vuestra opinión antes del salto inicial.",
    "",
    `💬 **${question}**`,
    "",
    `🔗 Información del partido: ${gameUrl}`
  ].filter(Boolean).join("\n");

  const body = {
    user_id: userId, sport: "Baloncesto", subforum,
    content: `${title}\n${content}\n\n— ALLSPORTS Bot · Datos: ESPN/FIBA`,
    link_url: gameUrl
  };
  await json(`${SUPABASE_URL}/rest/v1/posts`, {
    method: "POST", headers: { ...auth, Prefer: "return=minimal" }, body: JSON.stringify(body)
  });
  recent.unshift({ content: body.content, created_at: new Date().toISOString() });
  published++;
  console.log("Previa publicada:", subforum, awayName, "-", homeName, when);
}
console.log(`Baloncesto selecciones: ${events.length} partidos FIBA revisados en ${successfulDays}/15 fechas; ${published} previas publicadas; ${ignored} partidos de formación/3x3 descartados.`);
