const SUPABASE_URL="https://tzmigdagymfauatjivcl.supabase.co";
const SUPABASE_KEY="sb_publishable_gZ8cx30ZlxlVjlb00vo1nw_LyDC0yGH";
const EMAIL=process.env.BOT_EMAIL, PASSWORD=process.env.BOT_PASSWORD;
const LEAGUE="uefa.europa.conf", ZONE="Europe/Madrid", FOOTER="— ALLSPORTS Bot · Datos: ESPN";
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
const dateKey=d=>madridDate(d).replaceAll("-","");
const madridTime=d=>d.toLocaleString("es-ES",{timeZone:ZONE,dateStyle:"full",timeStyle:"short"});
const now=Date.now(), from=new Date(now-86400000), to=new Date(now+9*86400000);
const tomorrow=new Date(Date.parse(madridDate(new Date(now))+"T12:00:00Z")+86400000).toISOString().slice(0,10);
const monthKeys=new Set();for(let d=new Date(from);d<=to;d.setUTCDate(d.getUTCDate()+1))monthKeys.add(dateKey(d).slice(0,6));
const scoreboards=await Promise.all([...monthKeys].map(month=>json(`https://site.api.espn.com/apis/site/v2/sports/soccer/${LEAGUE}/scoreboard?dates=${month}`)));
const events=[...new Map(scoreboards.flatMap(s=>Array.isArray(s?.events)?s.events:[]).map(e=>[String(e.id),e])).values()].filter(e=>{const d=new Date(e.date).getTime();return Number.isFinite(d)&&d>=from.getTime()&&d<=to.getTime()});
const mark=(k,id)=>`[[ASB2:${k}:${id}]]`;
function teams(e){const c=e.competitions?.[0],a=c?.competitors||[],h=a.find(x=>x.homeAway==="home"),v=a.find(x=>x.homeAway==="away");if(!h||!v)return null;return{c,h,v,hn:h.team?.displayName||h.team?.name||"Local",vn:v.team?.displayName||v.team?.name||"Visitante"}}
function findPost(id){return posts.find(p=>String(p.link_url||"").includes(`gameId=${id}`)||(p.content||"").includes(mark("PREVIA",id)))}
function hasReply(postId,k,id){return replies.some(r=>r.post_id===postId&&(r.content||"").includes(mark(k,id)))}
async function openThread(e,t){const date=new Date(e.date),title=`⚽ CONFERENCE LEAGUE | ${t.hn} vs ${t.vn}`,venue=t.c?.venue?.fullName||"Estadio por confirmar";
const body=[mark("PREVIA",e.id),"PREVIA DE LA JORNADA",`ENCUENTRO | ${t.hn} vs ${t.vn}`,`FECHA Y HORA | ${madridTime(date)} (hora peninsular)`,`ESTADIO | ${venue}`,"","Conference League nos trae este enfrentamiento. Abrimos el hilo para comentar cómo llegan ambos equipos y compartir pronósticos.","¿Quién se llevará los tres puntos? Os leemos.","",FOOTER].join("\n");
const result=await json(`${SUPABASE_URL}/rest/v1/posts`,{method:"POST",headers:{...auth,Prefer:"return=representation"},body:JSON.stringify({user_id:userId,sport:"Fútbol",subforum:"Conference League",content:title+"\n"+body,link_url:`https://www.espn.com/soccer/match/_/gameId/${e.id}`})});
const row=Array.isArray(result)?result[0]:result;if(row?.id)posts.unshift(row);console.log("Previa creada:",title);return row?.id||null}
async function updateThread(postId,k,id,content){if(!postId||hasReply(postId,k,id))return false;
await json(`${SUPABASE_URL}/rest/v1/replies`,{method:"POST",headers:{...auth,Prefer:"return=minimal"},body:JSON.stringify({post_id:postId,user_id:userId,content:[mark(k,id),content,"",FOOTER].join("\n")})});
replies.unshift({post_id:postId,content:mark(k,id)+content});console.log("Actualización:",k,id);return true}
function sideRoster(side){if(!side)return null;const list=Array.isArray(side)?side:side.roster||side.players||side.athletes||side.entries||[];const players=list.map(x=>{const a=x.athlete||x.player||x,name=a.displayName||a.fullName||a.name||a.shortName;if(!name)return null;return{name,starter:x.starter===true||x.isStarter===true||x.type?.name==="starter",number:a.jersey||a.jerseyNumber||x.jersey||""}}).filter(Boolean);return{players,formation:typeof side.formation==="string"?side.formation:side.formation?.displayName||side.formation?.name||""}}
function getLineups(s,hid,vid,hn,vn){const root=s.rosters||s.lineups;if(!root)return null;let hr,vr;
if(Array.isArray(root)){for(const x of root){const id=String(x.team?.id||x.teamId||x.id||"");if(id===String(hid))hr=x;if(id===String(vid))vr=x}}
else{hr=root.home||root.Home||root.homeTeam;vr=root.away||root.Away||root.awayTeam;if(!hr||!vr)for(const x of Object.values(root)){if(!x||typeof x!=="object")continue;const id=String(x.team?.id||x.teamId||x.id||"");if(id===String(hid))hr=x;if(id===String(vid))vr=x}}
const h=sideRoster(hr),v=sideRoster(vr);if(!h||!v||h.players.filter(x=>x.starter).length<10||v.players.filter(x=>x.starter).length<10)return null;
const format=(name,x)=>[`EQUIPO | ${name}`,`SISTEMA | ${x.formation||"No facilitado"}`,`TITULARES | ${x.players.filter(p=>p.starter).map(p=>(p.number?p.number+". ":"")+p.name).join(" · ")}`,`SUPLENTES | ${x.players.filter(p=>!p.starter).map(p=>(p.number?p.number+". ":"")+p.name).join(" · ")||"No facilitados"}`].join("\n");
return[format(hn,h),format(vn,v)].join("\n")}
function goals(s){const a=s.keyEvents||s.scoringPlays||[];return [...new Set(a.map(x=>x.text||x.shortText||x.description||"").filter(x=>/gol|goal|penalt/i.test(x)).map(x=>x.replace(/\s+/g," ").trim()))].slice(0,12)}
const spanishClubs=["real madrid","barcelona","atletico madrid","atletico de madrid","girona","athletic club","real sociedad","villarreal","real betis","sevilla","celta vigo","valencia","osasuna","getafe","mallorca","alaves","espanyol","rayo vallecano","levante","elche","real oviedo","granada","las palmas","leganes","cadiz","sporting gijon","real zaragoza","tenerife","burgos","racing santander","almeria","eibar","huesca","valladolid"];
function isSpanishClub(team){const n=String(team?.displayName||team?.name||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9 ]/g," ").trim();return spanishClubs.some(x=>n===x||n.startsWith(x+" "));}
let previews=0,lineups=0,results=0;
for(const e of events){const t=teams(e);if(!t||(!isSpanishClub(t.h.team)&&!isSpanishClub(t.v.team)))continue;const kick=new Date(e.date).getTime();if(!Number.isFinite(kick))continue;
let post=findPost(e.id);const matchDay=madridDate(new Date(kick)),today=madridDate(new Date(now));const missingTodayPreview=matchDay===today&&kick>now&&kick-now<=3*3600000;if(((matchDay===tomorrow&&kick>now)||missingTodayPreview)&&!post){const id=await openThread(e,t);if(id){previews++;post=posts.find(p=>p.id===id)}}
if(!post)continue;const state=e.status?.type?.state,checkXI=state==="pre"&&kick>now&&kick-now<=3*3600000,checkFinal=state==="post"&&now-kick<=18*3600000;if(!checkXI&&!checkFinal)continue;
const summary=await json(`https://site.api.espn.com/apis/site/v2/sports/soccer/${LEAGUE}/summary?event=${e.id}`).catch(err=>{console.log("Resumen no disponible",e.id,err.message);return null});if(!summary)continue;
if(checkXI&&!hasReply(post.id,"ALINEACIONES",e.id)){const xi=getLineups(summary,t.h.team?.id,t.v.team?.id,t.hn,t.vn);if(xi&&await updateThread(post.id,"ALINEACIONES",e.id,["ALINEACIONES OFICIALES",`PARTIDO | ${t.hn} vs ${t.vn}`,xi,"Fuente: ESPN"].join("\n\n")))lineups++}
if(checkFinal&&!hasReply(post.id,"RESULTADO",e.id)){const score=[`MARCADOR | ${t.hn} | ${t.h.score??"—"} | ${t.v.score??"—"} | ${t.vn}`,`GOLEADORES | ${goals(summary).join(" · ")||"Detalle no disponible en la fuente"}`,`ESTADIO | ${t.c?.venue?.fullName||"No facilitado"}`,"El encuentro ha terminado. ¿Qué valoración hacéis del partido?"];if(await updateThread(post.id,"RESULTADO",e.id,["RESULTADO FINAL",...score].join("\n")))results++}
}
console.log(`Conference League: ${events.length} partidos revisados; ${previews} previas; ${lineups} alineaciones; ${results} resultados.`);
