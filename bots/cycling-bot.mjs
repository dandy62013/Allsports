const SUPABASE_URL="https://tzmigdagymfauatjivcl.supabase.co";
const SUPABASE_KEY="sb_publishable_gZ8cx30ZlxlVjlb00vo1nw_LyDC0yGH";
const EMAIL=process.env.BOT_EMAIL,PASSWORD=process.env.BOT_PASSWORD;
const ZONE="Europe/Madrid",FOOTER="— ALLSPORTS · Informador · Fuente oficial";
if(!EMAIL||!PASSWORD)throw new Error("Faltan BOT_EMAIL y BOT_PASSWORD.");
const HEADERS={apikey:SUPABASE_KEY,"Content-Type":"application/json"};
async function request(url,options={}){const r=await fetch(url,{...options,headers:{...HEADERS,...(options.headers||{})}});if(!r.ok)throw new Error("HTTP "+r.status+" en "+url+": "+(await r.text()).slice(0,220));const t=await r.text();return t.trim()?JSON.parse(t):null}
async function html(url){const r=await fetch(url,{headers:{"User-Agent":"Mozilla/5.0 (compatible; ALLSPORTS/1.0)","Accept":"text/html,application/xhtml+xml"}});if(!r.ok)throw new Error("HTTP "+r.status+" en "+url);return r.text()}
const session=await request(SUPABASE_URL+"/auth/v1/token?grant_type=password",{method:"POST",body:JSON.stringify({email:EMAIL,password:PASSWORD})});
const userId=session.user?.id;if(!session.access_token||!userId)throw new Error("No se pudo iniciar sesión con Informador.");
const auth={Authorization:"Bearer "+session.access_token};
await request(SUPABASE_URL+"/rest/v1/profiles?id=eq."+userId,{method:"PATCH",headers:{...auth,Prefer:"return=minimal"},body:JSON.stringify({username:"Informador"})}).catch(()=>{});
const since=new Date(Date.now()-400*86400000).toISOString();
const [pRows,rRows]=await Promise.all([
 request(SUPABASE_URL+"/rest/v1/posts?select=id,content,subforum,created_at&user_id=eq."+userId+"&created_at=gte."+encodeURIComponent(since)+"&order=created_at.desc&limit=1000",{headers:auth}),
 request(SUPABASE_URL+"/rest/v1/replies?select=id,post_id,content,created_at&user_id=eq."+userId+"&created_at=gte."+encodeURIComponent(since)+"&order=created_at.desc&limit=5000",{headers:auth})
]);
const posts=Array.isArray(pRows)?pRows:[],replies=Array.isArray(rRows)?rRows:[];
const now=new Date(),today=localDate(now);
function localDate(d){return new Intl.DateTimeFormat("en-CA",{timeZone:ZONE,year:"numeric",month:"2-digit",day:"2-digit"}).format(d)}
function addDays(iso,n){const d=new Date(iso+"T12:00:00Z");d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10)}
function fmtDate(iso){return new Date(iso+"T12:00:00").toLocaleDateString("es-ES",{timeZone:ZONE,day:"2-digit",month:"2-digit",year:"numeric"})}
const GIRO_DATES=["2027-05-08","2027-05-09","2027-05-10","2027-05-11","2027-05-12","2027-05-13","2027-05-14","2027-05-15","2027-05-16","2027-05-18","2027-05-19","2027-05-20","2027-05-21","2027-05-22","2027-05-23","2027-05-25","2027-05-26","2027-05-27","2027-05-28","2027-05-29","2027-05-30"];
const TOUR_DATES=["2027-07-02","2027-07-03","2027-07-04","2027-07-06","2027-07-07","2027-07-08","2027-07-09","2027-07-10","2027-07-11","2027-07-13","2027-07-14","2027-07-15","2027-07-16","2027-07-17","2027-07-18","2027-07-20","2027-07-21","2027-07-22","2027-07-23","2027-07-24","2027-07-25"];
const VUELTA_DATES=[];
const RACES=[
 {key:"GIRO2027",name:"Giro de Italia",subforum:"Giro de Italia",start:"2027-05-08",end:"2027-05-30",dates:GIRO_DATES,site:"https://www.giroditalia.it",route:"https://www.giroditalia.it/en/the-route/",gc:"https://www.giroditalia.it/en/classifiche/",stage:n=>"https://www.giroditalia.it/en/classifiche/di-tappa/"+n+"/",kind:"giro"},
 {key:"TOUR2027",name:"Tour de Francia",subforum:"Tour de Francia",start:"2027-07-02",end:"2027-07-25",dates:TOUR_DATES,site:"https://www.letour.fr/es",route:"https://www.letour.fr/en/overall-route",gc:"https://www.letour.fr/en/rankings",stage:n=>"https://www.letour.fr/en/rankings/stage-"+n,kind:"aso"},
 {key:"VUELTA2027",name:"La Vuelta",subforum:"Vuelta a España",start:"2027-09-04",end:"2027-09-26",dates:VUELTA_DATES,site:"https://www.lavuelta.es/es",route:"https://www.lavuelta.es/en/overall-route",gc:"https://www.lavuelta.es/en/rankings",stage:n=>"https://www.lavuelta.es/en/rankings/stage-"+n,kind:"aso"}
];
function markerThread(r){return "[[ASCICLISMO:"+r.key+":HILO]]"}
function markerReply(r,type,stage){return "[[ASCICLISMO:"+r.key+":"+type+":"+stage+"]]"}
function findThread(r){return posts.find(p=>p.subforum===r.subforum&&(p.content||"").includes(markerThread(r)))}
function hasReply(postId,marker){return replies.some(x=>x.post_id===postId&&(x.content||"").includes(marker))}
async function createThread(r){
 const content=["🚴 "+r.name+" 2027 · SEGUIMIENTO OFICIAL",markerThread(r),"FECHAS | "+fmtDate(r.start)+" – "+fmtDate(r.end),"","En este hilo seguiremos la carrera día a día. El Informador añadirá, cuando las clasificaciones oficiales estén confirmadas, los 10 primeros de cada etapa y los 10 primeros de la clasificación general, con sus diferencias de tiempo.","","FUENTE OFICIAL | "+r.site,"",FOOTER].join("\n");
 const title="🚴 "+r.name+" | "+fmtDate(r.start)+" · horario por confirmar";
 const result=await request(SUPABASE_URL+"/rest/v1/posts",{method:"POST",headers:{...auth,Prefer:"return=representation"},body:JSON.stringify({user_id:userId,sport:"Ciclismo",subforum:r.subforum,content:title+"\n"+content,link_url:r.site})});
 const row=Array.isArray(result)?result[0]:result;if(row?.id){posts.unshift(row);console.log("Hilo creado:",r.name)}return row?.id||null;
}
function decode(s){return String(s||"").replace(/<br\s*\/?\s*>/gi," ").replace(/<[^>]*>/g," ").replace(/&nbsp;|&#160;/gi," ").replace(/&amp;/gi,"&").replace(/&quot;/gi,'"').replace(/&#39;|&apos;/gi,"'").replace(/&lt;/gi,"<").replace(/&gt;/gi,">").replace(/\s+/g," ").trim()}
function parseHtmlRows(source){
 const out=[];
 const trRe=/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi;let m;
 while((m=trRe.exec(source))){
  const cells=[...m[1].matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map(x=>decode(x[1]));
  if(cells.length<5)continue;
  const rank=Number((cells[0].match(/^\s*(\d{1,3})\b/)||[])[1]);if(!rank)continue;
  const timeIndex=cells.findIndex((x,i)=>i>1&&/\d{1,2}[:h]\d{2}/.test(x));if(timeIndex<0)continue;
  const nameCells=cells.slice(1,timeIndex).filter(x=>x&&!/^\d{1,3}$/.test(x));
  const rider=nameCells[0]||"",team=nameCells.length>1?nameCells[nameCells.length-1]:"";
  const time=cells[timeIndex]||"";
  let gap=cells[timeIndex+1]||"";
  if(timeIndex+2<cells.length&&/^(?:\+?\s*)?\d{1,2}:\d{2}(?::\d{2})?$/.test(gap))gap=cells[timeIndex+2];
  out.push({rank,rider,team,time,gap});
 }
 return out.filter(x=>x.rider&&x.time).sort((a,b)=>a.rank-b.rank).slice(0,10);
}
function deepRows(data){
 const found=[],seen=new Set();
 const riderName=o=>{const v=o.rider||o.competitor||o.participant||o.athlete||{};return o.riderName||o.name||o.fullName||o.competitorName||v.name||[v.firstName,v.lastName].filter(Boolean).join(" ")||[o.firstName,o.lastName].filter(Boolean).join(" ")};
 const visit=x=>{if(!x||typeof x!=="object"||seen.has(x))return;seen.add(x);
  if(Array.isArray(x)){x.forEach(visit);return}
  const rank=Number(x.rank??x.position??x.place??x.order??x.rankNumber);
  const name=riderName(x),time=x.time??x.totalTime??x.elapsedTime??x.resultTime??x.finishTime;
  if(rank>=1&&rank<=300&&name&&time){
   const gap=x.gap??x.timeGap??x.difference??x.timeBehind??x.gapToLeader??x.gapToWinner??"";
   const teamObj=x.team||x.teamName||x.squad||"";
   found.push({rank,rider:String(name),team:typeof teamObj==="string"?teamObj:(teamObj.name||""),time:String(time),gap:String(gap)});
  }
  Object.values(x).forEach(visit);
 };
 visit(data);return [...new Map(found.map(x=>[x.rank,x])).values()].sort((a,b)=>a.rank-b.rank).slice(0,10);
}
async function getRows(url,apiUrl){
 if(apiUrl){try{const j=await request(apiUrl,{headers:{Accept:"application/json","User-Agent":"Mozilla/5.0"}});const rows=deepRows(j);if(rows.length>=10)return rows;console.log("API sin 10 filas; pruebo página oficial",apiUrl)}catch(e){console.log("API no disponible; pruebo página oficial:",e.message.slice(0,130))}}
 const source=await html(url);const rows=parseHtmlRows(source);if(rows.length>=10)return rows;
 console.log("No se han podido extraer 10 filas de la clasificación:",url,"filas:",rows.length);return [];
}
function clean(v,max=36){return String(v||"").replace(/[|\n\r]/g," ").replace(/\s+/g," ").trim().slice(0,max)}
function formatReply(r,type,stage,rows,stageDate){
 const label=type==="ETAPA"?"ETAPA "+stage+" · "+fmtDate(stageDate):"GENERAL · tras etapa "+stage;
 const lines=[markerReply(r,type,stage),"CICLISMO | "+r.name+" 2027 | "+label,"POS|CICLISTA|TIEMPO|DIFERENCIA"];
 rows.slice(0,10).forEach((x,i)=>lines.push([x.rank,clean(x.rider,34),clean(x.time,18),clean(i===0?"—":x.gap||"—",18)].join("|")));
 lines.push("FUENTE | "+r.site,FOOTER);
 return lines.join("\n");
}
async function addReply(r,postId,type,stage,rows,stageDate){
 const mark=markerReply(r,type,stage);if(hasReply(postId,mark))return false;
 const content=formatReply(r,type,stage,rows,stageDate);
 if(content.length>10000){console.log("Aviso: respuesta de ciclismo supera el límite de 10000 caracteres; se omite:",r.name,type,stage);return false}
 await request(SUPABASE_URL+"/rest/v1/replies",{method:"POST",headers:{...auth,Prefer:"return=minimal"},body:JSON.stringify({post_id:postId,user_id:userId,content})});
 replies.unshift({post_id:postId,content});console.log("Clasificación publicada:",r.name,type,"etapa",stage);return true;
}
async function resolveRouteDates(r){
 try{
  const source=await html(r.route),rows=[];
  const trRe=/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi;let m;
  while((m=trRe.exec(source))){
   const cells=[...m[1].matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map(x=>decode(x[1]));
   const stage=Number((cells[0]||"").match(/^\s*(\d{1,2})\b/)?.[1]);
   const dateText=cells.find(x=>/\d{2}\/\d{2}\/2027/.test(x))||"";
   const date=(dateText.match(/(\d{2})\/(\d{2})\/(2027)/)||[]);
   if(stage>=1&&stage<=21&&date.length){rows.push({stage,date:date[3]+"-"+date[1]+"-"+date[2]})}
  }
  if(rows.length>=21){r.dates=rows.sort((a,b)=>a.stage-b.stage).map(x=>x.date);console.log(r.name+": calendario oficial de 2027 cargado.")}
  else if(!r.dates.length)console.log(r.name+": el recorrido detallado de 2027 aún no está publicado; espero al calendario oficial.");
 }catch(e){if(!r.dates.length)console.log(r.name+": calendario oficial pendiente ("+e.message.slice(0,90)+").")}
}
function currentStage(r){const index=r.dates.indexOf(today);return index>=0?index+1:0}
async function runRace(r){
 const startTime=new Date(r.start+"T00:00:00+01:00").getTime(),endTime=new Date(r.end+"T23:59:59+02:00").getTime();
 let post=findThread(r);
 if(!post&&now.getTime()>=startTime-7*86400000&&now.getTime()<=endTime){const id=await createThread(r);if(id)post=posts.find(p=>p.id===id)}
 if(!post){console.log(r.name+": aún no toca abrir el hilo.");return}
 await resolveRouteDates(r);
 const stage=currentStage(r);if(!stage){console.log(r.name+": hoy no hay etapa programada.");return}
 const nowMadrid=new Date(now.toLocaleString("en-US",{timeZone:ZONE}));
 if(nowMadrid.getHours()<20){console.log(r.name+": esperando al cierre de la etapa para publicar resultados definitivos.");return}
 const apiBase=r.kind==="aso"?(r.site.includes("letour")?"https://www.letour.fr":"https://www.lavuelta.es")+"/api/":"";
 const stageApi=apiBase?apiBase+"rankingTypeArrival-2027-"+stage:null;
 const stageUrl=r.stage(stage);
 const gcApi=apiBase?apiBase+"rankingType-2027-"+stage:null;
 const [stageRows,gcRows]=await Promise.all([
  getRows(stageUrl,stageApi),
  getRows(r.gc,gcApi)
 ]);
 if(stageRows.length>=10)await addReply(r,post.id,"ETAPA",stage,stageRows,r.dates[stage-1]);
 else console.log(r.name+": resultado de etapa aún no confirmado.");
 if(gcRows.length>=10)await addReply(r,post.id,"GENERAL",stage,gcRows,r.dates[stage-1]);
 else console.log(r.name+": general aún no confirmada.");
}
for(const race of RACES){try{await runRace(race)}catch(e){console.log("Error en "+race.name+":",e.message)}}
console.log("Ciclismo: revisión terminada.");
