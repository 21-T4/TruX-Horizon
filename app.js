(()=>{
const $=(s,r=document)=>r.querySelector(s);
const esc=s=>String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));
const reduce=matchMedia("(prefers-reduced-motion: reduce)").matches;
const fine=matchMedia("(pointer:fine)").matches;
const state={items:[],cat:"All",q:""};
const fmt=d=>new Date(d).toLocaleDateString(undefined,{year:"numeric",month:"short",day:"numeric"});

/* ---------- effects layer: particles + cursor glow ---------- */
const body=document.body;
const vig=document.createElement("div");vig.className="vignette";body.prepend(vig);
const mouse={x:-9999,y:-9999,gx:innerWidth/2,gy:innerHeight/3};
addEventListener("pointermove",e=>{mouse.x=e.clientX;mouse.y=e.clientY},{passive:true});
addEventListener("pointerleave",()=>{mouse.x=mouse.y=-9999});

if(!reduce){
  const cv=document.createElement("canvas");cv.id="fx";body.prepend(cv);
  const ctx=cv.getContext("2d");
  let W,H,dpr,pts=[];
  const size=()=>{
    dpr=Math.min(2,devicePixelRatio||1);W=cv.width=innerWidth*dpr;H=cv.height=innerHeight*dpr;
    const n=Math.min(95,Math.floor(innerWidth*innerHeight/15000));
    pts=Array.from({length:n},()=>({x:Math.random()*W,y:Math.random()*H,vx:(Math.random()-.5)*.25*dpr,vy:(Math.random()-.5)*.25*dpr,r:(Math.random()*1.3+.4)*dpr}));
  };
  size();addEventListener("resize",size);
  let run=true;document.addEventListener("visibilitychange",()=>{run=!document.hidden;if(run)tick()});
  function tick(){
    if(!run)return;
    ctx.clearRect(0,0,W,H);
    const mx=mouse.x*dpr,my=mouse.y*dpr;
    for(const p of pts){
      p.x+=p.vx;p.y+=p.vy;
      if(p.x<0||p.x>W)p.vx*=-1;if(p.y<0||p.y>H)p.vy*=-1;
      const dx=p.x-mx,dy=p.y-my,d=Math.hypot(dx,dy);
      if(d<170*dpr){const f=(1-d/(170*dpr))*.6;p.x+=dx/d*f*dpr;p.y+=dy/d*f*dpr}
      ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,6.283);ctx.fillStyle="rgba(235,235,255,.55)";ctx.fill();
    }
    const L=150*dpr;
    for(let i=0;i<pts.length;i++)for(let j=i+1;j<pts.length;j++){
      const a=pts[i],b=pts[j],d=Math.hypot(a.x-b.x,a.y-b.y);
      if(d<L){ctx.strokeStyle="rgba(150,160,255,"+(.16*(1-d/L)).toFixed(3)+")";ctx.lineWidth=dpr*.7;ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke()}
    }
    requestAnimationFrame(tick);
  }
  tick();
}
if(!reduce&&fine){
  const g=document.createElement("div");g.className="cursor-glow";body.prepend(g);
  (function loop(){
    if(mouse.x>-9000){mouse.gx+=(mouse.x-mouse.gx)*.08;mouse.gy+=(mouse.y-mouse.gy)*.08}
    g.style.transform="translate3d("+mouse.gx+"px,"+mouse.gy+"px,0)";
    requestAnimationFrame(loop);
  })();
}

/* ---------- word-by-word headline reveal ---------- */
function split(el){
  let i=0;
  const walk=(node,grad)=>{
    [...node.childNodes].forEach(n=>{
      if(n.nodeType===3){
        const frag=document.createDocumentFragment();
        n.textContent.split(/(\s+)/).forEach(t=>{
          if(!t)return;
          if(/^\s+$/.test(t)){frag.append(" ");return}
          const w=document.createElement("span");w.className="w";
          const s=document.createElement("span");s.textContent=t;s.style.setProperty("--i",i++);
          if(grad)s.classList.add("grad");
          w.append(s);frag.append(w);
        });
        n.replaceWith(frag);
      }else if(n.nodeType===1)walk(n,grad||n.tagName==="EM");
    });
  };
  walk(el,false);
}
if(!reduce)document.querySelectorAll("[data-split]").forEach(split);

/* ---------- scroll reveal ---------- */
let io;
function reveal(root=document){
  const els=[...root.querySelectorAll(".rv:not(.in),.rule:not(.in)")];
  const finish=e=>{e.classList.add("in");setTimeout(()=>e.classList.add("done"),1100)};
  if(!("IntersectionObserver" in window)||reduce){els.forEach(finish);return}
  io=io||new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){finish(e.target);io.unobserve(e.target)}}),{threshold:.1});
  els.forEach(e=>io.observe(e));
}

/* ---------- pointer interactions: spotlight, 3D tilt, magnetic buttons ---------- */
document.addEventListener("pointermove",e=>{
  const t=e.target.closest?e.target:null;if(!t)return;
  const c=t.closest(".card,.topics article,.lead,.panel");
  if(c){
    const r=c.getBoundingClientRect(),x=e.clientX-r.left,y=e.clientY-r.top;
    c.style.setProperty("--mx",x+"px");c.style.setProperty("--my",y+"px");
    if(c.classList.contains("card")&&!reduce){
      c.style.setProperty("--ry",((x/r.width-.5)*9).toFixed(2)+"deg");
      c.style.setProperty("--rx",((.5-y/r.height)*9).toFixed(2)+"deg");
    }
  }
  if(!reduce){
    const b=t.closest(".try,.outline");
    if(b){const r=b.getBoundingClientRect();b.style.setProperty("--tx",((e.clientX-r.left-r.width/2)*.22).toFixed(1)+"px");b.style.setProperty("--ty",((e.clientY-r.top-r.height/2)*.3).toFixed(1)+"px")}
  }
},{passive:true});
document.addEventListener("pointerout",e=>{
  const c=e.target.closest&&e.target.closest(".card");
  if(c&&!c.contains(e.relatedTarget)){c.style.setProperty("--rx","0deg");c.style.setProperty("--ry","0deg")}
  const b=e.target.closest&&e.target.closest(".try,.outline");
  if(b&&!b.contains(e.relatedTarget)){b.style.setProperty("--tx","0px");b.style.setProperty("--ty","0px")}
});

