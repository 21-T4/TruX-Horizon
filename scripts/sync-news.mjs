import {mkdir,writeFile,readFile,rm} from "node:fs/promises";

const token=process.env.GITHUB_TOKEN;
const repo=process.env.GITHUB_REPOSITORY||"21-T4/TruX-Horizon";
const owner=process.env.GITHUB_REPOSITORY_OWNER||repo.split("/")[0];
const SITE="https://technology.trux.website";

/* ---------- 1. Fetch ONLY the owner's open NEWS: issues (all pages) ---------- */
async function fetchIssues(){
  const out=[];
  for(let page=1;page<=30;page++){
    const headers={"Accept":"application/vnd.github+json","X-GitHub-Api-Version":"2022-11-28"};
    if(token) headers.Authorization="Bearer "+token;
    const r=await fetch(`https://api.github.com/repos/${repo}/issues?state=open&creator=${encodeURIComponent(owner)}&per_page=100&page=${page}`,{headers});
    if(!r.ok) throw new Error("GitHub API "+r.status+" "+(await r.text()).slice(0,200));
    const batch=await r.json();
    out.push(...batch);
    if(batch.length<100) break;
  }
  return out;
}

const issues=(await fetchIssues()).filter(i=>
  !i.pull_request &&
  String(i.user?.login||"").toLowerCase()===owner.toLowerCase() &&
  /^NEWS:\s*/i.test(i.title||"") &&
  i.state==="open"
);

/* ---------- 2. Helpers ---------- */
const esc=s=>String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));
const normalize=s=>String(s).toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
const cleanTitle=s=>String(s||"").replace(/^NEWS:\s*/i,"").replace(/\s+/g," ").trim();
const shortSlug=title=>{
  const raw=normalize(title).split(" ").filter(Boolean);
  if(raw[0]==="trux" && raw[1]==="code") return "trux-code";
  const stop=new Set(["within","with","the","a","an","and","of","for","in","on","to","from","now"]);
  const meaningful=raw.filter(x=>!stop.has(x));
  const base=meaningful.slice(0,3).join("-").slice(0,42).replace(/-$/,"");
  return base||"news";
};
const plain=s=>String(s||"").replace(/\r/g,"").trim();

const inline=s=>esc(s)
  .replace(/`([^`]+)`/g,"<code>$1</code>")
  .replace(/\*\*([^*]+)\*\*/g,"<strong>$1</strong>")
  .replace(/(^|[^*])\*([^*\n]+)\*/g,"$1<em>$2</em>")
  .replace(/!\[([^\]]*)\]\((https:\/\/[^)\s]+)\)/g,'<img src="$2" alt="$1" loading="lazy">')
  .replace(/\[([^\]]+)\]\(((?:https?:\/\/|\/)[^)\s]+)\)/g,'<a href="$2" rel="noopener">$1</a>');

function render(md){
  const lines=plain(md).split("\n");
  let html="",i=0;
  const isList=l=>/^\s*[-*]\s+/.test(l);
  const isQuote=l=>/^>\s?/.test(l);
  const isHead=l=>/^#{1,3}\s+/.test(l);
  while(i<lines.length){
    const l=lines[i];
    if(/^```/.test(l)){
      const buf=[];i++;
      while(i<lines.length&&!/^```/.test(lines[i])){buf.push(lines[i]);i++}
      i++;html+="<pre><code>"+esc(buf.join("\n"))+"</code></pre>";continue;
    }
    if(isHead(l)){
      const m=l.match(/^(#{1,3})\s+(.*)/);const n=m[1].length+1;
      html+=`<h${n}>${inline(m[2])}</h${n}>`;i++;continue;
    }
    if(isList(l)){
      const it=[];
      while(i<lines.length&&isList(lines[i])){it.push("<li>"+inline(lines[i].replace(/^\s*[-*]\s+/,""))+"</li>");i++}
      html+="<ul>"+it.join("")+"</ul>";continue;
    }
    if(isQuote(l)){
      const b=[];
      while(i<lines.length&&isQuote(lines[i])){b.push(lines[i].replace(/^>\s?/,""));i++}
      html+="<blockquote>"+inline(b.join(" "))+"</blockquote>";continue;
    }
    if(!l.trim()){i++;continue}
    const p=[l];i++;
    while(i<lines.length&&lines[i].trim()&&!/^```/.test(lines[i])&&!isHead(lines[i])&&!isList(lines[i])&&!isQuote(lines[i])){p.push(lines[i]);i++}
    html+="<p>"+p.map(inline).join("<br>")+"</p>";
  }
  return html;
}

