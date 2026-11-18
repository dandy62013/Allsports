const SUPABASE_URL="https://tzmigdagymfauatjivcl.supabase.co";
const SUPABASE_KEY="sb_publishable_gZ8cx30ZlxlVjlb00vo1nw_LyDC0yGH";
const EMAIL=process.env.BOT_EMAIL, PASSWORD=process.env.BOT_PASSWORD;
const ZONE="Europe/Madrid", FOOTER="— ALLSPORTS Bot · Datos: ESPN";
const MEN=["uefa.nations","fifa.worldq.uefa","fifa.worldq.caf","fifa.worldq.afc","fifa.worldq.concacaf","fifa.worldq.conmebol","fifa.worldq.ofc","fifa.world","uefa.euro","uefa.euroq","fifa.friendly","conmebol.america","caf.nations","caf.nations_qual","concacaf.gold","concacaf.nations.league","afc.asian.cup"];
const WOMEN=["uefa.w.nations","fifa.wworldq.uefa","fifa.wwcq.ply","fifa.wwc","uefa.weuro","fifa.friendly.w","fifa.w.olympics","fifa.shebelieves","concacaf.w.gold","conmebol.america.femenina"];
const SPANISH_CLUBS=["athletic club","atletico de madrid","atletico madrid","barcelona","fc barcelona","real madrid","real sociedad","sevilla","sevilla fc","levante","levante ud","real betis","betis","deportivo alaves","alaves","tenerife","cd tenerife","granada","granada cf","valencia","valencia cf","espanyol","rcd espanyol","badalona","fc badalona women","madrid cff","eibar","sd eibar","osasuna","ca osasuna","villarreal","villarreal cf"];
const CONFIGS={
 "copa-del-rey":{key:"COPA_REY",title:"COPA DEL REY",subforum:"Copa del Rey",leagues:["esp.copa_del_rey"],filter:()=>true,description:"Copa del Rey"},
 "futbol-femenino":{key:"FEMENINO_CLUBES",title:"FÚTBOL FEMENINO",subforum:"Fútbol femenino",leagues:["esp.w.1","uefa.wchampions"],filter:(e)=>e.allsportsLeague==="esp.w.1"||hasSpanishClub(e),description:"fútbol femenino"},
 "seleccion-masculina":{key:"SELECCION_MASCULINA",title:"SELECCIÓN MASCULINA",subforum:"Selección masculina",leagues:MEN,filter:isSpainMatch,description:"selección española masculina"},
 "seleccion-femenina":{key:"SELECCION_FEMENINA",title:"SELECCIÓN FEMENINA",subforum:"Selección femenina",leagues:WOMEN,filter:isSpainMatch,description:"selección española femenina"},
 "selecciones-otros":{key:"SELECCIONES_OTROS",title:"SELECCIONES",subforum:"Selecciones",leagues:[...MEN,...WOMEN],filter:(e)=>!isSpainMatch(e),description:"selecciones nacionales de otros países"}
};
const config=CONFIGS[process.argv[2]];
if(!config)throw new Error("Indica una configuración válida: "+Object.keys(CONFIGS).join(", "));
if(!EMAIL||!PASSWORD)throw new Error("Faltan BOT_EMAIL y BOT_PASSWORD.");
const headers={apikey:SUPABASE_KEY,"Content-Type":"application/json"};
async function json(url,options={}){const r=await fetch(url,{...options,headers:{...headers,...(options.headers||{})}});if(!r.ok)throw new Error(`HTTP ${r.status} en ${url}: ${(await r.text()).slice(0,250)}`);const t=await r.text();if(!t.trim())return null;try{return JSON.parse(t)}catch{throw new Error("Respuesta JSON no válida de ESPN/Supabase.")}}
const session=await json(`${SUPABASE_URL}/auth/v1/token?grant_type=password`,{method:"POST",body:JSON.stringify({email:EMAIL,password:PASSWORD})});
const userId=session.user?.id;if(!session.access_token||!userId)throw new Error("No se pudo iniciar sesión con Informador.");
const auth={Authorization:`Bearer ${session.access_token}`};
await json(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}`,{method:"PATCH",headers:{...auth,Prefer:"return=minimal"},body:JSON.stringify({username:"Informador"})}).catch(e=>console.log("Aviso de perfil:",e.message));
const since=new Date(Date.now()-30*86400000).toISOString();
const [pRows,rRows]=await Promise.all([
 json(`${SUPABASE_URL}/rest/v1/posts?select=id,content,link_url,created_at,subforum&user_id=eq.${userId}&created_at=gte.${encodeURIComponent(since)}&order=created_at.desc&limit=1000`,{headers:auth}),
 json(`${SUPABASE_URL}/rest/v1/replies?select=id,post_id,content,created_at&user_id=eq.${userId}&created_at=gte.${encodeURIComponent(since)}&order=created_at.desc&limit=2000`,{headers:auth})
]);
const posts=Array.isArray(pRows)?pRows:[],replies=Array.isArray(rRows)?rRows:[];
const madridDate=d=>new Intl.DateTimeFormat("en-CA",{timeZone:ZONE,year:"numeric",month:"2-digit",day:"2-digit"}).format(d);
const madridTime=d=>d.toLocaleString("es-ES",{timeZone:ZONE,dateStyle:"full",timeStyle:"short"});
const kickoffLabel=d=>d.toLocaleString("es-ES",{timeZone:ZONE,day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).replace(",", " ·");

const LALIGA_BASE="https://apim.laliga.com/public-service/api/v1";
const LALIGA_PUBLIC_KEY="c13c3a8e2f6b46da9c5c425cf61fab3e";
const laligaRoundsCache=new Map();
function collectApiObjects(value,out=[]){if(!value||typeof value!=="object")return out;if(Array.isArray(value)){for(const x of value)collectApiObjects(x,out);return out;}out.push(value);for(const [k,v] of Object.entries(value)){if(v&&typeof v==="object"&&k!=="home_team"&&k!=="away_team"&&k!=="team")collectApiObjects(v,out);}return out;}
function officialRoundValue(value){if(value==null)return null;if(typeof value==="object"){for(const x of [value.week,value.number,value.round,value.matchday,value.name,value.title]){const n=officialRoundValue(x);if(n)return n;}return null;}const m=String(value).match(/(?:jornada|matchday|week|round|ronda|fecha)?\s*#?\s*(\d{1,2})/i);return m?Number(m[1]):null;}
function teamNames(value){if(!value)return[];if(typeof value==="string")return[value];return [value.nickname,value.display_name,value.displayName,value.short_name,value.shortName,value.name,value.team_name].filter(x=>typeof x==="string");}
function normTeam(value){return String(value||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();}
function seasonStartYear(){const d=new Date(),m=Number(new Intl.DateTimeFormat("en",{timeZone:"Europe/Madrid",month:"numeric"}).format(d));return d.getFullYear()-(m<7?1:0);}
async function officialMatchday(e,competitionSlug,kind){
 const cacheKey=competitionSlug+":"+seasonStartYear();
 if(!laligaRoundsCache.has(cacheKey))laligaRoundsCache.set(cacheKey,(async()=>{
  const apiHeaders={"Ocp-Apim-Subscription-Key":LALIGA_PUBLIC_KEY};
  const year=seasonStartYear();
  let subscriptions=[];
  for(let offset=0;offset<100;offset+=20){
   const page=await json(LALIGA_BASE+"/subscriptions?offset="+offset,{headers:apiHeaders}).catch(err=>{console.log("LaLiga suscripciones no disponibles:",err.message);return null;});
   if(!page)break;
   const rows=collectApiObjects(page).filter(x=>typeof x.slug==="string"&&x.slug.includes(String(year)));
   subscriptions.push(...rows);
   if(rows.length===0&&offset>0)break;
   if(Array.isArray(page)&&page.length<20)break;
   if(Array.isArray(page.data)&&page.data.length<20)break;
  }
  const hints=kind==="primera"?["easports","primera"]:kind==="segunda"?["hypermotion","segunda"]:["femenina","liga-f","women"];
  const sub=subscriptions.find(x=>JSON.stringify(x).toLowerCase().includes(competitionSlug)&&x.slug.includes(String(year)))||
    subscriptions.find(x=>hints.some(h=>x.slug.toLowerCase().includes(h)));
  if(!sub){console.log("LaLiga: no se encontró la suscripción de temporada",kind,year);return[];}
  const all=[];
  for(let offset=0;offset<1000;offset+=100){
   const page=await json(LALIGA_BASE+"/matches?subscription="+encodeURIComponent(sub.slug)+"&competition="+encodeURIComponent(competitionSlug)+"&limit=100&offset="+offset,{headers:apiHeaders}).catch(err=>{console.log("LaLiga partidos no disponibles:",kind,err.message);return null;});
   if(!page)break;
   const rows=collectApiObjects(page).filter(x=>x.gameweek!=null&&(x.home_team||x.homeTeam)&&(x.away_team||x.awayTeam));
   all.push(...rows);
   const arr=Array.isArray(page)?page:(page.data||page.matches||page.items||page.content||[]);
   if(!Array.isArray(arr)||arr.length<100)break;
  }
  console.log("LaLiga: jornadas cargadas",kind,all.length,"partidos");
  return all;
 })());
 const matches=await laligaRoundsCache.get(cacheKey);
 const c=e.competitions?.[0]||{},home=c.competitors?.find(x=>x.homeAway==="home"),away=c.competitors?.find(x=>x.homeAway==="away");
 const homeSet=new Set(teamNames(home?.team).map(normTeam)),awaySet=new Set(teamNames(away?.team).map(normTeam));
 const kickoff=new Date(e.date).getTime();
 let best=null,bestDiff=Infinity;
 for(const match of matches){
  const mh=match.home_team||match.homeTeam||match.home,ma=match.away_team||match.awayTeam||match.away;
  const hNames=teamNames(mh).map(normTeam),aNames=teamNames(ma).map(normTeam);
  const same=(xs,ys)=>xs.some(x=>ys.has(x)||[...ys].some(y=>x.length>4&&y.length>4&&(x.includes(y)||y.includes(x))));
  if(!same(hNames,homeSet)||!same(aNames,awaySet))continue;
  const dateValue=match.date||match.match_date||match.match_date_utc||match.matchDate||match.matchDateUtc||match.start_date||match.startDate||match.date_start||match.utc_date||match.utcDate||match.kickoff||match.scheduled_at||match.datetime||match.date_time||match.startTime;
  const parsedDate=dateValue?new Date(dateValue).getTime():NaN;
  const diff=Number.isFinite(parsedDate)?Math.abs(parsedDate-kickoff):Infinity;
  if(Number.isFinite(diff)&&diff<bestDiff){best=match;bestDiff=diff;}
  else if(!Number.isFinite(diff)&&!best){best=match;bestDiff=0;}
 }
 if(!best||bestDiff>72*3600000)return null;
 return officialRoundValue(best.gameweek);
}

function matchdayNumber(e){
 const c=e.competitions?.[0]||{},core=e.coreCompetition||{};
 const candidates=[e.officialMatchday,e.scoreboardWeek?.number,e.scoreboardWeek?.text,e.scoreboardWeek,e.week?.number,e.week?.text,e.week,c.week?.number,c.week?.text,c.week,c.series?.summary,core.week?.number,core.week?.text,core.week,core.roundNumber,core.round,core.matchday,e.season?.week?.number,...(Array.isArray(c.notes)?c.notes.map(n=>n?.headline||n?.text||n?.summary):[]),...(Array.isArray(core.notes)?core.notes.map(n=>n?.headline||n?.text||n?.summary):[])];
 for(const value of candidates){if(value==null)continue;const m=String(value).match(/(?:jornada|matchday|week|round|ronda|fecha)\s*#?\s*(\d+)|^(\d{1,2})$/i);if(m)return Number(m[1]||m[2]);}
 return null;
}
const dailyScoreboardCache=new Map(),coreCompetitionCache=new Map();
async function resolveMatchday(e){
 if(config.key!=="FEMENINO_CLUBES"||e.allsportsLeague!=="esp.w.1")return matchdayNumber(e);
 const official=await officialMatchday(e,"primera-division-femenina","femenina");if(official){e.officialMatchday=official;return official;}
 const date=madridDate(new Date(e.date)).replaceAll("-","");
 const key=e.allsportsLeague+":"+date;
 if(!dailyScoreboardCache.has(key))dailyScoreboardCache.set(key,json("https://site.api.espn.com/apis/site/v2/sports/soccer/"+e.allsportsLeague+"/scoreboard?dates="+date).catch(err=>{console.log("Jornada diaria femenina no disponible",date,err.message);return null}));
 const board=await dailyScoreboardCache.get(key),dailyEvent=board?.events?.find(x=>String(x.id)===String(e.id));
 if(dailyEvent?.week!=null)e.week=dailyEvent.week;
 if(dailyEvent?.competitions?.[0]?.week!=null)e.competitions[0].week=dailyEvent.competitions[0].week;
 e.scoreboardWeek=board?.week||e.scoreboardWeek||null;
 let n=matchdayNumber(e);if(n)return n;
 const cid=e.competitions?.[0]?.id||e.id,coreKey=e.allsportsLeague+":"+e.id+":"+cid;
 if(!coreCompetitionCache.has(coreKey))coreCompetitionCache.set(coreKey,json("https://sports.core.api.espn.com/v2/sports/soccer/leagues/"+e.allsportsLeague+"/events/"+e.id+"/competitions/"+cid+"?lang=es&region=es").catch(err=>{console.log("Jornada Core ESPN no disponible",e.id,err.message);return null}));
 e.coreCompetition=await coreCompetitionCache.get(coreKey);
 n=matchdayNumber(e);
 if(!n&&e.coreCompetition)console.log("ESPN no facilita jornada femenina:",e.id,Object.keys(e.coreCompetition).join(","));
 return n;
}

const now=Date.now(),from=new Date(now-30*86400000),to=new Date(now+45*86400000);
const monthKeys=new Set();for(let d=new Date(from);d<=to;d.setUTCDate(d.getUTCDate()+1))monthKeys.add(madridDate(d).replaceAll("-","").slice(0,6));
const calendars=await Promise.all(config.leagues.flatMap(league=>[...monthKeys].map(async month=>({league,data:await json(`https://site.api.espn.com/apis/site/v2/sports/soccer/${league}/scoreboard?dates=${month}`).catch(e=>{console.log("Calendario no disponible",league,month,e.message);return null})}))));
// Copa: ESPN puede mantener partidos aplazados en el calendario mensual con su fecha original.
// Reconsultamos también los días concretos recientes para recuperar reprogramaciones y resultados.
const dailyBoards=config.key==="COPA_REY"?await Promise.all(Array.from({length:5},(_,i)=>{const d=new Date(now-i*86400000);const day=madridDate(d).replaceAll("-","");return json(`https://site.api.espn.com/apis/site/v2/sports/soccer/esp.copa_del_rey/scoreboard?dates=${day}`).then(data=>({league:"esp.copa_del_rey",data,day})).catch(err=>{console.log("Calendario diario de Copa no disponible",day,err.message);return null})})):[];
const allEvents=new Map();for(const item of [...calendars,...dailyBoards.filter(Boolean)])for(const e of (Array.isArray(item.data?.events)?item.data.events:[]))allEvents.set(String(e.id),{...e,allsportsLeague:item.league,scoreboardWeek:item.data?.week||null});
const events=[...allEvents.values()].filter(e=>{const d=new Date(e.date).getTime();return Number.isFinite(d)&&d>=from.getTime()&&d<=to.getTime()&&config.filter(e)});
function competitors(e){return e.competitions?.[0]?.competitors||[]}
function norm(s){return String(s||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().trim()}
function isSpainMatch(e){return competitors(e).some(x=>String(x.team?.abbreviation||"").toUpperCase()==="ESP"||/^(spain|españa)$/i.test(x.team?.displayName||x.team?.name||""))}
function hasSpanishClub(e){return competitors(e).some(x=>{const n=norm(x.team?.displayName||x.team?.name||x.team?.shortDisplayName);return SPANISH_CLUBS.includes(n)||SPANISH_CLUBS.some(v=>n.startsWith(v+" "))})}
function teams(e){const a=competitors(e),h=a.find(x=>x.homeAway==="home")||a[0],v=a.find(x=>x.homeAway==="away")||a[1];if(!h||!v)return null;return{c:e.competitions?.[0],h,v,hn:h.team?.displayName||h.team?.name||"Local",vn:v.team?.displayName||v.team?.name||"Visitante"}}
const mark=(kind,id)=>`[[AS-${config.key}:${kind}:${id}]]`;
function findPost(e){return posts.find(p=>p.subforum===config.subforum&&((p.content||"").includes(mark("PREVIA",e.id))||(p.link_url||"").includes(`gameId=${e.id}`)))}
async function ensureMatchdayTitle(post,e,t){const n=matchdayNumber(e);if(!post||!n)return;const first=(post.content||"").split("\n")[0]||"";const label=`Jornada ${n}`;if(first.includes(label))return;const title=`⚽ ${config.title} | ${t.hn} vs ${t.vn} | ${label} | ${kickoffLabel(new Date(e.date))}`;const content=title+"\n"+(post.content||"").split("\n").slice(1).join("\n");await json(`${SUPABASE_URL}/rest/v1/posts?id=eq.${post.id}&user_id=eq.${userId}`,{method:"PATCH",headers:{...auth,Prefer:"return=minimal"},body:JSON.stringify({content})});post.content=content;console.log("Título actualizado:",title)}
function hasReply(postId,kind,id){return replies.some(r=>r.post_id===postId&&(r.content||"").includes(mark(kind,id)))}
async function createPreview(e,t){const kick=new Date(e.date),venue=t.c?.venue?.fullName||"Estadio por confirmar",competition=e.league?.name||e.season?.name||config.description;
const n=matchdayNumber(e),jornada=n?` | Jornada ${n}`:"";const title=`⚽ ${config.title} | ${t.hn} vs ${t.vn}${jornada} | ${kickoffLabel(kick)}`;
const body=[mark("PREVIA",e.id),"PREVIA DEL PARTIDO",...(n?[`JORNADA | ${n}`]:[]),`ENCUENTRO | ${t.hn} vs ${t.vn}`,`FECHA Y HORA | ${madridTime(kick)} (hora peninsular)`,`ESTADIO | ${venue}`,`COMPETICIÓN | ${competition}`,"",`Abrimos este hilo para seguir ${config.description}: comentar cómo llegan ambos equipos, compartir pronósticos y debatir el encuentro.`,"¿Cuál es vuestro pronóstico? ¡Os leemos!","",FOOTER].join("\n");
const result=await json(`${SUPABASE_URL}/rest/v1/posts`,{method:"POST",headers:{...auth,Prefer:"return=representation"},body:JSON.stringify({user_id:userId,sport:"Fútbol",subforum:config.subforum,content:title+"\n"+body,link_url:`https://www.espn.com/soccer/match/_/gameId/${e.id}`})});
const row=Array.isArray(result)?result[0]:result;if(row?.id){posts.unshift(row);console.log("Previa creada:",title)}return row?.id||null}
async function updateThread(postId,kind,id,content){if(!postId||hasReply(postId,kind,id))return false;const marker=mark(kind,id),suffix="\n\n"+FOOTER,max=10000-marker.length-suffix.length-1;let safe=String(content);if(safe.length>max)safe=safe.slice(0,max-1).trimEnd()+"…";await json(`${SUPABASE_URL}/rest/v1/replies`,{method:"POST",headers:{...auth,Prefer:"return=minimal"},body:JSON.stringify({post_id:postId,user_id:userId,content:[marker,safe,"",FOOTER].join("\n")})});replies.unshift({post_id:postId,content:marker+safe});console.log("Actualización:",kind,id);return true}
function sideRoster(side){if(!side)return null;const list=Array.isArray(side)?side:side.roster||side.players||side.athletes||side.entries||[];const players=list.map(x=>{const a=x.athlete||x.player||x,name=a.displayName||a.fullName||a.name||a.shortName;if(!name)return null;const pos=a.position||x.position||{};return{name,starter:x.starter===true||x.isStarter===true||x.type?.name==="starter",number:a.jersey||a.jerseyNumber||x.jersey||"",position:typeof pos==="string"?pos:pos.displayName||pos.name||pos.abbreviation||pos.shortDisplayName||""}}).filter(Boolean);return{players,formation:typeof side.formation==="string"?side.formation:side.formation?.displayName||side.formation?.name||""}}
function positionGroup(p){const v=String(p.position||"").toLowerCase();if(/goalkeeper|keeper|portero|\bgk\b/.test(v))return"PORTEROS";if(/defen|\b(def|df|d)\b/.test(v))return"DEFENSAS";if(/midfield|centrocamp|mediocamp|\b(mid|mf|m)\b/.test(v))return"CENTROCAMPISTAS";if(/forward|striker|delanter|attacker|\b(fwd|fw|f)\b/.test(v))return"DELANTEROS";return"OTROS"}
function rosterLines(players){return["PORTEROS","DEFENSAS","CENTROCAMPISTAS","DELANTEROS","OTROS"].map(g=>{const a=players.filter(p=>positionGroup(p)===g).map(p=>(p.number?p.number+". ":"")+p.name);return a.length?g+" | "+a.join(" · "):null}).filter(Boolean).join("\n")}
function getLineups(s,hid,vid,hn,vn){const root=s.rosters||s.lineups;if(!root)return null;let hr,vr;if(Array.isArray(root)){for(const x of root){const id=String(x.team?.id||x.teamId||x.id||"");if(id===String(hid))hr=x;if(id===String(vid))vr=x}}else{hr=root.home||root.Home||root.homeTeam;vr=root.away||root.Away||root.awayTeam;if(!hr||!vr)for(const x of Object.values(root)){if(!x||typeof x!=="object")continue;const id=String(x.team?.id||x.teamId||x.id||"");if(id===String(hid))hr=x;if(id===String(vid))vr=x}}const h=sideRoster(hr),v=sideRoster(vr);if(!h||!v||h.players.filter(x=>x.starter).length<10||v.players.filter(x=>x.starter).length<10)return null;const format=(name,x)=>[`EQUIPO | ${name}`,`SISTEMA | ${x.formation||"No facilitado"}`,"","TITULARES",rosterLines(x.players.filter(p=>p.starter))||"No facilitados","","SUPLENTES",rosterLines(x.players.filter(p=>!p.starter))||"No facilitados"].join("\n");return{home:format(hn,h),away:format(vn,v)}}
function goals(s){const a=s.keyEvents||s.scoringPlays||[];return[...new Set(a.map(x=>x.text||x.shortText||x.description||"").filter(x=>/gol|goal|penalt/i.test(x)).map(x=>x.replace(/\s+/g," ").trim()))].slice(0,10)}
let previews=0,lineups=0,results=0,removedPrematureResults=0;
for(const e of events){const t=teams(e);if(!t)continue;const kick=new Date(e.date).getTime();if(!Number.isFinite(kick))continue;await resolveMatchday(e);const matchDay=madridDate(new Date(kick)),today=madridDate(new Date(now));const dueTomorrow=matchDay===madridDate(new Date(now+86400000))&&kick>now,dueSoon=matchDay===today&&kick>=now-2*3600000&&kick-now<=24*3600000;let post=findPost(e);if(kick>now&&kick-now<=45*86400000&&!post){const id=await createPreview(e,t);if(id){previews++;post=posts.find(p=>p.id===id)}}if(post)await ensureMatchdayTitle(post,e,t);
if(post&&kick>now){const premature=replies.filter(r=>r.post_id===post.id&&(r.content||"").includes(mark("RESULTADO",e.id)));for(const r of premature){if(r.id){await json(`${SUPABASE_URL}/rest/v1/replies?id=eq.${r.id}&user_id=eq.${userId}`,{method:"DELETE",headers:{...auth,Prefer:"return=minimal"}});removedPrematureResults++;console.log("Resultado prematuro eliminado:",e.id);} }}
const checkXI=kick-now<=60*60000&&kick-now>=-8*3600000;const checkRecentResult=kick<=now&&now-kick<=96*3600000;if(!checkXI&&!checkRecentResult)continue;
const summary=await json(`https://site.api.espn.com/apis/site/v2/sports/soccer/${e.allsportsLeague}/summary?event=${e.id}`).catch(err=>{console.log("Resumen no disponible",e.id,err.message);return null});if(!summary)continue;
const summaryComp=summary.header?.competitions?.[0],summaryStatus=summaryComp?.status?.type,summaryStatusText=String(summaryStatus?.name||summaryStatus?.description||summaryStatus?.shortDetail||"").toLowerCase();
const summaryFinal=(summaryStatus?.state==="post"||/final|full time|finished|ended/.test(summaryStatusText))&&!/cancel|postpon|abandon|suspend/.test(summaryStatusText);
for(const competitor of summaryComp?.competitors||[]){if(competitor.score==null||String(competitor.score).trim()==="")continue;const score=Number(competitor.score);if(!Number.isFinite(score))continue;if(competitor.homeAway==="home")t.h.score=score;else if(competitor.homeAway==="away")t.v.score=score;}
const finalResult=checkRecentResult&&summaryFinal;if(finalResult&&!post){const id=await createPreview(e,t);if(id){previews++;post=posts.find(p=>p.id===id);if(post)await ensureMatchdayTitle(post,e,t)}}
if(checkXI&&post){const xi=getLineups(summary,t.h.team?.id,t.v.team?.id,t.hn,t.vn);if(xi){const saveUnified=async(target)=>{const marker=mark("ALINEACIONES",e.id),body=["ALINEACIONES OFICIALES",`PARTIDO | ${t.hn} vs ${t.vn}`,xi.home,"",xi.away,"Fuente: ESPN"].join("\n\n"),full=[marker,body,"",FOOTER].join("\n");if(full.length>10000)throw new Error("Alineación completa supera 10.000 caracteres; no se publicará incompleta.");const kinds=["ALINEACIONES","ALINEACIONES_LOCAL","ALINEACIONES_VISITANTE"];const found=replies.filter(r=>r.post_id===target.id&&kinds.some(k=>(r.content||"").includes(mark(k,e.id))));if(found.length===1&&(found[0].content||"").includes(marker)&&(found[0].content||"").includes(xi.home)&&(found[0].content||"").includes(xi.away))return false;const primary=found.find(r=>r.id);if(primary){await json(`${SUPABASE_URL}/rest/v1/replies?id=eq.${primary.id}&user_id=eq.${userId}`,{method:"PATCH",headers:{...auth,Prefer:"return=minimal"},body:JSON.stringify({content:full})});primary.content=full;}else{await json(`${SUPABASE_URL}/rest/v1/replies`,{method:"POST",headers:{...auth,Prefer:"return=minimal"},body:JSON.stringify({post_id:target.id,user_id:userId,content:full})});replies.unshift({post_id:target.id,content:full});}for(const extra of found){if(extra!==primary&&extra.id){await json(`${SUPABASE_URL}/rest/v1/replies?id=eq.${extra.id}&user_id=eq.${userId}`,{method:"DELETE",headers:{...auth,Prefer:"return=minimal"}});replies.splice(replies.indexOf(extra),1);}}console.log("Alineación conjunta publicada:",e.id,"en",target.id);return true};if(await saveUnified(post))lineups++;}}if(finalResult&&post&&!hasReply(post.id,"RESULTADO",e.id)){const score=[`MARCADOR | ${t.hn} | ${t.h.score??"—"} | ${t.v.score??"—"} | ${t.vn}`,`GOLEADORES | ${goals(summary).join(" · ")||"Detalle no disponible en la fuente"}`,`ESTADIO | ${t.c?.venue?.fullName||"No facilitado"}`,"El encuentro ha terminado. ¿Qué valoración hacéis del partido?"];if(await updateThread(post.id,"RESULTADO",e.id,["RESULTADO FINAL",...score].join("\n")))results++}
}
console.log(`${config.title}: ${events.length} partidos revisados; ${previews} previas; ${lineups} alineaciones; ${results} resultados; ${removedPrematureResults} resultados prematuros eliminados.`);