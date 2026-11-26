const U="https://tzmigdagymfauatjivcl.supabase.co",K="sb_publishable_gZ8cx30ZlxlVjlb00vo1nw_LyDC0yGH",E=process.env.BOT_EMAIL,P=process.env.BOT_PASSWORD;
if(!E||!P)throw Error("Faltan credenciales del bot.");
const H={apikey:K,"Content-Type":"application/json"};
async function api(url,opt={}){const r=await fetch(url,{...opt,headers:{...H,...(opt.headers||{})}});if(!r.ok)throw Error("HTTP "+r.status+" "+(await r.text()).slice(0,150));const t=await r.text();return t?JSON.parse(t):null;}
const s=await api(U+"/auth/v1/token?grant_type=password",{method:"POST",body:JSON.stringify({email:E,password:P})}),uid=s.user?.id;
if(!s.access_token||!uid)throw Error("No se pudo iniciar sesión.");
const A={Authorization:"Bearer "+s.access_token};
const clubs=[["Liverpool","liverpoolfc.com"],["Manchester City","mancity.com"],["Manchester United","manutd.com"],["Arsenal","arsenal.com"],["Chelsea","chelseafc.com"],["Tottenham","tottenhamhotspur.com"],["Bayern Múnich","fcbayern.com"],["Borussia Dortmund","bvb.de"],["Paris Saint-Germain","psg.fr"],["Inter de Milán","inter.it"],["Juventus","juventus.com"],["AC Milan","acmilan.com"],["Benfica","slbenfica.pt"],["Porto","fcporto.pt"],["Ajax","ajax.nl"],["Albacete","albacetebalompie.es"],["Almería","udalmeriasad.com"],["Andorra","fcandorra.com"],["Burgos","burgoscf.es"],["Cádiz","cadizcf.com"],["Castellón","cdcastellon.com"],["Celta Fortuna","rccelta.es"],["Ceuta","adceutafc.com"],["Córdoba","cordobacf.com"],["Eibar","sdeibar.com"],["Eldense","cdeldense.es"],["Girona","gironafc.cat"],["Granada","granadacf.es"],["Las Palmas","udlaspalmas.es"],["Leganés","cdleganes.com"],["Mallorca","rcdmallorca.es"],["Oviedo","realoviedo.es"],["Real Sociedad B","realsociedad.eus"],["Sabadell","cesabadellfc.com"],["Sporting","realsporting.com"],["Tenerife","clubdeportivotenerife.es"],["Valladolid","realvalladolid.es"],["Granada Femenino","granadacf.es"],["Levante Las Planas","levanteplanas.com"],["Athletic Club","athletic-club.eus"],["Atlético de Madrid","atleticodemadrid.com"],["Osasuna","osasuna.es"],["Celta","rccelta.es"],["Alavés","deportivoalaves.com"],["Elche","elchecf.es"],["Barcelona","fcbarcelona.com"],["Getafe","getafecf.com"],["Levante","levanteud.com"],["Málaga","malagacf.com"],["Racing","realracingclub.es"],["Rayo","rayovallecano.es"],["Deportivo","rcdeportivo.es"],["Espanyol","rcdespanyol.com"],["Betis","realbetisbalompie.es"],["Real Madrid","realmadrid.com"],["Real Sociedad","realsociedad.eus"],["Sevilla","sevillafc.es"],["Valencia","valenciacf.com"],["Villarreal","villarrealcf.es"]];
const host=x=>{try{return new URL(x).hostname.replace(/^www\./,"").toLowerCase()}catch{return""}};
const official=(h,d)=>h===d||h.endsWith("."+d);
const decode=x=>String(x||"").replace(/&amp;/g,"&").replace(/&quot;/g,'"').replace(/&lt;/g,"<").replace(/&gt;/g,">");
const get=(x,n)=>{const m=x.match(new RegExp("<"+n+"[^>]*>([\\s\\S]*?)</"+n+">","i"));return m?decode(m[1].replace(/^<!\[CDATA\[|\]\]>$/g,"").trim()):""};
const personPattern="([A-ZÁÉÍÓÚÑ][\\p{L}.'’\\-]+(?:\\s+[A-ZÁÉÍÓÚÑ][\\p{L}.'’\\-]+){0,3})";
const transferTarget=raw=>{
 const t=String(raw||"").replace(/\s+/g," ").trim();
 if(/\b(?:alquiler|fotomat[oó]n|club de negocios|patrocin|sponsor|partner|socio comercial|colaborador|proveedor|fundaci[oó]n|empresa|acuerdo comercial|alianza comercial|renuevan su confianza|estructura del club|segunda parte|se impone|exhibici[oó]n|taconazo|golazo|cr[oó]nica|resumen|previa)\b/i.test(t))return "";
 const patterns=[
  new RegExp("\\b(?:fichaje|renovaci[oó]n|incorporaci[oó]n|llegada)\\s+(?:de|del)\\s+"+personPattern,"u"),
  new RegExp("\\b(?:ficha|incorpora|contrata|presenta|renueva|cede|traspasa|rescinde)\\b[\\s\\S]{0,65}?\\b(?:a|de|por|con)\\s+(?:su plantilla\\s+a\\s+|a la plantilla\\s+a\\s+|al jugador\\s+|al futbolista\\s+)?"+personPattern,"u"),
  new RegExp("\\b"+personPattern+"\\s+(?:se incorpora|firma\\s+(?:su\\s+)?(?:primer\\s+)?(?:contrato|ficha profesional)|firma por|renueva(?:\\s+(?:su\\s+)?contrato)?|ampl[ií]a contrato|extiende contrato|llega al club|vuelve al club|regresa al club)\\b","u")
 ];
 for(const pattern of patterns){
  const match=t.match(pattern);if(!match)continue;
  const candidate=match[1].trim();
  if(/\b(?:club|femenino|femenina|negocios|alquiler|fotomat[oó]n|empresa|fundaci[oó]n|real|deportivo|atl[eé]tico|osasuna|betis|elche|m[aá]laga|levante|valencia|villarreal|sevilla|racing|rayo|celta|espanyol|barcelona|getafe|athletic)\b/i.test(candidate))continue;
  return candidate;
 }
 return "";
};
const relevant=x=>Boolean(transferTarget(x));
const transferType=title=>{
 const t=String(title||"").toLowerCase();
 if(/renuev|renovaci[oó]n/.test(t))return "RENOVACIÓN";
 if(/cedid|cesi[oó]n|cede/.test(t))return "CESIÓN";
 if(/traspas/.test(t))return "TRASPASO";
 if(/rescind/.test(t))return "RESCISIÓN";
 if(/contrato|ficha profesional/.test(t))return "NUEVO CONTRATO";
 if(/incorpora|se incorpora|llegada/.test(t))return "INCORPORACIÓN";
 return "FICHAJE";
};
const shortTitle=(raw,club)=>{
 let t=String(raw||"").replace(/\s+-\s+[^-]+$/,"").replace(/\s+/g," ").trim();
 const prefix=club+" | ";
 if(t.toLowerCase().startsWith(prefix.toLowerCase()))t=t.slice(prefix.length);
 t=t.replace(/\s*\([^)]*\)\s*$/,"").trim();
 return t.length>75?t.slice(0,72).replace(/\s+\S*$/,"")+"…":t;
};
const imageFrom=item=>{
 const tags=[...item.matchAll(/<(?:enclosure|media:content|media:thumbnail)[^>]*url=["']([^"']+)["'][^>]*>/gi)];
 for(const m of tags){const u=decode(m[1]);if(/^https:\/\//i.test(u)&&/\.(jpe?g|png|webp)(?:[?#]|$)/i.test(u))return u;}
 return "";
};
const hash=x=>{let h=2166136261;for(const c of x){h^=c.charCodeAt(0);h=Math.imul(h,16777619)}return(h>>>0).toString(16).padStart(8,"0")+(Math.imul(h^0x45d9f3b,0x27d4eb2d)>>>0).toString(16).padStart(8,"0")};
const MARKET_SUBFORUMS=["Masculino · Primera División","Masculino · Segunda División","Masculino · Fútbol internacional","Femenino · Mercado de fichajes"];
const secondDivisionClubs=new Set(["Albacete","Almería","Andorra","Burgos","Cádiz","Castellón","Celta Fortuna","Ceuta","Córdoba","Eibar","Eldense","Girona","Granada","Las Palmas","Leganés","Mallorca","Oviedo","Real Sociedad B","Sabadell","Sporting","Tenerife","Valladolid"]);
const internationalClubNames=new Set(["Liverpool","Manchester City","Manchester United","Arsenal","Chelsea","Tottenham","Bayern Múnich","Borussia Dortmund","Paris Saint-Germain","Inter de Milán","Juventus","AC Milan","Benfica","Porto","Ajax"]);
const marketCategory=(club,title)=>{
 const t=String(title||"").normalize("NFD").replace(/[\\u0300-\\u036f]/g,"").toLowerCase();
 if(/\\b(femenino|femenina|women|womens|ladies)\\b/.test(t))return MARKET_SUBFORUMS[3];
 if(internationalClubNames.has(club))return MARKET_SUBFORUMS[2];
 if(secondDivisionClubs.has(club))return MARKET_SUBFORUMS[1];
 return MARKET_SUBFORUMS[0];
};
const posts=await api(U+"/rest/v1/posts?select=id,content,subforum&user_id=eq."+uid+"&sport=eq.Mercado%20de%20fichajes&limit=1000",{headers:A});
const seen=new Set((posts||[]).flatMap(x=>[...String(x.content||"").matchAll(/\\[\\[AS-TRANSFER:([a-f0-9]{16})\\]\\]/g)].map(m=>m[1])));
let added=0;

for(const [club,domain] of clubs){
 const q='site:'+domain+' (fichaje OR incorpora OR contrata OR renueva OR renovación OR cesión OR cedido OR traspaso OR rescinde OR "contrato profesional" OR "firma por") "'+club+'"';
 const url="https://news.google.com/rss/search?q="+encodeURIComponent(q)+"&hl=es&gl=ES&ceid=ES:es";
 let xml;try{const r=await fetch(url);if(!r.ok)continue;xml=await r.text()}catch{continue}
 for(const m of xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)){
  const item=m[1],title=get(item,"title"),link=get(item,"link"),date=get(item,"pubDate"),src=item.match(/<source[^>]*url=["']([^"']+)["']/i),source=src?decode(src[1]):"";
  if(!title||!link||!relevant(title)||!official(host(source),domain))continue;
  // Evita rescatar noticias antiguas del RSS: solo noticias oficiales de los últimos 7 días.
  const publishedAt=new Date(date);if(!date||!Number.isFinite(publishedAt.getTime())||publishedAt.getTime()<Date.now()-7*86400000||publishedAt.getTime()>Date.now()+86400000)continue;
  const id=hash(link);if(seen.has(id))continue;
  const when=new Date(date),dateText=Number.isNaN(when.getTime())?"Fecha no indicada":when.toLocaleString("es-ES",{timeZone:"Europe/Madrid",dateStyle:"medium",timeStyle:"short"});
  const cleanTitle=shortTitle(title,club);
  const imageUrl=imageFrom(item);
  const target=transferTarget(title);
  if(!target)continue;
  const text=["🟢 "+club.toUpperCase()+" | "+transferType(title)+": "+target.toUpperCase(),"JUGADOR/A | "+target,"DETALLE | "+cleanTitle,"FECHA | "+dateText,"COMUNICADO OFICIAL | [Leer noticia]("+link+")","","— ALLSPORTS Informador","[[AS-TRANSFER:"+id+"]]"].join("\n").slice(0,990);
  const subforum=marketCategory(club,title);
   const postPayload={user_id:uid,sport:"Mercado de fichajes",subforum,content:text,link_url:link,...(imageUrl?{media_url:imageUrl,media_type:"image"}:{})};
   await api(U+"/rest/v1/posts",{method:"POST",headers:{...A,Prefer:"return=minimal"},body:JSON.stringify(postPayload)});
   seen.add(id);added++;
  console.log("Publicado:",club,title,"(solo mercado general)");
 }
}
console.log("Mercado de fichajes: "+clubs.length+" clubes comprobados; "+added+" noticias nuevas distribuidas en "+MARKET_SUBFORUMS.length+" subforos.");
