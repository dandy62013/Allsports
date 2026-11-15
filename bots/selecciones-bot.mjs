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
const [pRows,rRows]=await Promise.all([
 json(`${SUPABASE_URL}/rest/v1/posts?select=id,content,link_url,created_at&user_id=eq.${userId}&created_at=gte.${encodeURIComponent(since)}&order=created_at.desc&limit=500`,{headers:auth}),
 json(`${SUPABASE_URL}/rest/v1/replies?select=id,post_id,content,created_at&user_id=eq.${userId}&created_at=gte.${encodeURIComponent(since)}&order=created_at.desc&limit=1000`,{headers:auth})
]);
const posts=Array.isArray(pRows)?pRows:[], replies=Array.isArray(rRows)?rRows:[];
const madridDate=d=>new Intl.DateTimeFormat("en-CA",{timeZone:ZONE,year:"numeric",month:"2-digit",day:"2-digit"}).format(d);
const madridTime=d=>d.toLocaleString("es-ES",{timeZone:ZONE,dateStyle:"full",timeStyle:"short"});
const kickoffLabel=d=>d.toLocaleString("es-ES",{timeZone:ZONE,day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).replace(",", " ·");
const now=Date.now(),from=new Date(now-86400000),to=new Date(now+45*86400000);
const monthKeys=new Set();for(let d=new Date(from);d<=to;d.setUTCDate(d.getUTCDate()+1))monthKeys.add(madridDate(d).replaceAll("-","").slice(0,6));
const calendars=await Promise.all(LEAGUES.flatMap(league=>[...monthKeys].map(async month=>({league,data:await json(`https://site.api.espn.com/apis/site/v2/sports/soccer/${league}/scoreboard?dates=${month}`).catch(e=>{console.log("Calendario no disponible",league,month,e.message);return null})}))));
const allEvents=new Map();
for(const item of calendars)for(const e of (Array.isArray(item.data?.events)?item.data.events:[]))allEvents.set(String(e.id),{...e,allsportsLeague:item.league});
const events=[...allEvents.values()].filter(e=>{const d=new Date(e.date).getTime();return Number.isFinite(d)&&d>=from.getTime()&&d<=to.getTime()});
const SPANISH_TEAMS={spain:"España",england:"Inglaterra",france:"Francia",germany:"Alemania",italy:"Italia",portugal:"Portugal",netherlands:"Países Bajos",holland:"Países Bajos",belgium:"Bélgica",switzerland:"Suiza",austria:"Austria",croatia:"Croacia",serbia:"Serbia",ukraine:"Ucrania",poland:"Polonia",denmark:"Dinamarca",sweden:"Suecia",norway:"Noruega",finland:"Finlandia",ireland:"Irlanda", "republic of ireland":"Irlanda", "northern ireland":"Irlanda del Norte",wales:"Gales",scotland:"Escocia",greece:"Grecia",turkey:"Turquía",türkiye:"Turquía",czechia:"Chequia", "czech republic":"Chequia",slovakia:"Eslovaquia",hungary:"Hungría",romania:"Rumanía",bulgaria:"Bulgaria",slovenia:"Eslovenia", "bosnia and herzegovina":"Bosnia y Herzegovina",montenegro:"Montenegro",albania:"Albania",iceland:"Islandia",georgia:"Georgia",armenia:"Armenia",cyprus:"Chipre",israel:"Israel",morocco:"Marruecos", "côte d’ivoire":"Costa de Marfil", "ivory coast":"Costa de Marfil",senegal:"Senegal",nigeria:"Nigeria",ghana:"Ghana",cameroon:"Camerún",egypt:"Egipto",tunisia:"Túnez",algeria:"Argelia",japan:"Japón", "south korea":"Corea del Sur",korea:"Corea del Sur",china:"China",australia:"Australia", "united states":"Estados Unidos",usa:"Estados Unidos",mexico:"México",canada:"Canadá",brazil:"Brasil",argentina:"Argentina",uruguay:"Uruguay",colombia:"Colombia",chile:"Chile",ecuador:"Ecuador",peru:"Perú",paraguay:"Paraguay",venezuela:"Venezuela"};
function spanishTeamName(team){const raw=team?.displayName||team?.name||team?.shortDisplayName||"Rival";return SPANISH_TEAMS[raw.trim().toLowerCase()]||raw}
function matchTeams(e){const c=e.competitions?.[0],a=c?.competitors||[],spain=a.find(x=>{const t=x.team||{};return String(t.abbreviation||"").toUpperCase()==="ESP"||/^(spain|españa)$/i.test(t.displayName||t.name||t.shortDisplayName||"")}),opp=a.find(x=>x!==spain);if(!spain||!opp)return null;return{c,spain,opp,sn:"España",on:spanishTeamName(opp.team)}}
const marker=id=>`[[ASB2:PREVIA:${id}]]`;
function findPost(e){return posts.find(p=>(p.content||"").includes(marker(e.id))||(p.link_url||"").includes(`gameId=${e.id}`))}
async function createPreview(e,t){const kick=new Date(e.date),venue=t.c?.venue?.fullName||"Estadio por confirmar",competition=e.league?.name||e.season?.name||"Partido internacional";
const body=[marker(e.id),"PREVIA DE LA SELECCIÓN",`ENCUENTRO | ${t.sn} vs ${t.on}`,`FECHA Y HORA | ${madridTime(kick)} (hora peninsular)`,`ESTADIO | ${venue}`,`COMPETICIÓN | ${competition}`,"",`CONTEXTO | España afronta un nuevo compromiso internacional ante ${t.on}. Abrimos el hilo para comentar el partido y compartir vuestras expectativas.`,"¿Cómo veis a España? ¡Os leemos!","",FOOTER].join("\n");
const result=await json(`${SUPABASE_URL}/rest/v1/posts`,{method:"POST",headers:{...auth,Prefer:"return=representation"},body:JSON.stringify({user_id:userId,sport:"Fútbol",subforum:"Selecciones",content:`🇪🇸 ESPAÑA | ${t.sn} vs ${t.on} | ${kickoffLabel(kick)}\n${body}`,link_url:`https://www.espn.com/soccer/match/_/gameId/${e.id}`})});
const row=Array.isArray(result)?result[0]:result;if(row?.id){posts.unshift(row);console.log("Previa creada:",t.sn,"vs",t.on)}return row?.id||null}
const replyMark=(kind,id)=>`[[ASSEL:${kind}:${id}]]`;
function hasReply(postId,kind,id){return replies.some(r=>r.post_id===postId&&(r.content||"").includes(replyMark(kind,id)))}
async function updateThread(postId,kind,id,content){
 if(!postId||hasReply(postId,kind,id))return false;
 const marker=replyMark(kind,id),suffix="\n\n"+FOOTER,maxContent=1000-marker.length-suffix.length-1;
 let safe=String(content);if(safe.length>maxContent){safe=safe.slice(0,maxContent-1).trimEnd()+"…";console.log("Aviso: alineación recortada al límite de 1000 caracteres.",id)}
 await json(`${SUPABASE_URL}/rest/v1/replies`,{method:"POST",headers:{...auth,Prefer:"return=minimal"},body:JSON.stringify({post_id:postId,user_id:userId,content:[marker,safe,"",FOOTER].join("\n")})});
 replies.unshift({post_id:postId,content:marker+safe});console.log("Alineaciones publicadas:",id);return true;
}
function sideRoster(side){
 if(!side)return null;const list=Array.isArray(side)?side:side.roster||side.players||side.athletes||side.entries||[];
 const players=list.map(x=>{const a=x.athlete||x.player||x,name=a.displayName||a.fullName||a.name||a.shortName;if(!name)return null;const pos=a.position||x.position||{};return{name,starter:x.starter===true||x.isStarter===true||x.type?.name==="starter",number:a.jersey||a.jerseyNumber||x.jersey||"",position:typeof pos==="string"?pos:pos.displayName||pos.name||pos.abbreviation||pos.shortDisplayName||""}}).filter(Boolean);
 return{players,formation:typeof side.formation==="string"?side.formation:side.formation?.displayName||side.formation?.name||""};
}
function positionGroup(p){const v=String(p.position||"").toLowerCase();if(/goalkeeper|keeper|portero|\bgk\b/.test(v))return"PORTEROS";if(/defen|\b(def|df|d)\b/.test(v))return"DEFENSAS";if(/midfield|centrocamp|mediocamp|\b(mid|mf|m)\b/.test(v))return"CENTROCAMPISTAS";if(/forward|striker|delanter|attacker|\b(fwd|fw|f)\b/.test(v))return"DELANTEROS";return"OTROS"}
function rosterLines(players){return["PORTEROS","DEFENSAS","CENTROCAMPISTAS","DELANTEROS","OTROS"].map(g=>{const names=players.filter(p=>positionGroup(p)===g).map(p=>(p.number?p.number+". ":"")+p.name);return names.length?g+" | "+names.join(" · "):null}).filter(Boolean).join("\n")}
function getLineups(s,homeId,awayId,homeName,awayName){
 const root=s.rosters||s.lineups;if(!root)return null;let hr,vr;
 if(Array.isArray(root)){for(const x of root){const id=String(x.team?.id||x.teamId||x.id||"");if(id===String(homeId))hr=x;if(id===String(awayId))vr=x}}
 else{hr=root.home||root.Home||root.homeTeam;vr=root.away||root.Away||root.awayTeam;if(!hr||!vr)for(const x of Object.values(root)){if(!x||typeof x!=="object")continue;const id=String(x.team?.id||x.teamId||x.id||"");if(id===String(homeId))hr=x;if(id===String(awayId))vr=x}}
 const h=sideRoster(hr),v=sideRoster(vr);if(!h||!v||h.players.filter(x=>x.starter).length<10||v.players.filter(x=>x.starter).length<10)return null;
 const format=(name,x)=>[`EQUIPO | ${name}`,`SISTEMA | ${x.formation||"No facilitado"}`,"TITULARES",rosterLines(x.players.filter(p=>p.starter))||"No facilitados","SUPLENTES",rosterLines(x.players.filter(p=>!p.starter))||"No facilitados"].join("\n");
 return["ALINEACIONES OFICIALES",`PARTIDO | ${homeName} vs ${awayName}`,format(homeName,h),format(awayName,v),"Fuente: ESPN"].join("\n\n");
}
let created=0,checked=0,lineups=0;
for(const e of events){
 const t=matchTeams(e);if(!t)continue;const kick=new Date(e.date).getTime(),matchDay=madridDate(new Date(kick)),today=madridDate(new Date(now));
 const dueTomorrow=matchDay===madridDate(new Date(now+86400000))&&kick>now;
 const dueSoon=matchDay===today&&kick>now&&kick-now<=3*3600000;
 let post=findPost(e);
 if(dueTomorrow||dueSoon){checked++;if(!post&&await createPreview(e,t)){created++;post=findPost(e)}}
 const state=e.status?.type?.state,checkXI=(state==="pre"||state==="in")&&kick>=now-15*60000&&kick-now<=3*3600000;
 if(!post||!checkXI||hasReply(post.id,"ALINEACIONES",e.id))continue;
 const summary=await json(`https://site.api.espn.com/apis/site/v2/sports/soccer/${e.allsportsLeague}/summary?event=${e.id}`).catch(err=>{console.log("Resumen no disponible",e.id,err.message);return null});
 if(!summary)continue;
 const competitors=t.c.competitors||[],home=competitors.find(x=>x.homeAway==="home"),away=competitors.find(x=>x.homeAway==="away");
 const lineup=getLineups(summary,home?.team?.id,away?.team?.id,home?.team?.displayName||"Local",away?.team?.displayName||"Visitante");
 if(lineup&&await updateThread(post.id,"ALINEACIONES",e.id,lineup))lineups++;
}
console.log(`Selecciones España: ${events.length} eventos revisados; ${checked} previas pendientes; ${created} nuevas previas; ${lineups} alineaciones oficiales.`);
