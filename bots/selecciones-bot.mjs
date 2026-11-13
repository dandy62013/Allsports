const SUPABASE_URL="https://tzmigdagymfauatjivcl.supabase.co";
const SUPABASE_KEY="sb_publishable_gZ8cx30ZlxlVjlb00vo1nw_LyDC0yGH";
const EMAIL=process.env.BOT_EMAIL, PASSWORD=process.env.BOT_PASSWORD;
const ZONE="Europe/Madrid", FOOTER="— ALLSPORTS Bot · Datos: ESPN";
const LEAGUES=["uefa.nations","fifa.worldq.uefa","fifa.world","uefa.euro","uefa.euroq","fifa.friendly"];
if(!EMAIL||!PASSWORD) throw new Error("Faltan BOT_EMAIL y BOT_PASSWORD.");
const headers={apikey:SUPABASE_KEY,"Content-Type":"application/json"};
async function json(url,options={}){const r=await fetch(url,{...options,headers:{...headers,...(options.headers||{})}});if(!r.ok)throw new Error(`HTTP ${r.status} en ${url}: ${(await r.text()).slice(0,250)}`);const t=await r.text();if(!t.trim())return null;try{return JSON.parse(t)}catch{throw new Error("Respuesta JSON no válida de ESPN/Supabase.")}}
const session=await json(`${SUPABASE_URL}/auth/v1/token?grant_type=password`,{method:"POST",body:JSON.stringify({email:EMAIL,password:PASSWORD})});
const userId=session.user?.id;if(!session.access_token||!userId)throw new Error("No se pudo iniciar sesión con Informador.");
const auth={Authorization:`Bearer ${session.access_token}`};
await json(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}`,{method:"PATCH",headers:{...auth,Prefer:"return=minimal"},body:JSON.stringify({username:"Informador"})}).catch(e=>console.log("Aviso de perfil:",e.message));
const since=new Date(Date.now()-30*86400000).toISOString();
const pRows=await json(`${SUPABASE_URL}/rest/v1/posts?select=id,content,link_url,created_at&user_id=eq.${userId}&created_at=gte.${encodeURIComponent(since)}&order=created_at.desc&limit=500`,{headers:auth});
const posts=Array.isArray(pRows)?pRows:[];
const madridDate=d=>new Intl.DateTimeFormat("en-CA",{timeZone:ZONE,year:"numeric",month:"2-digit",day:"2-digit"}).format(d);
const madridTime=d=>d.toLocaleString("es-ES",{timeZone:ZONE,dateStyle:"full",timeStyle:"short"});
const now=Date.now(),from=new Date(now-86400000),to=new Date(now+45*86400000);
const monthKeys=new Set();for(let d=new Date(from);d<=to;d.setUTCDate(d.getUTCDate()+1))monthKeys.add(madridDate(d).replaceAll("-","").slice(0,6));
const calendars=await Promise.all(LEAGUES.flatMap(league=>[...monthKeys].map(async month=>({league,data:await json(`https://site.api.espn.com/apis/site/v2/sports/soccer/${league}/scoreboard?dates=${month}`).catch(e=>{console.log("Calendario no disponible",league,month,e.message);return null})}))));
const allEvents=new Map();
for(const item of calendars)for(const e of (Array.isArray(item.data?.events)?item.data.events:[]))allEvents.set(String(e.id),{...e,allsportsLeague:item.league});
const events=[...allEvents.values()].filter(e=>{const d=new Date(e.date).getTime();return Number.isFinite(d)&&d>=from.getTime()&&d<=to.getTime()});
function matchTeams(e){const c=e.competitions?.[0],a=c?.competitors||[],spain=a.find(x=>{const t=x.team||{};return String(t.abbreviation||"").toUpperCase()==="ESP"||/^(spain|españa)$/i.test(t.displayName||t.name||t.shortDisplayName||"")}),opp=a.find(x=>x!==spain);if(!spain||!opp)return null;return{c,spain,opp,sn:spain.team?.displayName||"España",on:opp.team?.displayName||opp.team?.name||"Rival"}}
const marker=id=>`[[ASB2:PREVIA:${id}]]`;
function findPost(e){return posts.find(p=>(p.content||"").includes(marker(e.id))||(p.link_url||"").includes(`gameId=${e.id}`))}
async function createPreview(e,t){const kick=new Date(e.date),venue=t.c?.venue?.fullName||"Estadio por confirmar",competition=e.league?.name||e.season?.name||"Partido internacional";
const body=[marker(e.id),"PREVIA DE LA SELECCIÓN",`ENCUENTRO | ${t.sn} vs ${t.on}`,`FECHA Y HORA | ${madridTime(kick)} (hora peninsular)`,`ESTADIO | ${venue}`,`COMPETICIÓN | ${competition}`,"",`CONTEXTO | España afronta un nuevo compromiso internacional ante ${t.on}. Abrimos el hilo para comentar el partido y compartir vuestras expectativas.`,"¿Cómo veis a España? ¡Os leemos!","",FOOTER].join("\n");
const result=await json(`${SUPABASE_URL}/rest/v1/posts`,{method:"POST",headers:{...auth,Prefer:"return=representation"},body:JSON.stringify({user_id:userId,sport:"Fútbol",subforum:"Selecciones",content:`🇪🇸 ESPAÑA | ${t.sn} vs ${t.on}\n${body}`,link_url:`https://www.espn.com/soccer/match/_/gameId/${e.id}`})});
const row=Array.isArray(result)?result[0]:result;if(row?.id){posts.unshift(row);console.log("Previa creada:",t.sn,"vs",t.on)}return row?.id||null}
let created=0,checked=0;
for(const e of events){const t=matchTeams(e);if(!t)continue;const kick=new Date(e.date).getTime(),matchDay=madridDate(new Date(kick)),today=madridDate(new Date(now));
const dueTomorrow=matchDay===madridDate(new Date(now+86400000))&&kick>now;
const dueSoon=matchDay===today&&kick>now&&kick-now<=3*3600000;
if(!dueTomorrow&&!dueSoon)continue;checked++;if(findPost(e))continue;
if(await createPreview(e,t))created++}
console.log(`Selecciones España: ${events.length} eventos revisados; ${checked} previas pendientes de publicar; ${created} nuevas previas.`);
