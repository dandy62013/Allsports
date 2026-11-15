const SUPABASE_URL="https://tzmigdagymfauatjivcl.supabase.co";
const SUPABASE_KEY="sb_publishable_gZ8cx30ZlxlVjlb00vo1nw_LyDC0yGH";
const EMAIL=process.env.BOT_EMAIL,PASSWORD=process.env.BOT_PASSWORD;
const ZONE="Europe/Madrid",FOOTER="— ALLSPORTS Bot · Datos: ESPN/MotoGP";
const MODE=process.argv[2];
const CONFIG={f1:{name:"FÓRMULA 1",subforum:"Fórmula 1",kind:"f1"},motogp:{name:"MOTOGP",subforum:"MotoGP",kind:"moto",category:"MotoGP"},moto2:{name:"MOTO2",subforum:"Moto2",kind:"moto",category:"Moto2"},moto3:{name:"MOTO3",subforum:"Moto3",kind:"moto",category:"Moto3"}}[MODE];
if(!CONFIG)throw new Error("Indica f1, motogp, moto2 o moto3.");
if(!EMAIL||!PASSWORD)throw new Error("Faltan BOT_EMAIL y BOT_PASSWORD.");
const headers={apikey:SUPABASE_KEY,"Content-Type":"application/json"};
async function json(url,options={}){const r=await fetch(url,{...options,headers:{...headers,...(options.headers||{})}});if(!r.ok)throw new Error("HTTP "+r.status+" en "+url+": "+(await r.text()).slice(0,220));const t=await r.text();if(!t.trim())return null;return JSON.parse(t)}
const session=await json(SUPABASE_URL+"/auth/v1/token?grant_type=password",{method:"POST",body:JSON.stringify({email:EMAIL,password:PASSWORD})});
const userId=session.user?.id;if(!session.access_token||!userId)throw new Error("No se pudo iniciar sesión con Informador.");
const auth={Authorization:"Bearer "+session.access_token};
await json(SUPABASE_URL+"/rest/v1/profiles?id=eq."+userId,{method:"PATCH",headers:{...auth,Prefer:"return=minimal"},body:JSON.stringify({username:"Informador"})}).catch(()=>{});
const since=new Date(Date.now()-180*86400000).toISOString();
const [pRows,rRows]=await Promise.all([
 json(SUPABASE_URL+"/rest/v1/posts?select=id,content,link_url,created_at,subforum&user_id=eq."+userId+"&created_at=gte."+encodeURIComponent(since)+"&order=created_at.desc&limit=1000",{headers:auth}),
 json(SUPABASE_URL+"/rest/v1/replies?select=id,post_id,content,created_at&user_id=eq."+userId+"&created_at=gte."+encodeURIComponent(since)+"&order=created_at.desc&limit=3000",{headers:auth})
]);
const posts=Array.isArray(pRows)?pRows:[],replies=Array.isArray(rRows)?rRows:[];
const now=Date.now(),from=new Date(now-3*86400000),to=new Date(now+190*86400000);
const madridDate=d=>new Intl.DateTimeFormat("en-CA",{timeZone:ZONE,year:"numeric",month:"2-digit",day:"2-digit"}).format(d);
const madridTime=d=>new Date(d).toLocaleString("es-ES",{timeZone:ZONE,dateStyle:"full",timeStyle:"short"});
const kickoffLabel=d=>new Date(d).toLocaleString("es-ES",{timeZone:ZONE,day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).replace(",", " ·");
const marker=(kind,id)=>"[[ASMOTOR:"+MODE.toUpperCase()+":"+kind+":"+id+"]]";
function findPost(id){return posts.find(p=>p.subforum===CONFIG.subforum&&(p.content||"").includes(marker("PREVIA",id)))}
function hasReply(postId,kind,id){return replies.some(r=>r.post_id===postId&&(r.content||"").includes(marker(kind,id)))}
async function createThread(id,title,venue,country,start,end,sessions,sourceUrl){
 const body=[marker("PREVIA",id),"PREVIA DEL GRAN PREMIO","GRAN PREMIO | "+title,"LUGAR | "+venue+(country?" · "+country:""),"FECHAS | "+madridTime(start)+" — "+madridTime(end),"","HORARIOS DE SESIONES",sessions||"Los horarios oficiales se incorporarán cuando estén disponibles.","Abrimos este hilo para seguir todo el Gran Premio. Aquí iremos añadiendo la parrilla, el resultado final y la clasificación del campeonato.","¡Os leemos!","",FOOTER].join("\n");
 const res=await json(SUPABASE_URL+"/rest/v1/posts",{method:"POST",headers:{...auth,Prefer:"return=representation"},body:JSON.stringify({user_id:userId,sport:"Motor",subforum:CONFIG.subforum,content:"🏁 "+CONFIG.name+" | "+title+" | "+kickoffLabel(start)+"\n"+body,link_url:sourceUrl||null})});
 const row=Array.isArray(res)?res[0]:res;if(row?.id){posts.unshift(row);console.log("Hilo creado:",title)}return row?.id||null;
}
async function addReply(postId,kind,id,title,lines){
 if(!postId||hasReply(postId,kind,id))return false;
 const content=[marker(kind,id),title,...lines,"",FOOTER].join("\n");
 if(content.length>1000){console.log("Aviso: "+kind+" supera 1000 caracteres; se omite sin recortar.");return false}
 await json(SUPABASE_URL+"/rest/v1/replies",{method:"POST",headers:{...auth,Prefer:"return=minimal"},body:JSON.stringify({post_id:postId,user_id:userId,content})});
 replies.unshift({post_id:postId,content});console.log("Respuesta publicada:",kind,id);return true;
}
function dateWithin(d){const t=new Date(d).getTime();return Number.isFinite(t)&&t>=from.getTime()&&t<=to.getTime()}
function fmtRows(rows,mapper){return rows.map(mapper).filter(Boolean)}
async function runMoto(){
 const base="https://api.motogp.pulselive.com/motogp/v1";
 const h={"Accept":"application/json","Origin":"https://www.motogp.com","Referer":"https://www.motogp.com/","User-Agent":"Mozilla/5.0 ALLSPORTS bot"};
 const seasons=await json(base+"/results/seasons",{headers:h});
 const season=(Array.isArray(seasons)?seasons:[]).find(x=>x.current)||(Array.isArray(seasons)?seasons[0]:null);
 if(!season?.id)throw new Error("La API de MotoGP no ha devuelto la temporada actual.");
 const pair=await Promise.all([json(base+"/results/events?seasonUuid="+encodeURIComponent(season.id),{headers:h}),json(base+"/results/categories?seasonUuid="+encodeURIComponent(season.id),{headers:h})]);
 const events=Array.isArray(pair[0])?pair[0]:[],categories=Array.isArray(pair[1])?pair[1]:[];
 const category=categories.find(x=>String(x.name||"").toLowerCase().includes(CONFIG.category.toLowerCase()));
 if(!category?.id)throw new Error("No se encontró la categoría "+CONFIG.category+".");
 let created=0,grids=0,results=0,standings=0;
 for(const ev of events){
  const eventId=ev.id||ev.uuid||ev.event_uuid||ev.toad_api_uuid;if(!eventId)continue;
  const ss=await json(base+"/results/sessions?eventUuid="+encodeURIComponent(eventId)+"&categoryUuid="+encodeURIComponent(category.id),{headers:h}).catch(e=>{console.log("Sesiones no disponibles:",e.message);return []});
  if(!Array.isArray(ss)||!ss.length)continue;
  const ordered=ss.filter(x=>x.date).sort((a,b)=>new Date(a.date)-new Date(b.date));if(!ordered.length)continue;
  const start=ordered[0].date,end=ordered[ordered.length-1].date;
  if(!dateWithin(start)&&!(new Date(end).getTime()>=from.getTime()&&new Date(start).getTime()<=to.getTime()))continue;
  const venue=ev.circuit?.name||ev.circuit_name||"Circuito por confirmar",country=ev.country?.name||"",title=ev.sponsored_name||ev.name||ev.short_name||"Gran Premio";
  const key=String(eventId)+"-"+String(category.id);let post=findPost(key);
  const firstTime=new Date(start).getTime();
  if(!post&&firstTime-now<=5*86400000&&firstTime>=now-86400000){
   const schedule=ordered.map(s=>(s.type||"SESIÓN")+" | "+madridTime(s.date)).join("\n");
   const id=await createThread(key,title,venue,country,start,end,schedule,"https://www.motogp.com/");
   if(id){created++;post=posts.find(p=>p.id===id)}
  }
  if(!post)continue;
  const grid=await json(base+"/results/event/"+encodeURIComponent(eventId)+"/category/"+encodeURIComponent(category.id)+"/grid",{headers:h}).catch(()=>null);
  if(Array.isArray(grid)&&grid.length){
   const lines=fmtRows(grid.sort((a,b)=>(a.qualifying_position||999)-(b.qualifying_position||999)),x=>{const rider=x.rider?.full_name||x.rider?.name;if(!rider)return null;return (x.qualifying_position||x.position||"—")+". "+(x.rider?.number||x.number||"")+" "+rider+(x.qualifying_time?" · "+x.qualifying_time:"")});
   if(lines.length&&await addReply(post.id,"PARRILLA",key,"PARRILLA DE SALIDA",lines))grids++;
  }
  const race=ordered.filter(s=>["RAC","RACE"].includes(String(s.type||"").toUpperCase())).sort((a,b)=>new Date(b.date)-new Date(a.date))[0];
  if(race&&new Date(race.date).getTime()<now&&String(race.status||"").toLowerCase()==="official"){
   const cls=await json(base+"/results/session/"+encodeURIComponent(race.id)+"/classification?seasonYear="+season.year+"&test=false",{headers:h}).catch(()=>null);
   const rows=Array.isArray(cls?.classification)?cls.classification:[];
   if(rows.length){
    const lines=fmtRows(rows.sort((a,b)=>(a.position||999)-(b.position||999)).slice(0,28),x=>{const rider=x.rider?.full_name||x.rider?.name;if(!rider)return null;return (x.position||"—")+". "+(x.rider?.number||"")+" "+rider+" · "+(x.team?.name||"")+(x.points!=null?" · "+x.points+" pts":"")});
    if(lines.length&&await addReply(post.id,"RESULTADO",key,"RESULTADO FINAL",lines))results++;
    const table=await json(base+"/results/standings?seasonUuid="+encodeURIComponent(season.id)+"&categoryUuid="+encodeURIComponent(category.id),{headers:h}).catch(()=>null);
    const standingRows=Array.isArray(table?.classification)?table.classification:[];
    const out=fmtRows(standingRows.slice(0,25),x=>{const rider=x.rider?.full_name||x.rider?.name;if(!rider)return null;return (x.position||"—")+". "+rider+" · "+(x.points??"—")+" pts"});
    if(out.length&&await addReply(post.id,"CLASIFICACION",key,"CLASIFICACIÓN DEL CAMPEONATO",out))standings++;
   }
  }
 }
 console.log(CONFIG.name+": "+created+" hilos; "+grids+" parrillas; "+results+" resultados; "+standings+" clasificaciones.");
}
async function runF1(){
 const base="https://site.api.espn.com/apis/site/v2/sports/racing/f1";
 const months=new Set();for(let d=new Date(from);d<=to;d.setUTCDate(d.getUTCDate()+1))months.add(madridDate(d).replaceAll("-","").slice(0,6));
 const boards=await Promise.all([...months].map(m=>json(base+"/scoreboard?dates="+m).catch(e=>{console.log("Calendario F1 no disponible:",m,e.message);return null})));
 const events=[...new Map(boards.flatMap(b=>Array.isArray(b?.events)?b.events:[]).map(e=>[String(e.id),e])).values()];
 let created=0,grids=0,results=0,standings=0;
 for(const e of events){
  const comp=e.competitions?.[0],date=e.date||comp?.date;if(!date||!dateWithin(date))continue;
  const venue=comp?.venue?.fullName||e.venue?.fullName||"Circuito por confirmar",address=comp?.venue?.address||{},country=address.country||"",title=e.name||e.shortName||"Gran Premio";
  const key=String(e.id);let post=findPost(key);
  if(!post&&new Date(date).getTime()-now<=5*86400000&&new Date(date).getTime()>=now-86400000){
   const schedule=(e.competitions||[]).map(c=>(c.type?.text||"SESIÓN")+" | "+madridTime(c.date||date)).join("\n");
   const id=await createThread(key,title,venue,country,date,comp?.date||date,schedule,"https://www.espn.com/racing/");
   if(id){created++;post=posts.find(p=>p.id===id)}
  }
  if(!post)continue;
  const summary=await json(base+"/summary?event="+encodeURIComponent(e.id)).catch(()=>null);
  const competitors=comp?.competitors||summary?.competitions?.[0]?.competitors||[];
  const state=e.status?.type?.state||comp?.status?.type?.state;
  if(competitors.length){
   const ordered=[...competitors].sort((a,b)=>(a.order||a.position||999)-(b.order||b.position||999));
   const grid=fmtRows(ordered,x=>{const name=x.athlete?.displayName||x.driver?.displayName||x.team?.displayName||x.displayName;if(!name)return null;return (x.order||x.position||"—")+". "+name});
   if(state!=="post"&&grid.length&&await addReply(post.id,"PARRILLA",key,"PARRILLA DE SALIDA",grid))grids++;
   if(state==="post"){
    const result=fmtRows(ordered,x=>{const name=x.athlete?.displayName||x.driver?.displayName||x.team?.displayName||x.displayName;if(!name)return null;return (x.order||x.position||"—")+". "+name+(x.score?" · "+x.score:"")});
    if(result.length&&await addReply(post.id,"RESULTADO",key,"RESULTADO FINAL",result))results++;
   }
  }
  if(state==="post"){
   const st=await json(base+"/standings").catch(()=>null),entries=st?.children||st?.standings?.entries||st?.standings||[];
   const lines=fmtRows((Array.isArray(entries)?entries:[]).slice(0,25),x=>{const a=x.athlete||x.driver||x.team||{},name=a.displayName||a.fullName||x.displayName;if(!name)return null;const stat=x.stats?.find(y=>/points/i.test(y.name||y.abbreviation||""));return (x.rank||x.position||"—")+". "+name+(stat?.value!=null?" · "+stat.value+" pts":"")});
   if(lines.length&&await addReply(post.id,"CLASIFICACION",key,"CLASIFICACIÓN DEL CAMPEONATO",lines))standings++;
  }
 }
 console.log("FÓRMULA 1: "+created+" hilos; "+grids+" parrillas; "+results+" resultados; "+standings+" clasificaciones.");
}
if(CONFIG.kind==="moto")await runMoto();else await runF1();
