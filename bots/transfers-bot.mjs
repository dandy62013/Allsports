const U="https://tzmigdagymfauatjivcl.supabase.co",K="sb_publishable_gZ8cx30ZlxlVjlb00vo1nw_LyDC0yGH",E=process.env.BOT_EMAIL,P=process.env.BOT_PASSWORD;
if(!E||!P)throw Error("Faltan credenciales del bot.");
const H={apikey:K,"Content-Type":"application/json"};
async function api(url,opt={}){const r=await fetch(url,{...opt,headers:{...H,...(opt.headers||{})}});if(!r.ok)throw Error("HTTP "+r.status+" "+(await r.text()).slice(0,150));const t=await r.text();return t?JSON.parse(t):null;}
const s=await api(U+"/auth/v1/token?grant_type=password",{method:"POST",body:JSON.stringify({email:E,password:P})}),uid=s.user?.id;
if(!s.access_token||!uid)throw Error("No se pudo iniciar sesión.");
const A={Authorization:"Bearer "+s.access_token};
const clubs=[["Athletic Club","athletic-club.eus"],["Atlético de Madrid","atleticodemadrid.com"],["Osasuna","osasuna.es"],["Celta","rccelta.es"],["Alavés","deportivoalaves.com"],["Elche","elchecf.es"],["Barcelona","fcbarcelona.com"],["Getafe","getafecf.com"],["Levante","levanteud.com"],["Málaga","malagacf.com"],["Racing","realracingclub.es"],["Rayo","rayovallecano.es"],["Deportivo","rcdeportivo.es"],["Espanyol","rcdespanyol.com"],["Betis","realbetisbalompie.es"],["Real Madrid","realmadrid.com"],["Real Sociedad","realsociedad.eus"],["Sevilla","sevillafc.es"],["Valencia","valenciacf.com"],["Villarreal","villarrealcf.es"]];
const host=x=>{try{return new URL(x).hostname.replace(/^www\./,"").toLowerCase()}catch{return""}};
const official=(h,d)=>h===d||h.endsWith("."+d);
const decode=x=>String(x||"").replace(/&amp;/g,"&").replace(/&quot;/g,'"').replace(/&lt;/g,"<").replace(/&gt;/g,">");
const get=(x,n)=>{const m=x.match(new RegExp("<"+n+"[^>]*>([\\s\\S]*?)</"+n+">","i"));return m?decode(m[1].replace(/^<!\[CDATA\[|\]\]>$/g,"").trim()):""};
const relevant=x=>{
 const t=String(x||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
 if(/patrocin|sponsor|colaborador|colaboracion|partner|socio comercial|acuerdo comercial|proveedor|convenio|alianza|fundacion|campana|publicidad|equipacion|merchandising/.test(t))return false;
 return /fichaj|incorpora|firma|contrata|renueva|renovacion|cesion|traspas|rescind|salida|despedida|vuelve al|regresa al/.test(t);
};
const shortTitle=(raw,club)=>{
 let t=String(raw||"").replace(/\s+-\s+[^-]+$/,"").replace(/\s+/g," ").trim();
 const prefix=club+" | ";
 if(t.toLowerCase().startsWith(prefix.toLowerCase()))t=t.slice(prefix.length);
 t=t.replace(/\s*\([^)]*\)\s*$/,"").trim();
 return t.length>105?t.slice(0,102).replace(/\s+\S*$/,"")+"…":t;
};
const imageFrom=item=>{
 const tags=[...item.matchAll(/<(?:enclosure|media:content|media:thumbnail)[^>]*url=["']([^"']+)["'][^>]*>/gi)];
 for(const m of tags){const u=decode(m[1]);if(/^https:\/\//i.test(u)&&/\.(jpe?g|png|webp)(?:[?#]|$)/i.test(u))return u;}
 return "";
};
const hash=x=>{let h=2166136261;for(const c of x){h^=c.charCodeAt(0);h=Math.imul(h,16777619)}return(h>>>0).toString(16).padStart(8,"0")+(Math.imul(h^0x45d9f3b,0x27d4eb2d)>>>0).toString(16).padStart(8,"0")};
const teamSubforums=[
["Athletic Club","Athletic Club"],["Atlético de Madrid","Atlético de Madrid"],["Osasuna","CA Osasuna"],["Celta","Celta"],["Alavés","Deportivo Alavés"],["Elche","Elche CF"],["Barcelona","FC Barcelona"],["Getafe","Getafe CF"],["Levante","Levante UD"],["Málaga","Málaga CF"],["Racing","Racing de Santander"],["Rayo","Rayo Vallecano"],["Deportivo","RC Deportivo"],["Espanyol","RCD Espanyol"],["Betis","Real Betis"],["Real Madrid","Real Madrid"],["Real Sociedad","Real Sociedad"],["Sevilla","Sevilla FC"],["Valencia","Valencia CF"],["Villarreal","Villarreal CF"]
];
async function getTeamThread(teamName){
 const rows=await api(U+"/rest/v1/posts?select=id,content&user_id=eq."+uid+"&sport=eq.Fútbol&subforum=eq."+encodeURIComponent(teamName)+"&order=created_at.desc&limit=100",{headers:A});
 let p=(rows||[]).find(x=>(x.content||"").includes("[[AS-TEAM-TRANSFER:"+teamName.toLowerCase().replace(/[^a-z0-9]+/g,"-")+"]]"));
 if(!p){
  const marker="[[AS-TEAM-TRANSFER:"+teamName.toLowerCase().replace(/[^a-z0-9]+/g,"-")+"]]";
  const content="🔁 MERCADO DE FICHAJES | "+teamName+"\\n"+marker+"\\n\\nFichajes, salidas, cesiones y renovaciones oficiales de "+teamName+".\\n\\n— ALLSPORTS Informador";
  const made=await api(U+"/rest/v1/posts",{method:"POST",headers:{...A,Prefer:"return=representation"},body:JSON.stringify({user_id:uid,sport:"Fútbol",subforum:teamName,content})});
  p=made[0];
 }
 if(!p?.id)throw Error("No se pudo crear/obtener hilo de "+teamName);
 const rr=await api(U+"/rest/v1/replies?select=content&post_id=eq."+p.id+"&limit=1000",{headers:A});
 const keys=new Set((rr||[]).flatMap(x=>[...String(x.content||"").matchAll(/\[\[AS-TRANSFER:([a-f0-9]{16})\]\]/g)].map(m=>m[1])));
 return {id:p.id,keys};
}
const posts=await api(U+"/rest/v1/posts?select=id,content&user_id=eq."+uid+"&sport=eq.Mercado%20de%20fichajes&subforum=eq.General&limit=100",{headers:A});
let thread=(posts||[]).find(x=>(x.content||"").includes("[[AS-TRANSFER:MAIN]]"));
if(!thread){const content="⚽ MERCADO DE FICHAJES | Primera División\n[[AS-TRANSFER:MAIN]]\n\nFichajes, salidas, cesiones y renovaciones confirmados oficialmente por los clubes de Primera División. Sin rumores.\n\n— ALLSPORTS Informador";const made=await api(U+"/rest/v1/posts",{method:"POST",headers:{...A,Prefer:"return=representation"},body:JSON.stringify({user_id:uid,sport:"Mercado de fichajes",subforum:"General",content})});thread=made[0];}
if(!thread?.id)throw Error("No se encontró el hilo permanente.");
const replies=await api(U+"/rest/v1/replies?select=content&post_id=eq."+thread.id+"&limit=1000",{headers:A});
const seen=new Set((replies||[]).flatMap(x=>[...String(x.content||"").matchAll(/\[\[AS-TRANSFER:([a-f0-9]{16})\]\]/g)].map(m=>m[1])));
let added=0,teamAdded=0;
for(const [club,domain] of clubs){
 const q='site:'+domain+' (fichaje OR incorpora OR renueva OR cesión OR traspaso OR firma OR salida) "'+club+'"';
 const url="https://news.google.com/rss/search?q="+encodeURIComponent(q)+"&hl=es&gl=ES&ceid=ES:es";
 let xml;try{const r=await fetch(url);if(!r.ok)continue;xml=await r.text()}catch{continue}
 for(const m of xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)){
  const item=m[1],title=get(item,"title"),link=get(item,"link"),date=get(item,"pubDate"),src=item.match(/<source[^>]*url=["']([^"']+)["']/i),source=src?decode(src[1]):"";
  if(!title||!link||!relevant(title)||!official(host(source),domain))continue;
  // Evita rescatar noticias antiguas del RSS: solo noticias oficiales de los últimos 7 días.
  const publishedAt=new Date(date);if(!date||!Number.isFinite(publishedAt.getTime())||publishedAt.getTime()<Date.now()-7*86400000||publishedAt.getTime()>Date.now()+86400000)continue;
  const id=hash(link);if(seen.has(id))continue;
  const when=new Date(date),dateText=Number.isNaN(when.getTime())?"Fecha no indicada":when.toLocaleString("es-ES",{timeZone:"Europe/Madrid",dateStyle:"medium",timeStyle:"short"});
  const text=["🟢 "+club+" | "+title,"FECHA | "+dateText,"FUENTE OFICIAL | "+link,"","— ALLSPORTS Informador","[[AS-TRANSFER:"+id+"]]"].join("\n").slice(0,990);
  await api(U+"/rest/v1/replies",{method:"POST",headers:{...A,Prefer:"return=minimal"},body:JSON.stringify({post_id:thread.id,user_id:uid,content:text})});
  seen.add(id);added++;
  const teamName=teamSubforums.find(x=>x[0]===club)?.[1];
  if(teamName){
   const teamThread=await getTeamThread(teamName);
   if(!teamThread.keys.has(id)){
    await api(U+"/rest/v1/replies",{method:"POST",headers:{...A,Prefer:"return=minimal"},body:JSON.stringify({...replyPayload,post_id:teamThread.id})});
    teamThread.keys.add(id);teamAdded++;
   }
  }
  console.log("Publicado:",club,title,"(mercado general y foro del equipo)");
 }
}
console.log("Mercado de fichajes: "+clubs.length+" clubes comprobados; "+added+" noticias nuevas en el hilo general; "+teamAdded+" réplicas en hilos de equipo.");
