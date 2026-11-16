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
const relevant=x=>/fichaj|incorpora|firma|contrata|renueva|renovaci[oó]n|cesi[oó]n|traspas|rescind|salida|acuerdo.*jugador/i.test(x);
const hash=x=>{let h=2166136261;for(const c of x){h^=c.charCodeAt(0);h=Math.imul(h,16777619)}return(h>>>0).toString(16).padStart(8,"0")+(Math.imul(h^0x45d9f3b,0x27d4eb2d)>>>0).toString(16).padStart(8,"0")};
const posts=await api(U+"/rest/v1/posts?select=id,content&user_id=eq."+uid+"&sport=eq.Mercado%20de%20fichajes&subforum=eq.General&limit=100",{headers:A});
let thread=(posts||[]).find(x=>(x.content||"").includes("[[AS-TRANSFER:MAIN]]"));
if(!thread){const content="⚽ MERCADO DE FICHAJES | Primera División\n[[AS-TRANSFER:MAIN]]\n\nFichajes, salidas, cesiones y renovaciones confirmados oficialmente por los clubes de Primera División. Sin rumores.\n\n— ALLSPORTS Informador";const made=await api(U+"/rest/v1/posts",{method:"POST",headers:{...A,Prefer:"return=representation"},body:JSON.stringify({user_id:uid,sport:"Mercado de fichajes",subforum:"General",content})});thread=made[0];}
if(!thread?.id)throw Error("No se encontró el hilo permanente.");
const replies=await api(U+"/rest/v1/replies?select=content&post_id=eq."+thread.id+"&limit=1000",{headers:A});
const seen=new Set((replies||[]).flatMap(x=>[...String(x.content||"").matchAll(/\[\[AS-TRANSFER:([a-f0-9]{16})\]\]/g)].map(m=>m[1])));
let added=0;
for(const [club,domain] of clubs){
 const q='site:'+domain+' (fichaje OR incorpora OR renueva OR cesión OR traspaso OR firma OR salida) "'+club+'"';
 const url="https://news.google.com/rss/search?q="+encodeURIComponent(q)+"&hl=es&gl=ES&ceid=ES:es";
 let xml;try{const r=await fetch(url);if(!r.ok)continue;xml=await r.text()}catch{continue}
 for(const m of xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)){
  const item=m[1],title=get(item,"title"),link=get(item,"link"),date=get(item,"pubDate"),src=item.match(/<source[^>]*url=["']([^"']+)["']/i),source=src?decode(src[1]):"";
  if(!title||!link||!relevant(title)||!official(host(source),domain))continue;
  const id=hash(link);if(seen.has(id))continue;
  const when=new Date(date),dateText=Number.isNaN(when.getTime())?"Fecha no indicada":when.toLocaleString("es-ES",{timeZone:"Europe/Madrid",dateStyle:"medium",timeStyle:"short"});
  const text=["🟢 "+club+" | "+title,"FECHA | "+dateText,"FUENTE OFICIAL | "+link,"","— ALLSPORTS Informador","[[AS-TRANSFER:"+id+"]]"].join("\n").slice(0,990);
  await api(U+"/rest/v1/replies",{method:"POST",headers:{...A,Prefer:"return=minimal"},body:JSON.stringify({post_id:thread.id,user_id:uid,content:text})});
  seen.add(id);added++;console.log("Publicado:",club,title);
 }
}
console.log("Mercado de fichajes: "+clubs.length+" clubes comprobados; "+added+" noticias nuevas.");
