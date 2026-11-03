(()=>{
const $=(s,r=document)=>r.querySelector(s);
const esc=s=>String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));
const reduce=matchMedia("(prefers-reduced-motion: reduce)").matches;
const state={items:[],cat:"All",q:""};
const fmt=d=>new Date(d).toLocaleDateString(undefined,{year:"numeric",month:"short",day:"numeric"});
const ago=d=>{const s=(Date.now()-new Date(d))/1000;if(s<60)return"just now";if(s<3600)return Math.floor(s/60)+"m ago";if(s<86400)return Math.floor(s/3600)+"h ago";if(s<2592000)return Math.floor(s/86400)+"d ago";return fmt(d)};

/* scroll reveal */
let io;
function reveal(root=document){
  const els=[...root.querySelectorAll(".rv:not(.in)")];
  if(!("IntersectionObserver" in window)||reduce){els.forEach(e=>e.classList.add("in"));return}
  io=io||new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){e.target.classList.add("in");io.unobserve(e.target)}}),{threshold:.1});
  els.forEach(e=>io.observe(e));
}

/* mouse spotlight on cards */
document.addEventListener("pointermove",e=>{
  const c=e.target.closest&&e.target.closest(".card,.topics article,.lead");
  if(!c)return;
  const r=c.getBoundingClientRect();
  c.style.setProperty("--mx",(e.clientX-r.left)+"px");
  c.style.setProperty("--my",(e.clientY-r.top)+"px");
},{passive:true});

/* reading progress (article pages) */
const bar=$(".progress");
if(bar){
  const f=()=>{const h=document.documentElement.scrollHeight-innerHeight;bar.style.width=(h>0?Math.min(100,scrollY/h*100):0)+"%"};
  addEventListener("scroll",f,{passive:true});f();
}

/* share button (article pages) */
const share=$("#share");
if(share)share.addEventListener("click",async()=>{
  const url=share.dataset.url,title=share.dataset.title;
  try{
    if(navigator.share){await navigator.share({title,url});return}
    await navigator.clipboard.writeText(url);
    share.textContent="Link copied ✓";setTimeout(()=>share.textContent="Share story",2000);
  }catch{}
});

/* clock */
const clock=$("#clock");
if(clock){const t=()=>clock.textContent=new Date().toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"});t();setInterval(t,30000)}

/* counter animation */
function countTo(el,to){
  if(reduce||to===0){el.textContent=to;return}
  const t0=performance.now(),dur=900;
  const step=t=>{const p=Math.min(1,(t-t0)/dur);el.textContent=Math.round(to*(1-Math.pow(1-p,3)));if(p<1)requestAnimationFrame(step)};
  requestAnimationFrame(step);
}

/* feed */
const feed=$("#feed");
if(feed)load();

async function load(){
  const lead=$("#lead");
  lead.innerHTML="";
  feed.innerHTML='<div class="skel"></div><div class="skel"></div><div class="skel"></div>';
  try{
    const r=await fetch("/data/news-index.json?t="+Date.now(),{cache:"no-store"});
    if(!r.ok)throw new Error("Feed returned HTTP "+r.status);
    const data=await r.json();
    if(!Array.isArray(data))throw new Error("Feed format is invalid");
    state.items=data.filter(x=>x&&x.headline&&x.url).sort((a,b)=>new Date(b.datePublished)-new Date(a.datePublished));
  }catch(err){
    feed.innerHTML='<div class="empty"><b>News feed unavailable</b><p>'+esc(err.message||"Could not load stories.")+'</p><button class="outline" id="retry" type="button">Try again</button></div>';
    $("#retry").onclick=load;
    return;
  }
  stats();ticker();chips();draw();
  $("#search").addEventListener("input",e=>{state.q=e.target.value.trim().toLowerCase();draw()});
}

function stats(){
  countTo($("#statCount"),state.items.length);
  $("#statLast").textContent=state.items[0]?ago(state.items[0].dateModified||state.items[0].datePublished):"—";
}

function ticker(){
  const el=$("#ticker");
  if(!state.items.length)return;
  const html=state.items.slice(0,10).map(x=>'<a href="'+esc(x.url)+'">'+esc(x.headline)+'</a>').join("");
  el.innerHTML=html+html; /* duplicated for a seamless loop */
  el.style.animationDuration=Math.max(30,state.items.slice(0,10).length*9)+"s";
}

function chips(){
  const cats=["All",...new Set(state.items.map(x=>x.category||"Update"))];
  const box=$("#chips");
  box.innerHTML=cats.map(c=>'<button class="chip'+(c===state.cat?" on":"")+'" data-c="'+esc(c)+'" type="button">'+esc(c)+'</button>').join("");
  box.onclick=e=>{const b=e.target.closest(".chip");if(!b)return;state.cat=b.dataset.c;chips();draw()};
}

function draw(){
  const lead=$("#lead");
  let list=state.items.filter(x=>(state.cat==="All"||(x.category||"Update")===state.cat)&&(!state.q||(x.headline+" "+x.description+" "+x.category).toLowerCase().includes(state.q)));
  if(!state.items.length){lead.innerHTML="";feed.innerHTML='<div class="empty"><b>No stories yet</b><p>The first story will appear here as soon as it is published.</p></div>';return}
  if(!list.length){lead.innerHTML="";feed.innerHTML='<div class="empty"><b>No matching stories</b><p>Try a different search or category.</p></div>';return}
  const first=list[0],rest=list.slice(1);
  const art=first.image?'style="background-image:url(\''+esc(first.image)+'\')"':"";
  lead.innerHTML='<article class="lead rv"><div class="lead-body"><span class="badge-new"><i></i>LATEST · '+esc(ago(first.datePublished)).toUpperCase()+'</span><h3>'+esc(first.headline)+'</h3><p>'+esc(first.description)+'</p><div class="meta" style="margin-top:22px;justify-content:flex-start;gap:16px"><span class="tag">'+esc(first.category||"Update")+'</span><span>'+fmt(first.datePublished)+'</span>'+(first.readMinutes?'<span>'+first.readMinutes+' min read</span>':"")+'</div><a class="read stretch" href="'+esc(first.url)+'">Read story ↗</a></div><div class="lead-art" '+art+'><b>01</b></div></article>';
  feed.innerHTML=rest.map((x,i)=>{
    const th=x.image?'<div class="thumb" style="background-image:url(\''+esc(x.image)+'\')"></div>':"";
    return '<article class="card rv" style="--d:'+Math.min(i*.07,.5)+'s">'+th+'<div class="meta"><span class="tag">'+esc(x.category||"Update")+'</span><span>'+fmt(x.datePublished)+'</span></div><h3>'+esc(x.headline)+'</h3><p>'+esc(x.description)+'</p><a class="read stretch" href="'+esc(x.url)+'">Read story ↗</a></article>';
  }).join("");
  reveal();
}

reveal();
})();
