import {mkdir,writeFile,readdir,unlink,readFile} from "node:fs/promises";
const token=process.env.GITHUB_TOKEN; const repo=process.env.GITHUB_REPOSITORY||"21-T4/TruX-Horizon";
const r=await fetch("https://api.github.com/repos/"+repo+"/issues?state=open&per_page=50",{headers:{"Accept":"application/vnd.github+json","Authorization":"Bearer "+token,"X-GitHub-Api-Version":"2022-11-28"}});
if(!r.ok) throw new Error("GitHub API "+r.status); const issues=(await r.json()).filter(i=>!i.pull_request&&/^NEWS:\s/i.test(i.title));
const esc=s=>String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));
const slug=s=>String(s).toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,70)||"news";
const plain=s=>String(s||"").replace(/\r/g,"").trim();
await mkdir("news",{recursive:true});
const generated=[];
for(const i of issues){
 const title=i.title.replace(/^NEWS:\s*/i,"").trim(), url="/news/"+i.number+"-"+slug(title)+".html", body=plain(i.body||""), desc=(body.split("\n").find(x=>x.trim())||title).slice(0,180);
 const ld={"@context":"https://schema.org","@type":"NewsArticle","headline":title,"datePublished":i.created_at,"dateModified":i.updated_at,"author":{"@type":"Organization","name":"TruX Technologies"},"publisher":{"@type":"Organization","name":"TruX Technology","logo":{"@type":"ImageObject","url":"https://chat.trux.website/icon-192.png"}},"mainEntityOfPage":"https://technology.trux.website"+url};
 const html='<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+esc(title)+' | TruX Technology</title><meta name="description" content="'+esc(desc)+'"><meta name="robots" content="index,follow,max-image-preview:large"><link rel="canonical" href="https://technology.trux.website'+url+'"><link rel="icon" href="https://chat.trux.website/icon-192.png" type="image/png"><link rel="stylesheet" href="/styles.css"><script type="application/ld+json">'+JSON.stringify(ld)+'</script></head><body><main class="wrap" style="padding:70px 0;max-width:850px"><a class="brand" href="/"><img src="https://chat.trux.website/icon-192.png" alt="TruX logo"><span>TruX <b>Technology</b></span></a><small style="display:block;margin-top:60px">LIVE UPDATE · '+new Date(i.created_at).toUTCString().slice(0,16)+'</small><h1 style="font-size:clamp(42px,7vw,76px);line-height:1;letter-spacing:-.07em">'+esc(title)+'</h1><div style="color:#9eabb8;line-height:1.9;font-size:17px">'+body.split("\n\n").filter(Boolean).map(p=>'<p>'+esc(p)+'</p>').join("")+'</div><p><a class="outline" href="/">← Back</a></p></main></body></html>';
 await writeFile("news/"+url.split("/").pop(),html); generated.push({headline:title,description:desc,datePublished:i.created_at,category:"Live Update",url});
}
const seed=JSON.parse(await readFile("data/news-index.json","utf8")); const all=[...seed.filter(x=>!x.url.startsWith("/news/")),...generated].sort((a,b)=>new Date(b.datePublished)-new Date(a.datePublished));
await writeFile("data/news-index.json",JSON.stringify(all,null,2)+"\n");
const urls=["https://technology.trux.website/","https://technology.trux.website/news/welcome.html",...generated.map(x=>"https://technology.trux.website"+x.url)];
await writeFile("sitemap.xml",'<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+urls.map(u=>"<url><loc>"+u+"</loc></url>").join("")+"</urlset>\n");
await writeFile("rss.xml",'<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>TruX Technology</title><link>https://technology.trux.website/</link><description>Official TruX-AI news.</description>'+all.slice(0,30).map(x=>"<item><title>"+esc(x.headline)+"</title><link>https://technology.trux.website"+x.url+"</link><pubDate>"+new Date(x.datePublished).toUTCString()+"</pubDate><description>"+esc(x.description)+"</description></item>").join("")+"</channel></rss>\n");
