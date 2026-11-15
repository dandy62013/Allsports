const SUPABASE_URL="https://tzmigdagymfauatjivcl.supabase.co";
const SUPABASE_KEY="sb_publishable_gZ8cx30ZlxlVjlb00vo1nw_LyDC0yGH";
const EMAIL=process.env.BOT_EMAIL,PASSWORD=process.env.BOT_PASSWORD;
const ZONE="Europe/Madrid",FOOTER="— ALLSPORTS Bot · Datos: ESPN";
if(!EMAIL||!PASSWORD)throw new Error("Faltan BOT_EMAIL y BOT_PASSWORD.");
const LEAGUES=[
 {key:"PRIMERA",slug:"esp.1",name:"PRIMERA DIVISIÓN",subforum:"La Liga"},
 {key:"SEGUNDA",slug:"esp.2",name:"SEGUNDA DIVISIÓN",subforum:"Segunda División"},
 {key:"FEMENINO",slug:"esp.w.1",name:"LIGA F",subforum:"Fútbol femenino"}
];
const headers={apikey:SUPABASE_KEY,"Content-Type":"application/json"};
async function json(url,options={}){const r=await fetch(url,{...options,headers:{...headers,...(options.headers||{})}});if(!r.ok)throw new Error(`HTTP ${r.status} en ${url}: ${(await r.text()).slice(0,250)}`);const t=await r.text();if(!t.trim())return null;try{return JSON.parse(t)}catch{throw new Error("Respuesta JSON no válida de ESPN/Supabase.")}}
const session=await json(`${SUPABASE_URL}/auth/v1/token?grant_type=password`,{method:"POST",body:JSON.stringify({email:EMAIL,password:PASSWORD})});
const userId=session.user?.id;if(!session.access_token||!userId)throw new Error("No se pudo iniciar sesión con Informador.");
const auth={Authorization:`Bearer ${session.access_token}`};
await json(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}`,{method:"PATCH",headers:{...auth,Prefer:"return=minimal"},body:JSON.stringify({username:"Informador"})}).catch(e=>console.log("Aviso de perfil:",e.message));
const since=new Date(Date.now()-100*86400000).toISOString();
const rows=await json(`${SUPABASE_URL}/rest/v1/posts?select=id,content,created_at,subforum&user_id=eq.${userId}&created_at=gte.${encodeURIComponent(since)}&order=created_at.desc&limit=1000`,{headers:auth});
const posts=Array.isArray(rows)?rows:[];
const now=Date.now(),nowDate=new Date(now);
const madridDate=d=>new Intl.DateTimeFormat("en-CA",{timeZone:ZONE,year:"numeric",month:"2-digit",day:"2-digit"}).format(d);
const seasonYear=nowDate.getMonth()>=6?nowDate.getFullYear():nowDate.getFullYear()-1;
const monthKeys=[];for(let y=seasonYear;y<=nowDate.getFullYear();y++){const first=y===seasonYear?7:1,last=y===nowDate.getFullYear()?nowDate.getMonth()+1:12;for(let m=first;m<=last;m++)monthKeys.push(String(y)+String(m).padStart(2,"0"))}
function weekInfo(e){const c=e.competitions?.[0]||{},w=e.scoreboardWeek||c.week||e.week||e.season?.week;let n=w?.number??w?.value??null;let label=w?.text||w?.displayName||w?.name||"";if(n==null){const m=String(label).match(/(?:jornada|matchday|week|fecha)\s*(\d+)/i);if(m)n=Number(m[1])}if(n==null&&typeof w==="number")n=w;if(n==null)return null;return{number:String(n),label:label||`Jornada ${n}`}}
function isFinal(e){return e.status?.type?.state==="post"||e.competitions?.[0]?.status?.type?.state==="post"}
function marker(league,season,week){return `[[ASCL:${league.key}:${season}:${week}]]`}
function findEntries(data){const found=[];function walk(x){if(!x||typeof x!=="object")return;if(Array.isArray(x)){for(const v of x)walk(v);return}if(Array.isArray(x.entries)&&x.entries.some(v=>v?.team)){found.push(...x.entries.filter(v=>v?.team));return}for(const v of Object.values(x))walk(v)}walk(data);return found}
function statMap(entry){const out={};const raw=entry.stats;if(Array.isArray(raw)){for(const s of raw){const k=String(s.name||s.type||s.abbreviation||"").toLowerCase();if(k)out[k]=s.displayValue??s.value??s.abbreviation??""}}else if(raw&&typeof raw==="object")Object.assign(out,raw);return out}
function pick(stats,names){for(const n of names){const v=stats[n];if(v!==undefined&&v!==null&&v!=="")return String(v)}return null}
function compactEntry(entry,index){const s=statMap(entry),team=entry.team?.displayName||entry.team?.name;if(!team)return null;const rank=pick(s,["rank","playoffseed","seed"])||String(index+1),pts=pick(s,["points","pts"]),played=pick(s,["gamesplayed","played","gp"]),wins=pick(s,["wins","won","w"]),draws=pick(s,["ties","draws","drawn","d"]),losses=pick(s,["losses","lost","l"]),gf=pick(s,["pointsfor","goalsfor","for","gf"]),ga=pick(s,["pointsagainst","goalsagainst","against","ga"]),gd=pick(s,["pointdifferential","goaldifference","goaldiff","gd"]);const parts=[];if(pts!==null)parts.push(pts+" pts");if(played!==null)parts.push("PJ "+played);if(wins!==null&&draws!==null&&losses!==null)parts.push("G-E-P "+wins+"-"+draws+"-"+losses);if(gf!==null&&ga!==null)parts.push("GF-GC "+gf+"-"+ga);if(gd!==null)parts.push("Dif. "+gd);return rank+". "+team+(parts.length?" | "+parts.join(" | "):"")}
async function publish(league,season,week,weekLabel,standings){const mark=marker(league,season,week);if(posts.some(p=>p.subforum===league.subforum&&(p.content||"").includes(mark))){console.log("Clasificación ya publicada:",league.name,weekLabel);return false}
const entries=findEntries(standings);if(!entries.length){console.log("Sin filas de clasificación en ESPN:",league.name);return false}
const lines=entries.map(compactEntry).filter(Boolean);if(!lines.length)return false;
const seasonName=standings.season?.displayName||String(season)+"/"+(season+1);
const title=`🏆 CLASIFICACIÓN | ${league.name} | ${weekLabel}`;
const body=[mark,"CLASIFICACIÓN TRAS LA JORNADA",`COMPETICIÓN | ${league.name}`,`TEMPORADA | ${seasonName}`,`JORNADA | ${weekLabel}`,"","POSICIÓN | EQUIPO | PUNTOS | PJ | G-E-P | GF-GC | DIF.","",...lines,"","Tabla actualizada tras finalizar la jornada. Los datos se ofrecen según la clasificación publicada por ESPN.","",FOOTER].join("\n");
const result=await json(`${SUPABASE_URL}/rest/v1/posts`,{method:"POST",headers:{...auth,Prefer:"return=representation"},body:JSON.stringify({user_id:userId,sport:"Fútbol",subforum:league.subforum,content:title+"\n"+body})});
const row=Array.isArray(result)?result[0]:result;if(row?.id){posts.unshift(row);console.log("Clasificación publicada:",league.name,weekLabel,"equipos:",lines.length);return true}throw new Error("Supabase no confirmó la creación del hilo de clasificación.")}
let published=0;
for(const league of LEAGUES){
 const calendars=await Promise.all(monthKeys.map(async month=>({month,data:await json(`https://site.api.espn.com/apis/site/v2/sports/soccer/${league.slug}/scoreboard?dates=${month}`).catch(e=>{console.log("Calendario no disponible",league.slug,month,e.message);return null})})));
 const all=new Map();for(const item of calendars)for(const e of (Array.isArray(item.data?.events)?item.data.events:[]))all.set(String(e.id),{...e,scoreboardWeek:item.data?.week||null});
 const groups=new Map();for(const e of all.values()){const w=weekInfo(e);if(!w)continue;const key=w.number;if(!groups.has(key))groups.set(key,{week:w,events:[]});groups.get(key).events.push(e)}
 const completed=[...groups.values()].filter(g=>g.events.length>0&&g.events.every(isFinal)&&g.events.every(e=>new Date(e.date).getTime()<=now)).map(g=>({...g,last:Math.max(...g.events.map(e=>new Date(e.date).getTime()))})).filter(g=>now-g.last<=48*3600000).sort((a,b)=>b.last-a.last);
 console.log(league.name+":",all.size,"partidos;",groups.size,"jornadas identificadas;",completed.length,"jornadas recién finalizadas.");
 if(!completed.length)continue;
 const g=completed[0],season=seasonYear,standings=await json(`https://site.api.espn.com/apis/v2/sports/soccer/${league.slug}/standings?season=${season}`);
 if(await publish(league,season,g.week.number,g.week.label,standings))published++;
}
console.log("Bot de clasificaciones terminado. Publicaciones nuevas:",published);
