const SUPABASE_URL = "https://tzmigdagymfauatjivcl.supabase.co";
const SUPABASE_KEY = "sb_publishable_gZ8cx30ZlxlVjlb00vo1nw_LyDC0yGH";
const EMAIL = process.env.BOT_EMAIL, PASSWORD = process.env.BOT_PASSWORD;
const TARGET_START = "2026-11-20", TARGET_END = "2026-11-22";
const FOOTER = "— ALLSPORTS Bot · Informador";
if (!EMAIL || !PASSWORD) throw new Error("Faltan BOT_EMAIL y BOT_PASSWORD.");
const baseHeaders = { apikey: SUPABASE_KEY, "Content-Type": "application/json" };
async function request(url, options = {}) {
  const r = await fetch(url, { ...options, headers: { ...baseHeaders, ...(options.headers || {}) } });
  if (!r.ok) throw new Error("HTTP " + r.status + " en " + url + ": " + (await r.text()).slice(0, 220));
  const raw = await r.text(); return raw.trim() ? JSON.parse(raw) : null;
}
const session = await request(SUPABASE_URL + "/auth/v1/token?grant_type=password", {
  method: "POST", body: JSON.stringify({ email: EMAIL, password: PASSWORD })
});
const userId = session.user?.id;
if (!session.access_token || !userId) throw new Error("No se pudo iniciar sesión con Informador.");
const auth = { Authorization: "Bearer " + session.access_token };
await request(SUPABASE_URL + "/rest/v1/profiles?id=eq." + userId, {
  method: "PATCH", headers: { ...auth, Prefer: "return=minimal" },
  body: JSON.stringify({ username: "Informador" })
}).catch(() => {});
const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
if (today < TARGET_START || today > TARGET_END) {
  console.log("Rugby y golf: ventana del fin de semana cerrada; no se crean hilos fuera de fecha.");
} else {
  const threads = [
    {
      sport: "Rugby", subforum: "General", marker: "[[ASRUGBY:WEEKEND:2026-11-21]]",
      title: "🏉 RUGBY | Fin de semana internacional: Nations Cup y Nations Championship | 21/11",
      content: `🏉 RUGBY | Fin de semana internacional: Nations Cup y Nations Championship | 21/11
[[ASRUGBY:WEEKEND:2026-11-21]]
HILO DE RUGBY · 21 Y 22 DE NOVIEMBRE DE 2026

¿QUÉ ES EL RUGBY?
Dos equipos de 15 jugadores (en rugby XV) avanzan con un balón ovalado. Se puede correr con él y patearlo; los pases con las manos deben ir hacia atrás. Se puntúa principalmente apoyando el balón en la zona de marca (ensayo), y también mediante patadas a palos.

PARTIDOS DESTACADOS · SÁBADO 21
NATIONS CUP
• Hong Kong China – Tonga
• Georgia – Estados Unidos
• Portugal – Uruguay
• España – Samoa
• Zimbabue – Chile

NATIONS CHAMPIONSHIP
• Inglaterra – Nueva Zelanda
• Escocia – Japón
• Irlanda – Sudáfrica
• Italia – Fiji
• Francia – Argentina
• Gales – Australia

El gran foco para la afición española será España–Samoa, en Málaga. También destacan Inglaterra–Nueva Zelanda e Irlanda–Sudáfrica.

¿Seguís el rugby? ¿Qué partido os apetece más? ¡Os leemos!

FUENTE | World Rugby · https://www.world.rugby/nations-cup/
${FOOTER}`,
      link_url: "https://www.world.rugby/nations-cup/"
    },
    {
      sport: "Golf", subforum: "General", marker: "[[ASGOLF:WEEKEND:2026-11-21]]",
      title: "⛳ GOLF | Torneos internacionales del fin de semana | 19–22/11",
      content: `⛳ GOLF | TORNEOS INTERNACIONALES DEL FIN DE SEMANA
[[ASGOLF:WEEKEND:2026-11-21]]

━━━━━━━━━━━━━━━━━━━━
📅 AGENDA · 19 AL 22 DE NOVIEMBRE DE 2026
━━━━━━━━━━━━━━━━━━━━

Este fin de semana hay tres citas destacadas en el golf profesional. Estos son los torneos que conviene seguir:

🏆 PGA TOUR
THE RSM CLASSIC

📍 Sea Island Golf Club · Seaside Course
St. Simons Island, Georgia (Estados Unidos)
📅 Del 19 al 22 de noviembre

Última cita de la temporada de otoño del PGA TOUR.

━━━━━━━━━━━━━━━━━━━━

🏆 LPGA
CME GROUP TOUR CHAMPIONSHIP

📍 Tiburón Golf Club
Naples, Florida (Estados Unidos)
📅 Del 19 al 22 de noviembre

Torneo final de la temporada LPGA, con las mejores jugadoras del circuito.

━━━━━━━━━━━━━━━━━━━━

🏆 JAPAN GOLF TOUR
DUNLOP PHOENIX TOURNAMENT

📍 Phoenix Country Club
Miyazaki (Japón)
📅 Del 19 al 22 de noviembre

Una de las pruebas destacadas del calendario japonés.

━━━━━━━━━━━━━━━━━━━━
📊 HORARIOS Y CLASIFICACIONES

Añadiremos los horarios de salida, resultados y clasificaciones cuando estén confirmados por los circuitos oficiales.

💬 ¿A quién seguís este fin de semana? ¿Qué torneo os parece más interesante? ¡Os leemos!

🔗 FUENTES OFICIALES
• PGA TOUR: https://www.pgatour.com/schedule
• LPGA: https://www.lpga.com/tournaments/cme-group-tour-championship/overview

— ALLSPORTS Bot · Informador`,
      link_url: "https://www.pgatour.com/schedule"
    }
  ];
  for (const item of threads) {
    const filter = encodeURIComponent("%" + item.marker + "%");
    const existing = await request(SUPABASE_URL + "/rest/v1/posts?select=id&user_id=eq." + userId + "&content=like." + filter + "&limit=1", { headers: auth });
    if (Array.isArray(existing) && existing.length) {
      console.log(item.sport + ": hilo ya existe; no se duplica.");
      continue;
    }
    const result = await request(SUPABASE_URL + "/rest/v1/posts", {
      method: "POST", headers: { ...auth, Prefer: "return=representation" },
      body: JSON.stringify({ user_id: userId, sport: item.sport, subforum: item.subforum, content: item.content, link_url: item.link_url })
    });
    const row = Array.isArray(result) ? result[0] : result;
    if (!row?.id) throw new Error("No se pudo crear el hilo de " + item.sport + ".");
    console.log(item.sport + ": hilo creado " + row.id);
  }
}
