const SUPABASE_URL="https://tzmigdagymfauatjivcl.supabase.co";
const SUPABASE_KEY="sb_publishable_gZ8cx30ZlxlVjlb00vo1nw_LyDC0yGH";
const EMAIL=process.env.BOT_EMAIL,PASSWORD=process.env.BOT_PASSWORD;
const ZONE="Europe/Madrid",FOOTER="— ALLSPORTS Bot · Datos: ESPN";
if(!EMAIL||!PASSWORD)throw new Error("Faltan BOT_EMAIL y BOT_PASSWORD.");
const headers={apikey:SUPABASE_KEY,"Content-Type":"application/json"};
async function json(url,options={}){const r=await fetch(url,{...options,headers:{...headers,...(options.headers||{})}});if(!r.ok)throw new Error("HTTP "+r.status+" en "+url+": "+(await r.text()).slice(0,200));const t=await r.text();return t.trim()?JSON.parse(t):null}
const session=await json(SUPABASE_URL+"/auth/v1/token?grant_type=password",{method:"POST",body:JSON.stringify({email:EMAIL,password:PASSWORD})});
const userId=session.user?.id;if(!session.access_token||!userId)throw new Error("No se pudo iniciar sesión con Informador.");
const auth={Authorization:"Bearer "+session.access_token};
await json(SUPABASE_URL+"/rest/v1/profiles?id=eq."+userId,{method:"PATCH",headers:{...auth,Prefer:"return=minimal"},body:JSON.stringify({username:"Informador"})}).catch(()=>{});
const since=new Date(Date.now()-45*86400000).toISOString();
const [pRows,rRows]=await Promise.all([
 json(SUPABASE_URL+"/rest/v1/posts?select=id,content,created_at,subforum&user_id=eq."+userId+"&created_at=gte."+encodeURIComponent(since)+"&order=created_at.desc&limit=1000",{headers:auth}),
 json(SUPABASE_URL+"/rest/v1/replies?select=id,post_id,content,created_at&user_id=eq."+userId+"&created_at=gte."+encodeURIComponent(since)+"&order=created_at.desc&limit=3000",{headers:auth})
]);
const posts=Array.isArray(pRows)?pRows:[],replies=Array.isArray(rRows)?rRows:[];
const now=Date.now(),ZONE_FMT=d=>new Date(d).toLocaleString("es-ES",{timeZone:ZONE,dateStyle:"medium",timeStyle:"short"}),shortDate=d=>new Date(d).toLocaleString("es-ES",{timeZone:ZONE,day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).replace(","," · ");
const marker=(...x)=>"[[ASTENIS:"+x.join(":")+"]]";
function findPost(token,subforum){return posts.find(p=>p.subforum===subforum&&(p.content||"").includes(token))}
async function createPost(subforum,title,body,link){const content=title+"\n"+body+"\n\n"+FOOTER;if(content.length>1000)throw new Error("Hilo demasiado largo: "+title);const data=await json(SUPABASE_URL+"/rest/v1/posts",{method:"POST",headers:{...auth,Prefer:"return=representation"},body:JSON.stringify({user_id:userId,sport:"Tenis",subforum,content,link_url:link||null})});const p=Array.isArray(data)?data[0]:data;if(p?.id){posts.unshift(p);console.log("Hilo creado:",title)}return p?.id||null}
function hasReply(postId,token){return replies.some(r=>r.post_id===postId&&(r.content||"").includes(token))}
async function reply(postId,token,heading,lines){if(!postId||hasReply(postId,token))return false;let body=[token,heading,...lines].join("\n");const suffix="\n\n"+FOOTER,max=1000-suffix.length;if(body.length>max)body=body.slice(0,max-2).trimEnd()+"…";await json(SUPABASE_URL+"/rest/v1/replies",{method:"POST",headers:{...auth,Prefer:"return=minimal"},body:JSON.stringify({post_id:postId,user_id:userId,content:body+suffix})});replies.unshift({post_id:postId,content:body});console.log("Respuesta:",heading);return true}
function eventMatches(e){return(e.groupings||[]).flatMap(g=>(g.competitions||[]).map(c=>({c,group:g.grouping?.displayName||g.displayName||""})))}
function compNames(c){return(c.competitors||[]).map(x=>x.athlete?.displayName||x.team?.displayName||x.displayName||x.name||"").filter(Boolean)}
function compScore(c){return(c.competitors||[]).map(x=>{const n=x.athlete?.displayName||x.team?.displayName||x.displayName||x.name||"Tenista";const sets=(x.linescores||[]).map(s=>s.displayValue??s.value??s).join(" ");return n+(sets?" ("+sets+")":"")+(x.winner?" · GANADOR":"")}).join(" vs ")}
function isDone(c){const s=c.status?.type||{};return s.completed===true||s.state==="post"||/final|retired|walkover/i.test((s.description||"")+" "+(s.name||""))}
function roundNumber(c){const s=((c.round?.displayName||c.notes?.[0]?.text||"")+"").toLowerCase();if(/quarter|cuartos/.test(s))return 4;if(/semi/.test(s))return 3;if(/final/.test(s)&&!/qualifying|quarter|semi/.test(s))return 2;if(/round of 16|octavos/.test(s))return 5;return 0}
function isGrandSlam(n){return /australian open|roland.garros|french open|wimbledon|us open/i.test(n||"")}
function canonical(n){return String(n||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z]/g,"")}
async function runRankings(tour){const sub=tour==="ATP"?"ATP":"WTA",token="[[ASTENIS:RANKING:"+tour+":";const old=posts.find(p=>p.subforum===sub&&(p.content||"").includes(token));if(old&&now-new Date(old.created_at).getTime()<15*86400000){console.log(tour+": ranking todavía dentro del intervalo de 15 días.");return}
const data=await json("https://site.api.espn.com/apis/site/v2/sports/tennis/"+tour.toLowerCase()+"/rankings");
const groups=Array.isArray(data?.rankings)?data.rankings:[],rankGroup=groups.find(x=>/singles|individual/i.test(x.name||x.type||""))||groups[0],rows=rankGroup?.ranks||rankGroup?.athletes||rankGroup?.entries||data?.ranks||data?.athletes||[];
const sorted=[...rows].sort((a,b)=>(a.current??a.rank??a.position??999)-(b.current??b.rank??b.position??999)).slice(0,20);
if(!sorted.length)throw new Error("ESPN no ha devuelto el ranking "+tour+".");
const rankingDate=data?.asOf||rankGroup?.asOf||rankGroup?.date||new Date().toISOString(),stamp=new Date().toISOString().slice(0,10).replaceAll("-","");
const lines=sorted.map((x,i)=>{const a=x.athlete||x.player||x;const name=a.displayName||a.fullName||a.name||a.shortName||"Jugador";const pos=x.current??x.rank??x.position??i+1;const points=x.points??x.pointTotal??x.stats?.find?.(z=>/point/i.test(z.name||""))?.value;return pos+". "+name+(points!=null?" · "+Number(points).toLocaleString("es-ES")+" pts":"")});
const id=await createPost(sub,"🎾 RANKING "+tour+" | "+new Date(rankingDate).toLocaleDateString("es-ES",{timeZone:ZONE}),[marker("RANKING",tour,stamp),"Clasificación mundial individual · Top 20",...lines].join("\n"),"https://www.espn.com/tennis/rankings");if(id)console.log(tour+": ranking publicado ("+lines.length+" posiciones).")}
async function getBoards(tour){const months=new Set();for(let i=0;i<3;i++){const d=new Date();d.setUTCMonth(d.getUTCMonth()+i);months.add(d.toISOString().slice(0,7).replace("-",""))}const pages=await Promise.all([...months].map(m=>json("https://site.api.espn.com/apis/site/v2/sports/tennis/"+tour+"/scoreboard?dates="+m).catch(e=>{console.log("Calendario "+tour+" no disponible",m,e.message);return null})));return [...new Map(pages.flatMap(x=>Array.isArray(x?.events)?x.events:[]).map(e=>[String(e.id),e])).values()]}
async function runGrandSlams(events){let created=0,results=0;const slams=new Map();for(const e of events){if(!isGrandSlam(e.name))continue;const k=canonical(e.name);if(!slams.has(k))slams.set(k,{name:e.name,events:[]});slams.get(k).events.push(e)}
for(const [key,item] of slams){const all=item.events.flatMap(e=>eventMatches(e).map(x=>({e,...x})));const firstEvent=item.events[0],start=new Date(firstEvent.date||now).getTime(),end=new Date(firstEvent.endDate||firstEvent.date||now).getTime(),sub="Grand Slams",token=marker("SLAM",key);let post=findPost(token,sub);
if(!post&&start-now<=7*86400000&&end>=now){const date=new Date(start);const id=await createPost(sub,"🎾 "+item.name+" | "+date.toLocaleDateString("es-ES",{timeZone:ZONE}),[token,"HILO OFICIAL DEL TORNEO","Seguiremos aquí los resultados de cuartos de final, semifinales y final.","¡Comenta el torneo con la comunidad ALLSPORTS!"].join("\n"),"https://www.espn.com/tennis/");if(id){created++;post=posts.find(p=>p.id===id)}}
if(!post)continue;
for(const x of all){const c=x.c;if(roundNumber(c)<2||!isDone(c))continue;const id=String(c.id||c.uid||canonical(compNames(c).join("-")));const tok=marker("SLAM_RESULT",key,id);const names=compNames(c);const date=c.date||x.e.date;const line=(c.round?.displayName||"Eliminatoria")+" · "+(date?shortDate(date):"")+"\n"+(names.length?compScore(c):c.name||"Partido");if(await reply(post.id,tok,"RESULTADO",line.split("\n")))results++}
}
console.log("Grand Slams: "+created+" hilos; "+results+" resultados de cuartos en adelante.")}
function countryNames(c){return(c.competitors||[]).map(x=>x.team?.displayName||x.team?.name||x.athlete?.displayName||x.displayName||"")}
function spainMatch(c){return(c.competitors||[]).some(x=>String(x.team?.abbreviation||"").toUpperCase()==="ESP"||/^(spain|españa)$/i.test(x.team?.displayName||x.team?.name||"")||/^(spain|españa)$/i.test(x.athlete?.flagAltText||x.athlete?.flag?.alt||""))}
async function runNational(events,kind,sub,label){let previews=0,results=0;for(const e of events){if(!/davis cup|billie jean king cup/i.test(e.name||""))continue;for(const {c}=eventMatches(e)){if(!spainMatch(c))continue;const id=String(c.id||c.uid||"");if(!id)continue;const date=c.date||e.date;if(!date)continue;const when=new Date(date).getTime();const teams=countryNames(c);const token=marker(kind,id);let post=findPost(token,sub);
if(!post&&when-now<=24*3600000&&when>=now-2*3600000){const title="🎾 "+label+" | España · "+teams.join(" vs ")+" | "+shortDate(date);const pid=await createPost(sub,title,[token,"PREVIA","España disputa este enfrentamiento de "+label+".","FECHA Y HORA | "+ZONE_FMT(date),"RIVAL | "+teams.filter(n=>!/spain|españa/i.test(n)).join(", ")||"Por confirmar","¡Vamos, España!"].join("\n"),"https://www.espn.com/tennis/");if(pid){previews++;post=posts.find(p=>p.id===pid)}}
if(!post)continue;if(isDone(c)){const score=compScore(c);if(await reply(post.id,marker(kind+"_RESULT",id),"RESULTADO FINAL",[shortDate(date),score||"Resultado oficial disponible"]))results++}
}}
console.log(label+": "+previews+" previas; "+results+" resultados de España.")}
const [atp,wta]=await Promise.all([getBoards("atp"),getBoards("wta")]);
await runRankings("ATP");await runRankings("WTA");
await runGrandSlams([...atp,...wta]);
await runNational([...atp,...wta],"DAVIS","Copa Davis","Copa Davis");
await runNational([...atp,...wta],"BJK","Billie Jean King Cup","Billie Jean King Cup");