const stripMd=s=>String(s).replace(/!\[[^\]]*\]\([^)]*\)/g,"").replace(/\[([^\]]+)\]\([^)]*\)/g,"$1").replace(/[`*_>#]/g,"").trim();

/* ---------- 3. Build items ---------- */
await mkdir("news",{recursive:true});
await mkdir("data",{recursive:true});

let previous=[];
try{previous=JSON.parse(await readFile("data/news-index.json","utf8"))}catch{}

const used=new Set();
const generated=issues.map(i=>{
  const title=cleanTitle(i.title);
  let slug=shortSlug(title);
  if(used.has(slug)) slug=slug+"-"+i.number;
  used.add(slug);
  const body=plain(i.body||"");
  const firstLine=body.split("\n").map(stripMd).find(x=>x)||title;
  const img=body.match(/!\[[^\]]*\]\((https:\/\/[^)\s]+)\)/);
  const label=(i.labels||[]).map(l=>typeof l==="string"?l:l.name).find(Boolean);
  const words=body.split(/\s+/).filter(Boolean).length;
  return {
    sourceIssue:i.number,
    headline:title,
    description:firstLine.slice(0,180),
    datePublished:i.created_at,
    dateModified:i.updated_at,
    category:label||"Update",
    readMinutes:Math.max(1,Math.round(words/200)),
    image:img?img[1]:"",
    url:"/news/"+slug+"/",
    body
  };
}).sort((a,b)=>new Date(b.datePublished)-new Date(a.datePublished));

/* ---------- 4. Article pages ---------- */
const slugOf=u=>u.split("/").filter(Boolean).pop();

await Promise.all(generated.map(async item=>{
  const related=generated.filter(x=>x.url!==item.url).slice(0,3);
  const abs=SITE+item.url;
  const ld={
    "@context":"https://schema.org","@type":"NewsArticle",
    "headline":item.headline,"description":item.description,
    "datePublished":item.datePublished,"dateModified":item.dateModified,
    "image":item.image||SITE+"/icon-192.png",
    "author":{"@type":"Organization","name":"TruX Technologies"},
    "publisher":{"@type":"Organization","name":"TruX Technology","logo":{"@type":"ImageObject","url":SITE+"/icon-192.png"}},
    "mainEntityOfPage":abs
  };
  const date=new Date(item.datePublished).toLocaleDateString("en-US",{year:"numeric",month:"long",day:"numeric",timeZone:"UTC"});
  const relatedHtml=related.length
    ? '<section class="more"><small>MORE UPDATES</small><div class="topics">'+related.map(x=>'<article class="rv"><span class="tag">'+esc(x.category)+'</span><h3>'+esc(x.headline)+'</h3><p>'+esc(x.description)+'</p><a class="read" href="'+esc(x.url)+'">Read update ↗</a></article>').join("")+'</div></section>'
    : "";
  const cover=item.image?'<img class="cover" src="'+esc(item.image)+'" alt="">':"";

  const html='<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+esc(item.headline)+' | TruX Technology</title><meta name="description" content="'+esc(item.description)+'"><meta name="robots" content="index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1"><meta name="theme-color" content="#030304"><link rel="canonical" href="'+abs+'"><link rel="icon" href="/icon-192.png" type="image/png"><meta property="og:type" content="article"><meta property="og:title" content="'+esc(item.headline)+'"><meta property="og:description" content="'+esc(item.description)+'"><meta property="og:url" content="'+abs+'"><meta property="og:image" content="'+esc(item.image||SITE+"/icon-192.png")+'"><link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;600;800&family=DM+Mono:wght@400;500&display=swap"><link rel="stylesheet" href="/styles.css"><script type="application/ld+json">'+JSON.stringify(ld).replace(/</g,"\\u003c")+'</script></head><body><div class="progress"></div><header><div class="wrap nav"><a class="brand" href="/"><img src="/icon-192.png" alt="TruX logo"><span>TruX <b>Technology</b></span></a><nav><a href="/#latest">Updates</a><a href="/#topics">Topics</a><a class="try" href="https://chat.trux.website/">Try TruX ↗</a></nav></div></header><main class="wrap article"><div class="a-meta rv"><span class="tag cat-tag">'+esc(item.category)+'</span><span>'+date+'</span><span>'+item.readMinutes+' min read</span></div><h1 class="a-title rv">'+esc(item.headline)+'</h1>'+cover+'<div class="prose rv">'+render(item.body)+'</div><div class="a-actions rv"><a class="outline" href="/">← Back to updates</a><button class="outline" id="share" type="button" data-url="'+abs+'" data-title="'+esc(item.headline)+'">Share update</button></div>'+relatedHtml+'</main><footer class="wrap foot"><span>TruX Technology</span><span><a href="https://trux.website/">TruX-AI</a> · <a href="https://chat.trux.website/">App</a></span></footer><script src="/app.js" defer></script></body></html>';

  const dir="news/"+slugOf(item.url);
  await mkdir(dir,{recursive:true});          // <-- the missing step that crashed the old script
  await writeFile(dir+"/index.html",html);
}));

/* ---------- 5. Remove pages of stories that were unpublished ---------- */
const keep=new Set(generated.map(x=>x.url));
for(const old of previous){
  if(old?.url && !keep.has(old.url)){
    const s=slugOf(old.url);
    if(s && /^[a-z0-9-]+$/.test(s)) await rm("news/"+s,{recursive:true,force:true});
  }
}

/* ---------- 6. Index, sitemap, RSS ---------- */
const all=generated.map(({body,...x})=>x);
await writeFile("data/news-index.json",JSON.stringify(all,null,2)+"\n");

const urls=[{loc:SITE+"/"},...generated.map(x=>({loc:SITE+x.url,mod:x.dateModified}))];
await writeFile("sitemap.xml",'<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+urls.map(u=>"<url><loc>"+u.loc+"</loc>"+(u.mod?"<lastmod>"+u.mod+"</lastmod>":"")+"</url>").join("")+"</urlset>\n");

await writeFile("rss.xml",'<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>TruX Technology</title><link>'+SITE+'/</link><description>Official TruX-AI news.</description>'+all.slice(0,30).map(x=>"<item><title>"+esc(x.headline)+"</title><link>"+SITE+x.url+"</link><guid>"+SITE+x.url+"</guid><category>"+esc(x.category)+"</category><pubDate>"+new Date(x.datePublished).toUTCString()+"</pubDate><description>"+esc(x.description)+"</description></item>").join("")+"</channel></rss>\n");

console.log("Published "+all.length+" stor"+(all.length===1?"y":"ies"));