/* ---------- reading progress ---------- */
let bar=$(".progress");
if(!bar){bar=document.createElement("div");bar.className="progress";body.prepend(bar)}
const prog=()=>{const h=document.documentElement.scrollHeight-innerHeight;bar.style.width=(h>0?Math.min(100,scrollY/h*100):0)+"%"};
addEventListener("scroll",prog,{passive:true});prog();

/* ---------- share button ---------- */
const share=$("#share");
if(share)share.addEventListener("click",async()=>{
  try{
    if(navigator.share){await navigator.share({title:share.dataset.title,url:share.dataset.url});return}
    await navigator.clipboard.writeText(share.dataset.url);
    share.textContent="Link copied ✓";setTimeout(()=>share.textContent="Share update",2000);
  }catch{}
});

/* ---------- counter ---------- */
function countTo(el,to){
  if(reduce||to===0){el.textContent=to;return}
  const t0=performance.now(),dur=1000;
  const step=t=>{const p=Math.min(1,(t-t0)/dur);el.textContent=Math.round(to*(1-Math.pow(1-p,3)));if(p<1)requestAnimationFrame(step)};
  requestAnimationFrame(step);
}

/* ---------- feed ---------- */
const feed=$("#feed");
if(feed)load();

async function load(){
  $("#lead").innerHTML="";
  feed.innerHTML='<div class="skel"></div><div class="skel"></div><div class="skel"></div>';
  try{
    const r=await fetch("/data/news-index.json?t="+Date.now(),{cache:"no-store"});
    if(!r.ok)throw new Error("Feed returned HTTP "+r.status);
    const data=await r.json();
    if(!Array.isArray(data))throw new Error("Feed format is invalid");
    state.items=data.filter(x=>x&&x.headline&&x.url).sort((a,b)=>new Date(b.datePublished)-new Date(a.datePublished));
  }catch(err){
    feed.innerHTML='<div class="empty"><b>Updates unavailable</b><p>'+esc(err.message||"Could not load updates.")+'</p><button class="outline" id="retry" type="button">Try again</button></div>';
    $("#retry").onclick=load;return;
  }
  countTo($("#statCount"),state.items.length);
  $("#statLast").textContent=state.items[0]?fmt(state.items[0].dateModified||state.items[0].datePublished):"—";
  chips();draw();
  const s=$("#search");if(!s.dataset.on){s.dataset.on=1;s.addEventListener("input",e=>{state.q=e.target.value.trim().toLowerCase();draw()})}
}

function chips(){
  const cats=["All",...new Set(state.items.map(x=>x.category||"Update"))];
  const box=$("#chips");
  box.innerHTML=cats.length>2?cats.map(c=>'<button class="chip'+(c===state.cat?" on":"")+'" data-c="'+esc(c)+'" type="button">'+esc(c)+'</button>').join(""):"";
  box.onclick=e=>{const b=e.target.closest(".chip");if(!b)return;state.cat=b.dataset.c;chips();draw()};
}

function draw(){
  const lead=$("#lead");
  const list=state.items.filter(x=>(state.cat==="All"||(x.category||"Update")===state.cat)&&(!state.q||(x.headline+" "+x.description+" "+x.category).toLowerCase().includes(state.q)));
  if(!state.items.length){lead.innerHTML="";feed.innerHTML='<div class="empty"><b>No updates yet</b><p>The first update will appear here as soon as it is published.</p></div>';return}
  if(!list.length){lead.innerHTML="";feed.innerHTML='<div class="empty"><b>No matching updates</b><p>Try a different search or category.</p></div>';return}
  const first=list[0],rest=list.slice(1);
  const art=first.image?' img" style="background-image:url(\''+esc(first.image)+'\')':'';
  lead.innerHTML='<article class="lead rv"><div class="lead-body"><span class="badge-new">LATEST UPDATE</span><h3>'+esc(first.headline)+'</h3><p>'+esc(first.description)+'</p><div class="meta" style="margin-top:22px;justify-content:flex-start;gap:16px"><span class="tag">'+esc(first.category||"Update")+'</span><span>'+fmt(first.datePublished)+'</span>'+(first.readMinutes?'<span>'+first.readMinutes+' min read</span>':"")+'</div><a class="read stretch" href="'+esc(first.url)+'">Read update ↗</a></div><div class="lead-art'+art+'"><b>01</b></div></article>';
  feed.innerHTML=rest.map((x,i)=>{
    const th=x.image?'<div class="thumb" style="background-image:url(\''+esc(x.image)+'\')"></div>':"";
    return '<article class="card rv" style="--d:'+Math.min(i*.08,.6)+'s">'+th+'<div class="meta"><span class="tag">'+esc(x.category||"Update")+'</span><span>'+fmt(x.datePublished)+'</span></div><h3>'+esc(x.headline)+'</h3><p>'+esc(x.description)+'</p><a class="read stretch" href="'+esc(x.url)+'">Read update ↗</a></article>';
  }).join("");
  reveal();
}

reveal();
})();
