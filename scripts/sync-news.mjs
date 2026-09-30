import {mkdir,writeFile,readFile} from "node:fs/promises";

const token=process.env.GITHUB_TOKEN;
const repo=process.env.GITHUB_REPOSITORY||"21-T4/TruX-Horizon";
const owner=process.env.GITHUB_REPOSITORY_OWNER||repo.split("/")[0];

const r=await fetch("https://api.github.com/repos/"+repo+"/issues?state=all&per_page=100",{
  headers:{
    "Accept":"application/vnd.github+json",
    "Authorization":"Bearer "+token,
    "X-GitHub-Api-Version":"2022-11-28"
  }
});
if(!r.ok) throw new Error("GitHub API "+r.status);

const issues=(await r.json()).filter(i=>
  !i.pull_request &&
  i.user?.login===owner &&
  /^NEWS:\s/i.test(i.title) &&
  i.state==="open"
);

const esc=s=>String(s??"").replace(/[&<>"]/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[m]));
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

await mkdir("news",{recursive:true});

const used=new Set();
const generated=issues.map(i=>{
  const title=cleanTitle(i.title);
  let slug=shortSlug(title);
  if(used.has(slug)) slug=slug+"-"+i.number;
  used.add(slug);
  const url="/news/"+slug+"/";
  const body=plain(i.body||"");
  const desc=(body.split("\n").find(x=>x.trim())||title).slice(0,180);
  return {
    sourceIssue:i.number,
    headline:title,
    description:desc,
    datePublished:i.created_at,
    dateModified:i.updated_at,
    category:"Live Update",
    url,
    body
  };
}).sort((a,b)=>new Date(b.datePublished)-new Date(a.datePublished));

await Promise.all(generated.map(async item=>{
  const related=generated.filter(x=>x.url!==item.url).slice(0,3);
  const ld={
    "@context":"https://schema.org",
    "@type":"NewsArticle",
    "headline":item.headline,
    "description":item.description,
    "datePublished":item.datePublished,
    "dateModified":item.dateModified,
    "author":{"@type":"Organization","name":"TruX Technologies"},
    "publisher":{"@type":"Organization","name":"TruX Technology","logo":{"@type":"ImageObject","url":"https://chat.trux.website/icon-192.png"}},
    "mainEntityOfPage":"https://technology.trux.website"+item.url
  };

  const paragraphs=item.body.split(/\n\s*\n/)
    .map(p=>p.trim()).filter(Boolean)
    .map(p=>"<p>"+esc(p).replace(/\n/g,"<br>")+"</p>").join("");

  const relatedHtml=related.length
    ? '<section style="margin-top:55px"><small style="font:500 10px DM Mono,monospace;letter-spacing:.18em;color:#79baff">MORE FROM TRUX TECHNOLOGY</small><div class="topics" style="margin-top:18px">'+related.map(x=>'<article><h3>'+esc(x.headline)+'</h3><p>'+esc(x.description)+'</p><a class="read" href="'+x.url+'">Read story ↗</a></article>').join("")+"</div></section>"
    : "";

  const html='<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+esc(item.headline)+' | TruX Technology</title><meta name="description" content="'+esc(item.description)+'"><meta name="robots" content="index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1"><link rel="canonical" href="https://technology.trux.website'+item.url+'"><link rel="icon" href="https://chat.trux.website/icon-192.png" type="image/png"><link rel="stylesheet" href="/styles.css"><script type="application/ld+json">'+JSON.stringify(ld)+'</script></head><body><header><div class="wrap nav"><a class="brand" href="/"><img src="https://chat.trux.website/icon-192.png" alt="TruX logo"><span>TruX <b>Technology</b></span></a><nav><a href="/">Latest</a><a href="/publisher.html">Owner publish</a><a class="try" href="https://chat.trux.website/">Try TruX ↗</a></nav></div></header><main class="wrap" style="padding:65px 0 80px;max-width:900px"><small style="display:block;margin-bottom:18px">TRUX TECHNOLOGY · '+new Date(item.datePublished).toUTCString().replace(/\sGMT$/,"")+'</small><h1 style="font-size:clamp(42px,7vw,76px);line-height:1;letter-spacing:-.07em;margin:0 0 28px">'+esc(item.headline)+'</h1><div style="color:#9eabb8;line-height:1.9;font-size:17px">'+paragraphs+'</div>'+relatedHtml+'<p style="margin-top:40px"><a class="outline" href="/">← Back to TruX Technology</a></p></main></body></html>';
  await writeFile("news/"+item.url.split("/").filter(Boolean).pop()+"/index.html",html);
}));

const all=generated.map(({body,...x})=>x);
await writeFile("data/news-index.json",JSON.stringify(all,null,2)+"\n");

const urls=["https://technology.trux.website/",...generated.map(x=>"https://technology.trux.website"+x.url)];
await writeFile("sitemap.xml",'<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+urls.map(u=>"<url><loc>"+u+"</loc></url>").join("")+"</urlset>\n");
await writeFile("rss.xml",'<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>TruX Technology</title><link>https://technology.trux.website/</link><description>Official TruX-AI news.</description>'+all.slice(0,30).map(x=>"<item><title>"+esc(x.headline)+"</title><link>https://technology.trux.website"+x.url+"</link><pubDate>"+new Date(x.datePublished).toUTCString()+"</pubDate><description>"+esc(x.description)+"</description></item>").join("")+"</channel></rss>\n");
