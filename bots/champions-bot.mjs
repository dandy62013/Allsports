const SUPABASE_URL="https://tzmigdagymfauatjivcl.supabase.co";
const SUPABASE_KEY="sb_publishable_gZ8cx30ZlxlVjlb00vo1nw_LyDC0yGH";
const EMAIL=process.env.BOT_EMAIL, PASSWORD=process.env.BOT_PASSWORD;
const LEAGUE="uefa.champions", ZONE="Europe/Madrid", FOOTER="— ALLSPORTS Bot · Datos: ESPN";
if(!EMAIL||!PASSWORD) throw new Error("Faltan BOT_EMAIL y BOT_PASSWORD.");
const headers={apikey:SUPABASE_KEY,"Content-Type":"application/json"};
async function json(url,options={}){const r=await fetch(url,{...options,headers:{...headers,...(options.headers||{})}});if(!r.ok)throw new Error(`HTTP ${r.status} en ${url}: ${(await r.text()).slice(0,250)}`);const t=await r.text();if(!t.trim())return null;try{return JSON.parse(t)}catch{throw new Error("Respuesta JSON no válida de ESPN/Supabase.")}}
const session=await json(`${SUPABASE_URL}/auth/v1/token?grant_type=password`,{method:"POST",body:JSON.stringify({email:EMAIL,password:PASSWORD})});
const userId=session.user?.id;if(!session.access_token||!userId)throw new Error("No se pudo iniciar sesión con Informador.");
const auth={Authorization:`Bearer ${session.access_token}`};
await json(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}`,{method:"PATCH",headers:{...auth,Prefer:"return=minimal"},body:JSON.stringify({username:"Informador"})}).catch(e=>console.log("Aviso de perfil:",e.message));
const since=new Date(Date.now()-30*86400000).toISOString();
const [pRows,rRows]=await Promise.all([
 json(`${SUPABASE_URL}/rest/v1/posts?select=id,content,link_url,created_at,subforum&user_id=eq.${userId}&created_at=gte.${encodeURIComponent(since)}&order=created_at.desc&limit=500`,{headers:auth}),
 json(`${SUPABASE_URL}/rest/v1/replies?select=id,post_id,content,created_at&user_id=eq.${userId}&created_at=gte.${encodeURIComponent(since)}&order=created_at.desc&limit=1000`,{headers:auth})
]);
const posts=Array.isArray(pRows)?pRows:[], replies=Array.isArray(rRows)?rRows:[];
const madridDate=d=>new Intl.DateTimeFormat("en-CA",{timeZone:ZONE,year:"numeric",month:"2-digit",day:"2-digit"}).format(d);
const dateKey=d=>madridDate(d).replaceAll("-","");
const madridTime=d=>d.toLocaleString("es-ES",{timeZone:ZONE,dateStyle:"full",timeStyle:"short"});
const kickoffLabel=d=>d.toLocaleString("es-ES",{timeZone:ZONE,day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).replace(",", " ·");
const now=Date.now(), from=new Date(now-4*86400000), to=new Date(now+45*86400000);
const tomorrow=new Date(Date.parse(madridDate(new Date(now))+"T12:00:00Z")+86400000).toISOString().slice(0,10);
const monthKeys=new Set();for(let d=new Date(from);d<=to;d.setUTCDate(d.getUTCDate()+1))monthKeys.add(dateKey(d).slice(0,6));
const scoreboards=await Promise.all([...monthKeys].map(month=>json(`https://site.api.espn.com/apis/site/v2/sports/soccer/${LEAGUE}/scoreboard?dates=${month}`)));
const events=[...new Map(scoreboards.flatMap(s=>Array.isArray(s?.events)?s.events:[]).map(e=>[String(e.id),e])).values()].filter(e=>{const d=new Date(e.date).getTime();return Number.isFinite(d)&&d>=from.getTime()&&d<=to.getTime()});
const mark=(k,id)=>`[[ASB2:${k}:${id}]]`;
function teams(e){const c=e.competitions?.[0],a=c?.competitors||[],h=a.find(x=>x.homeAway==="home"),v=a.find(x=>x.homeAway==="away");if(!h||!v)return null;return{c,h,v,hn:h.team?.displayName||h.team?.name||"Local",vn:v.team?.displayName||v.team?.name||"Visitante"}}
function findPost(id){return posts.find(p=>p.subforum==="Champions League"&&(String(p.link_url||"").includes(`gameId=${id}`)||(p.content||"").includes(mark("PREVIA",id))))}
function hasReply(postId,k,id){return replies.some(r=>r.post_id===postId&&(r.content||"").includes(mark(k,id)))}
async function openThread(e,t){const date=new Date(e.date),title=`⚽ CHAMPIONS | ${t.hn} vs ${t.vn} | ${kickoffLabel(date)}`,venue=t.c?.venue?.fullName||"Estadio por confirmar";
const body=[mark("PREVIA",e.id),"PREVIA DE LA JORNADA",`ENCUENTRO | ${t.hn} vs ${t.vn}`,`FECHA Y HORA | ${madridTime(date)} (hora peninsular)`,`ESTADIO | ${venue}`,"","Champions League nos trae este enfrentamiento. Abrimos el hilo para comentar cómo llegan ambos equipos y compartir pronósticos.","¿Quién se llevará los tres puntos? Os leemos.","",FOOTER].join("\n");
const result=await json(`${SUPABASE_URL}/rest/v1/posts`,{method:"POST",headers:{...auth,Prefer:"return=representation"},body:JSON.stringify({user_id:userId,sport:"Fútbol",subforum:"Champions League",content:title+"\n"+body,link_url:`https://www.espn.com/soccer/match/_/gameId/${e.id}`})});
const row=Array.isArray(result)?result[0]:result;if(row?.id)posts.unshift(row);console.log("Previa creada:",title);return row?.id||null}
async function updateThread(postId,k,id,content){if(!postId||hasReply(postId,k,id))return false;const marker=mark(k,id),suffix="\n\n"+FOOTER,max=10000-marker.length-suffix.length-1;let safe=String(content);if(safe.length>max){safe=safe.slice(0,max-1).trimEnd()+"…";console.log("Aviso: actualización recortada al límite de 10000 caracteres.",k,id)}
await json(`${SUPABASE_URL}/rest/v1/replies`,{method:"POST",headers:{...auth,Prefer:"return=minimal"},body:JSON.stringify({post_id:postId,user_id:userId,content:[marker,safe,"",FOOTER].join("\n")})});
replies.unshift({post_id:postId,content:marker+safe});console.log("Actualización:",k,id);return true}
function sideRoster(side){if(!side)return null;const list=Array.isArray(side)?side:side.roster||side.players||side.athletes||side.entries||[];const players=list.map(x=>{const a=x.athlete||x.player||x,name=a.displayName||a.fullName||a.name||a.shortName;if(!name)return null;const pos=a.position||x.position||{};return{name,starter:x.starter===true||x.isStarter===true||x.type?.name==="starter",number:a.jersey||a.jerseyNumber||x.jersey||"",position:typeof pos==="string"?pos:pos.displayName||pos.name||pos.abbreviation||pos.shortDisplayName||""}}).filter(Boolean);return{players,formation:typeof side.formation==="string"?side.formation:side.formation?.displayName||side.formation?.name||""}}
function positionGroup(p){const v=String(p.position||"").toLowerCase();if(/goalkeeper|keeper|portero|\bgk\b/.test(v))return"PORTEROS";if(/defen|\b(def|df|d)\b/.test(v))return"DEFENSAS";if(/midfield|centrocamp|mediocamp|\b(mid|mf|m)\b/.test(v))return"CENTROCAMPISTAS";if(/forward|striker|delanter|attacker|\b(fwd|fw|f)\b/.test(v))return"DELANTEROS";return"OTROS"}
function rosterLines(players){const groups=["PORTEROS","DEFENSAS","CENTROCAMPISTAS","DELANTEROS","OTROS"];return groups.map(g=>{const names=players.filter(p=>positionGroup(p)===g).map(p=>(p.number?p.number+". ":"")+p.name);return names.length?g+" | "+names.join(" · "):null}).filter(Boolean).join("\n")}
function getLineups(s,hid,vid,hn,vn){const root=s.rosters||s.lineups;if(!root)return null;let hr,vr;
if(Array.isArray(root)){for(const x of root){const id=String(x.team?.id||x.teamId||x.id||"");if(id===String(hid))hr=x;if(id===String(vid))vr=x}}
else{hr=root.home||root.Home||root.homeTeam;vr=root.away||root.Away||root.awayTeam;if(!hr||!vr)for(const x of Object.values(root)){if(!x||typeof x!=="object")continue;const id=String(x.team?.id||x.teamId||x.id||"");if(id===String(hid))hr=x;if(id===String(vid))vr=x}}
const h=sideRoster(hr),v=sideRoster(vr);if(!h||!v||h.players.filter(x=>x.starter).length<10||v.players.filter(x=>x.starter).length<10)return null;
const format=(name,x)=>[`EQUIPO | ${name}`,`SISTEMA | ${x.formation||"No facilitado"}`,"TITULARES",rosterLines(x.players.filter(p=>p.starter))||"No facilitados","SUPLENTES",rosterLines(x.players.filter(p=>!p.starter))||"No facilitados"].join("\n");
return{home:format(hn,h),away:format(vn,v)}}
function goals(s){const a=s.keyEvents||s.scoringPlays||[];return [...new Set(a.map(x=>x.text||x.shortText||x.description||"").filter(x=>/gol|goal|penalt/i.test(x)).map(x=>x.replace(/\s+/g," ").trim()))].slice(0,12)}
const spanishClubs = new Set(["real madrid","barcelona","atletico madrid","atletico de madrid","girona","athletic club","real sociedad","villarreal","real betis","sevilla","celta vigo","valencia","osasuna","getafe","mallorca","alaves","espanyol","rayo vallecano","levante","elche","real oviedo","granada","las palmas","leganes","cadiz","sporting gijon","real zaragoza","tenerife","burgos","racing santander","almeria","eibar","huesca","valladolid"]);
function normalizeTeamName(value){return String(value||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9 ]/g," ").replace(/\s+/g," ").trim()}
function isSpanishClub(team){const name=normalizeTeamName(team?.displayName||team?.name||team?.shortDisplayName);return spanishClubs.has(name)||[...spanishClubs].some(club=>name.startsWith(club+" "))}

let previews=0,lineups=0,results=0;
for(const e of events){const t=teams(e);if(!t||(!isSpanishClub(t.h.team)&&!isSpanishClub(t.v.team)))continue;const kick=new Date(e.date).getTime();if(!Number.isFinite(kick))continue;
let post=findPost(e.id);const matchDay=madridDate(new Date(kick)),today=madridDate(new Date(now));const previewDue=kick>now&&kick-now<=45*86400000;if(previewDue&&!post){const id=await openThread(e,t);if(id){previews++;post=posts.find(p=>p.id===id)}}
if(!post)continue;const state=e.status?.type?.state,checkXI=kick-now<=60*60000&&kick-now>=-8*3600000,checkFinal=state==="post"&&kick<=now&&now-kick<=96*3600000;if(!checkXI&&!checkFinal)continue;
const summary=await json(`https://site.api.espn.com/apis/site/v2/sports/soccer/${LEAGUE}/summary?event=${e.id}`).catch(err=>{console.log("Resumen no disponible",e.id,err.message);return null});if(!summary)continue;
const summaryComp=summary.header?.competitions?.[0],summaryStatus=summaryComp?.status?.type,summaryStatusText=String(summaryStatus?.name||summaryStatus?.description||summaryStatus?.shortDetail||"").toLowerCase();
const summaryFinal=(summaryStatus?.state==="post"||/final|full time|finished|ended/.test(summaryStatusText))&&!/cancel|postpon|abandon|suspend/.test(summaryStatusText);
for(const competitor of summaryComp?.competitors||[]){if(competitor.score==null||String(competitor.score).trim()==="")continue;const score=Number(competitor.score);if(!Number.isFinite(score))continue;if(competitor.homeAway==="home")t.h.score=score;else if(competitor.homeAway==="away")t.v.score=score;}
const finalResult=checkFinal||(kick<=now&&now-kick<=96*3600000&&summaryFinal);
if(checkXI){const xi=getLineups(summary,t.h.team?.id,t.v.team?.id,t.hn,t.vn);if(xi){const saveUnified=async(target)=>{const marker=mark("ALINEACIONES",e.id),body=["ALINEACIONES OFICIALES",`PARTIDO | ${t.hn} vs ${t.vn}`,xi.home,"",xi.away,"Fuente: ESPN"].join("\n\n"),full=[marker,body,"",FOOTER].join("\n");if(full.length>10000)throw new Error("Alineación completa supera 10.000 caracteres; no se publicará incompleta.");const kinds=["ALINEACIONES","ALINEACIONES_LOCAL","ALINEACIONES_VISITANTE"];const found=replies.filter(r=>r.post_id===target.id&&kinds.some(k=>(r.content||"").includes(mark(k,e.id))));if(found.length===1&&(found[0].content||"").includes(marker)&&(found[0].content||"").includes(xi.home)&&(found[0].content||"").includes(xi.away))return false;const primary=found.find(r=>r.id);if(primary){await json(`${SUPABASE_URL}/rest/v1/replies?id=eq.${primary.id}&user_id=eq.${userId}`,{method:"PATCH",headers:{...auth,Prefer:"return=minimal"},body:JSON.stringify({content:full})});primary.content=full;}else{await json(`${SUPABASE_URL}/rest/v1/replies`,{method:"POST",headers:{...auth,Prefer:"return=minimal"},body:JSON.stringify({post_id:target.id,user_id:userId,content:full})});replies.unshift({post_id:target.id,content:full});}for(const extra of found){if(extra!==primary&&extra.id){await json(`${SUPABASE_URL}/rest/v1/replies?id=eq.${extra.id}&user_id=eq.${userId}`,{method:"DELETE",headers:{...auth,Prefer:"return=minimal"}});replies.splice(replies.indexOf(extra),1);}}console.log("Alineación conjunta publicada:",e.id,"en",target.id);return true};if(await saveUnified(post))lineups++;}}if(finalResult&&!hasReply(post.id,"RESULTADO",e.id)){const score=[`MARCADOR | ${t.hn} | ${t.h.score??"—"} | ${t.v.score??"—"} | ${t.vn}`,`GOLEADORES | ${goals(summary).join(" · ")||"Detalle no disponible en la fuente"}`,`ESTADIO | ${t.c?.venue?.fullName||"No facilitado"}`,"El encuentro ha terminado. ¿Qué valoración hacéis del partido?"];if(await updateThread(post.id,"RESULTADO",e.id,["RESULTADO FINAL",...score].join("\n")))results++}
}
console.log(`Champions League: ${events.length} partidos revisados; ${previews} previas; ${lineups} alineaciones; ${results} resultados.`);
