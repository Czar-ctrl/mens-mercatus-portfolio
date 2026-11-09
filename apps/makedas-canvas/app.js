/* Mercatus Concierge — Mens Mercatus builder shell */
(function () {
  "use strict";
  const LS = { hero:"mc-hero", theme:"mc-theme", project:"mc-project", intent:"mc-intent", art:"mc-art", paint:"mc-paint", sheet:"mc-sheet", recruit:"mc-recruit", estate:"mc-estate", team:"mc-team", roles:"mc-roles", seenDir:"mc-seen-dir", glass:"mc-glass", motion:"mc-motion", lastView:"mc-last-view", lastStage:"mc-last-stage", railCollapsed:"mc-rail-collapsed", showOverview:"mc-show-overview" };
  const STAGES = [
    {id:"home",label:"Home",blurb:"Start here"},
    {id:"intent",label:"Plan",blurb:"Project brief seeds the flow"},
    {id:"design",label:"Design",blurb:"Theme + artboard copy"},
    {id:"chat",label:"Chat",blurb:"Plan / Build rail"},
    {id:"studio",label:"Studio",blurb:"Editable preview pane"},
    {id:"atelier",label:"Concierge overview",blurb:"Mercatus Concierge overview"},
    {id:"paint",label:"Paint",blurb:"True drawing canvas"},
    {id:"ops",label:"Ops Launch",blurb:"Sheet · recruit · estate · AI team"},
    {id:"launch",label:"Launch Path",blurb:"Venture coach · 7 stages · vault"},
    {id:"portal",label:"Client Portal",blurb:"Atelier Desk mock"},
    {id:"ide",label:"IDE",blurb:"Bolt file tree + terminal"},
    {id:"slides",label:"Slides",blurb:"Interactive deck"},
    {id:"roles",label:"Role Kits",blurb:"Role kits switcher"},
    {id:"habit",label:"Focus",blurb:"Habit + Pomodoro lite"},
    {id:"games",label:"Games",blurb:"Mini arcade hub"},
    {id:"meeting",label:"Meeting Desk",blurb:"Recall.ai–lite diarized mock"},
    {id:"replit",label:"Agent Lab",blurb:"Kanban · security · deploy · secrets"},
    {id:"settings",label:"Settings",blurb:"Shell + domains"}
  ];
  const THEME_LABELS = {cartel:"Maison",cream:"Cream atelier",night:"Night Shift",neo:"Neobrutalist",mono:"Monochrome"};
  const ROLE_HINTS = {marketers:"Campaign hub · UTM · funnel · checklist.",sales:"Pipeline Kanban · attribution rail.",ops:"Approval queue · request intake.",people:"Hiring + searchable team directory.",designers:"Moodboard · brand kit · palette gen · stack.",product:"Roadmap Now/Next/Later · upvotes.",founders:"Funding · waitlist · OKRs."};
  const PROMPTS = [
    {label:"Attach brand PDF",text:"Use attached brand guidelines PDF to align Blueprint tokens."},
    {label:"Moodboard image",text:"Derive palette from the attached moodboard image."},
    {label:"Wireframe screenshot",text:"Mirror this wireframe layout in the studio artboard."},
    {label:"Competitor capture",text:"Summarize UX patterns from the attached competitor screenshot."}
  ];
  /* Default look is Maison (cartel). A saved look is respected only if it is a real theme id. */
  function storedTheme(){ let t=null; try{ t=localStorage.getItem(LS.theme); }catch(_){} return (t && Object.prototype.hasOwnProperty.call(THEME_LABELS,t)) ? t : "cartel"; }
  /* Typing safety: true for any text-entry target (input, textarea, select, contenteditable) */
  function isEditable(el){ if(!el||el.nodeType!==1) return false; if(el.isContentEditable) return true; const tag=el.tagName; if(tag==="TEXTAREA"||tag==="SELECT") return true; if(tag==="INPUT"){ const ty=(el.type||"text").toLowerCase(); return !["button","submit","reset","checkbox","radio","range","color","file","image","hidden"].includes(ty); } return false; }
  window.MCIsEditable=isEditable;
  /* Re-render a region without losing the field the user is typing in (value, caret, scroll) */
  function keepFocus(root, fn){
    const a=document.activeElement; let key=null, s0=null, s1=null, val=null, sc=0, tag="";
    if(a && root && root.contains(a) && isEditable(a)){
      tag=a.dataset.stage||"";
      if(a.id) key="#"+CSS.escape(a.id); else if(a.dataset.r!=null) key=`[data-r="${a.dataset.r}"][data-c="${a.dataset.c}"]`; else if(a.dataset.pal!=null) key=`[data-pal="${a.dataset.pal}"]`;
      try{ s0=a.selectionStart; s1=a.selectionEnd; }catch(_){}
      val=("value" in a)?a.value:null; sc=a.scrollTop||0;
    }
    fn();
    if(!key) return;
    const n=root.querySelector(key); if(!n || (n.dataset.stage||"")!==tag) return;
    if(val!=null && n.value!==val) n.value=val;
    n.focus({preventScroll:true}); try{ if(s0!=null) n.setSelectionRange(s0,s1); }catch(_){} n.scrollTop=sc;
  }
  window.MCKeepFocus=keepFocus;
  let state = { stage:"home", mode:"plan", tool:"select", theme:storedTheme(), pendingTheme:null, attachments:[], done:new Set(["intent"]), role:"marketers", opsTab:"sheet", glass:localStorage.getItem(LS.glass)==="1", motion:localStorage.getItem(LS.motion)==="1" };
  const $ = (s,el=document)=>el.querySelector(s);
  const $$ = (s,el=document)=>[...el.querySelectorAll(s)];
  window.MCToast = toast;
  function toast(msg,ms){ const t=$("#toast"); if(!t)return; t.textContent=msg; t.hidden=false; toast._at=performance.now(); toast._stage=state.stage; clearTimeout(toast._tm); toast._tm=setTimeout(()=>{ t.hidden=true; },ms||2600); }
  /* Hide a toast that belongs to the previous pane (anything older than ~0.6s) */
  function dropStaleToast(){ const t=$("#toast"); if(!t || t.hidden) return; if(performance.now()-(toast._at||0)<120) return; t.hidden=true; clearTimeout(toast._tm); }
  function escapeHtml(s){ return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); }
  function applyTheme(id){ state.theme=id; document.documentElement.setAttribute("data-theme",id); localStorage.setItem(LS.theme,id); const lab=$("#active-theme-label"); if(lab)lab.textContent=THEME_LABELS[id]||id; const lab2=$("#settings-theme-label"); if(lab2)lab2.textContent=THEME_LABELS[id]||id; $$(".direction-card").forEach(c=>{ const on=c.dataset.theme===id; c.classList.toggle("is-selected",on); c.setAttribute("aria-pressed",on?"true":"false"); }); }
  function setNav(mode){ document.documentElement.setAttribute("data-nav",mode); const ov=$("#overview-floor"); if(ov)ov.hidden=mode!=="overview"; const btn=$("#btn-overview"); if(btn)btn.setAttribute("aria-pressed",mode==="overview"?"true":"false"); }
  function setGlass(on){ state.glass=on; document.documentElement.classList.toggle("mc-glass",on); localStorage.setItem(LS.glass,on?"1":"0"); const ck=$("#opt-glass"); if(ck)ck.checked=on; }
  function setMotion(on){ state.motion=on; document.documentElement.classList.toggle("mc-motion",on); localStorage.setItem(LS.motion,on?"1":"0"); const ck=$("#opt-motion"); if(ck)ck.checked=on; }

  function renderPuzzle(){
    const track=$("#puzzle-track"), grid=$("#tile-grid"); if(!track||!grid)return;
    track.innerHTML=""; grid.innerHTML="";
    STAGES.forEach((s,i)=>{
      const piece=document.createElement("button"); piece.type="button";
      piece.className="puzzle-piece"+(s.id===state.stage?" is-active":"")+(state.done.has(s.id)?" is-done":"");
      piece.setAttribute("role","listitem"); piece.innerHTML=`<span class="pz-num">${i+1}</span><span>${s.label}</span>`;
      piece.addEventListener("click",()=>goStage(s.id)); track.appendChild(piece);
      const tile=document.createElement("button"); tile.type="button";
      tile.className="floor-tile"+(s.id===state.stage?" is-active":""); tile.setAttribute("role","listitem");
      tile.innerHTML=`<span class="ft-num">Stage ${i+1}</span><div><strong>${s.label}</strong><p>${s.blurb}</p></div>`;
      tile.addEventListener("click",()=>{ setNav("flow"); goStage(s.id); }); grid.appendChild(tile);
    });
  }

  window.MCGoStage = goStage;
  /* Layout per stage: "full" = stage pane only, "split" = context panel + stage, "panel" = context panel only */
  const LAYOUT = {home:"full",intent:"panel",settings:"panel",design:"split",chat:"split",studio:"split",atelier:"split",paint:"split",ops:"full",launch:"full",roles:"full",portal:"full",ide:"full",slides:"full",habit:"full",games:"full",meeting:"full",replit:"full"};
  const PANE_FOR = {design:"studio",chat:"studio",studio:"studio"};
  const STUDIO_LABELS = {
    design:["Live preview","Headline, subline and look edits on the left show up here."],
    chat:["Live preview","Pages you build in Chat appear here. Follow-ups update them."],
    studio:["Studio","Select, edit text, annotate or comment directly on the page."]
  };
  const PANE_HEADS = {
    ops:{group:"Run",title:"Ops Launch",sub:"Spreadsheet desk, recruiting pipeline, deal strip and AI team roster. Everything saves in this browser."},
    launch:{group:"Run",title:"Launch Path",sub:"Seven venture stages. Submit an asset, get an honest score out of 100 with feedback, and unlock the next stage at the pass mark. Local heuristic — not AI.",action:{label:"Write my submission",fn:()=>{ const t=document.getElementById("lp-submit"); if(t){ t.scrollIntoView({block:"center",behavior:"smooth"}); t.focus(); } }}},
    roles:{group:"Run",title:"Role Kits",sub:"Ready-made desks for marketing, sales, ops, people, design, product and founders. Pick a kit to switch."},
    portal:{group:"Run",title:"Client Portal",sub:"A mock client desk: demo one-time-code login, orders, invoices and messages. No real sign-in or payments."},
    meeting:{group:"Run",title:"Meeting Desk",sub:"Mock meeting recorder with speaker lanes, a post-call summary and call prep. No live bot joins your calls."},
    replit:{group:"Run",title:"Agent Lab",sub:"Local stubs: agent Kanban, security checklist, deploy picker, secrets vault (demo only — never paste real keys) and design frames."},
    slides:{group:"Present",title:"Slides",sub:"A short deck with speaker notes, present mode and a demo password gate.",action:{label:"Present",fn:()=>document.getElementById("sl-present")?.click()}},
    ide:{group:"Present",title:"IDE",sub:"Mock file tree, terminal and preview with a post-build self-check. Nothing actually runs."},
    habit:{group:"Other",title:"Focus",sub:"Log builder sessions and run a 25-minute Pomodoro timer.",action:{label:"Start 25 min",fn:()=>document.getElementById("pomo-go")?.click()}},
    games:{group:"Other",title:"Games",sub:"Three quick mini games for a break: click-collect, bubble pop and a reaction pad."}
  };
  function stageLabel(id){ const s=STAGES.find(x=>x.id===id); return s?s.label:id; }
  function ensurePaneHead(id){
    const cfg=PANE_HEADS[id]; if(!cfg) return;
    const pane=$(`.stage-pane[data-pane="${id}"]`); if(!pane || pane.querySelector(":scope > .pane-head")) return;
    const head=document.createElement("header"); head.className="pane-head";
    head.innerHTML=`<div class="pane-head-text"><p class="eyebrow">${escapeHtml(cfg.group)}</p><h1>${escapeHtml(cfg.title)}</h1><p class="pane-sub">${escapeHtml(cfg.sub)}</p></div><div class="pane-actions"></div>`;
    if(cfg.action){ const b=document.createElement("button"); b.type="button"; b.className="btn btn-primary"; b.textContent=cfg.action.label; b.addEventListener("click",cfg.action.fn); head.querySelector(".pane-actions").appendChild(b); }
    if(id==="ops"){ const tabs=$(".ops-tabs"); const hint=$("#ops-hint"); const extra=document.createElement("div"); extra.className="pane-head-extra"; if(tabs)extra.appendChild(tabs); if(hint)extra.appendChild(hint); head.appendChild(extra); }
    if(id==="roles"){ const sw=$("#role-switcher"); const field=sw&&sw.closest(".field"); if(field){ field.classList.add("field-inline"); head.querySelector(".pane-actions").appendChild(field); } }
    pane.prepend(head);
  }
  function setNavOpen(open){
    const was=document.documentElement.classList.contains("nav-open");
    document.documentElement.classList.toggle("nav-open",open);
    const bd=$("#nav-backdrop"); if(bd) bd.hidden=!open;
    ["#btn-nav-toggle","#btn-bb-more"].forEach(sel=>{ const b=$(sel); if(b) b.setAttribute("aria-expanded",open?"true":"false"); });
    const t=$("#btn-nav-toggle"); if(t) t.setAttribute("aria-label",open?"Close navigation menu":"Open navigation menu");
    if(open && !was){ const a=$(".rail-btn.is-active")||$(".rail-btn"); a?.focus(); }
  }
  function goStage(id, opts){
    opts=opts||{};
    if(!LAYOUT[id]) id="home";
    state.stage=id; state.done.add(id); dropStaleToast();
    const layout=LAYOUT[id], pane = layout==="panel" ? null : (PANE_FOR[id]||id);
    document.documentElement.setAttribute("data-stage",id);
    const body=$("#flow-body"); if(body) body.dataset.layout=layout;
    $$(".rail-btn").forEach(b=>{ const on=b.dataset.stage===id; b.classList.toggle("is-active",on); b.setAttribute("aria-selected",on?"true":"false"); b.removeAttribute("aria-pressed"); });
    $$(".bb-btn[data-goto]").forEach(b=>{ const on=b.dataset.goto===id; b.classList.toggle("is-active",on); if(on) b.setAttribute("aria-current","page"); else b.removeAttribute("aria-current"); });
    $$(".panel-view").forEach(p=>{ const on=p.dataset.view===id && layout!=="full"; p.hidden=!on; p.classList.toggle("is-active",on); });
    if(id==="games") games.render();
    $$(".stage-pane").forEach(p=>{ p.hidden = p.dataset.pane!==pane; });
    const tb=$("#preview-toolbar"); if(tb) tb.hidden = id!=="studio";
    if(id!=="studio" && state.tool!=="select" && $("#artboard")) studio.setTool("select");
    if(STUDIO_LABELS[id]){ const lab=STUDIO_LABELS[id]; const te=$("#studio-pane-title"), he=$("#studio-pane-hint"); if(te)te.textContent=lab[0]; if(he)he.textContent=lab[1]; }
    const crumb=$("#topbar-crumb"); if(crumb) crumb.textContent=stageLabel(id);
    document.title = (id==="home"?"":stageLabel(id)+" · ")+"Mercatus Concierge · Mens Mercatus";
    try{ localStorage.setItem(LS.lastView,id); if(id!=="home") localStorage.setItem(LS.lastStage,id); }catch(_){}
    if(!opts.keepHash){ try{ history.replaceState(null,"","#"+id); }catch(_){} }
    setNavOpen(false);
    if(id==="home") renderHome();
    if(id==="studio"||id==="design"||id==="chat") requestAnimationFrame(()=>studio.resizeAnn());
    if(id==="paint") paint.ensure();
    if(id==="ops") ops.render();
    if(id==="launch" && window.MCLaunch) window.MCLaunch.mount(document.getElementById("launch-host"));
    if(id==="replit" && window.MCReplit) window.MCReplit.render();
    if(id==="meeting" && window.MCMeeting) window.MCMeeting.render();
    if(id==="roles") roles.render();
    if(id==="portal" && window.MCPortal) window.MCPortal.mount(document.getElementById("portal-host"));
    if(id==="ide" && window.MCBolt) window.MCBolt.renderIde(document.getElementById("ide-host"));
    if(id==="slides" && window.MCBolt) window.MCBolt.renderSlides(document.getElementById("slides-host"));
    if(id==="habit" && window.MCBolt) window.MCBolt.renderHabit(document.getElementById("habit-host"));
    if(id==="atelier") syncOverview();
    ensurePaneHead(id);
    labelUnnamed($("#stage"));
    const st=$("#stage"); if(st) st.scrollTop=0;
    const lp=$("#left-panel"); if(lp) lp.scrollTop=0;
    if(opts.focus){ const h=(layout==="full") ? $(`.stage-pane[data-pane="${pane}"] h1`) : $(`.panel-view[data-view="${id}"] h1`); if(h){ h.setAttribute("tabindex","-1"); h.focus({preventScroll:true}); } }
  }
  function renderHome(){
    const last=localStorage.getItem(LS.lastStage);
    const wrap=$("#home-resume"), btn=$("#home-resume-btn");
    if(wrap&&btn){ if(last && last!=="home" && LAYOUT[last]){ wrap.hidden=false; btn.textContent="Continue in "+stageLabel(last)+" →"; btn.onclick=()=>goStage(last,{focus:true}); } else wrap.hidden=true; }
    const snap=$("#home-snapshot"); if(!snap) return;
    const intent=(localStorage.getItem(LS.intent)||"").trim();
    let best=0, stageName="Stage 1";
    try{ const p=window.MCLaunch?window.MCLaunch.loadPath():null; if(p&&p.stages){ best=Math.max(0,...Object.values(p.stages).map(x=>x.best||0)); const a=window.MCLaunch.STAGES.find(x=>x.id===p.active); if(a) stageName="Stage "+a.id+" · "+a.name; } }catch(_){}
    snap.innerHTML=`<h2 class="home-h2">Your project</h2><div class="snap-grid">
      <div class="snap-card"><p class="eyebrow">Brief</p><p>${intent?escapeHtml(intent.slice(0,160)):"No brief yet."}</p><button type="button" class="btn btn-ghost btn-sm" data-goto="intent">${intent?"Edit brief":"Write a brief"}</button></div>
      <div class="snap-card"><p class="eyebrow">Launch Path</p><p>${best?`Best score ${best}/100 · now on ${escapeHtml(stageName)}`:"Not scored yet. The Stage 1 pass mark is 60/100."}</p><button type="button" class="btn btn-ghost btn-sm" data-goto="launch">${best?"Keep going":"Get your first score"}</button></div>
      <div class="snap-card"><p class="eyebrow">Look</p><p>${escapeHtml(THEME_LABELS[state.theme]||state.theme)}</p><button type="button" class="btn btn-ghost btn-sm" data-open-look>Change look</button></div>
    </div>`;
  }
  function syncOverview(){
    const show = localStorage.getItem(LS.showOverview)!=="0";
    const ck=$("#opt-show-iframe"); if(ck) ck.checked=show;
    const nat=$("#atelier-iframe"), fb=$("#iframe-fallback");
    if(nat) nat.hidden=!show;
    if(fb) fb.hidden=show;
    if(show) renderHub();
  }
  /* Concierge hub: recent work, status and quick actions, all read from this browser */
  function renderHub(){
    const host=$("#atelier-iframe"); if(!host) return;
    const get=k=>{ try{ return localStorage.getItem(k); }catch(_){ return null; } };
    const brief=(get(LS.intent)||"").trim(); const site=window.MCBuilder?window.MCBuilder.load():null;
    let best=0, stageName="Stage 1"; try{ const p=window.MCLaunch?window.MCLaunch.loadPath():null; if(p&&p.stages){ best=Math.max(0,...Object.values(p.stages).map(x=>x.best||0)); const a=window.MCLaunch.STAGES.find(x=>x.id===p.active); if(a) stageName="Stage "+a.id+" · "+a.name; } }catch(_){}
    const sessions=+(get("mc-habit")||0); const painted=!!get(LS.paint);
    let ideEdits=0; try{ const f=JSON.parse(get("mc-ide-files")||"null"); if(f) ideEdits=Object.keys(f.files||{}).length; }catch(_){}
    let bytes=0; try{ for(let i=0;i<localStorage.length;i++){ const k=localStorage.key(i); if(/^mc-/.test(k)) bytes+=(localStorage.getItem(k)||"").length*2; } }catch(_){}
    const last=get(LS.lastStage);
    const row=(label,val,goto,btn)=>`<div class="hub-row"><div><p class="eyebrow">${label}</p><p>${val}</p></div><button type="button" class="btn btn-ghost btn-sm" data-goto="${goto}">${btn}</button></div>`;
    host.innerHTML=`<div class="hub">
      <div class="hub-head"><p class="eyebrow">Concierge hub</p><h2 id="atelier-title">Your work at a glance</h2><p class="atelier-lead">Everything below is saved in this browser only.</p></div>
      <div class="hub-grid">
        <section class="hub-card"><h3>Recent work</h3>
          ${row("Brief", brief?escapeHtml(brief.slice(0,120)):"No brief yet", "intent", brief?"Edit":"Write one")}
          ${row("Landing page", site?`${escapeHtml(site.name)} · ${site.sections.length} sections · ${escapeHtml(site.palette)} palette`:"Not built yet", site?"studio":"chat", site?"Open Studio":"Build one")}
          ${row("Launch Path", best?`Best ${best}/100 · ${escapeHtml(stageName)}`:"Not scored yet", "launch", best?"Continue":"Start")}
          ${row("Paint", painted?"Drawing saved":"Blank canvas", "paint", "Open")}
        </section>
        <section class="hub-card"><h3>Quick actions</h3>
          <div class="hub-actions">
            <button type="button" class="btn btn-primary btn-sm" data-goto="chat">Build a page</button>
            <button type="button" class="btn btn-ghost btn-sm" data-goto="intent">Write a brief</button>
            <button type="button" class="btn btn-ghost btn-sm" data-goto="launch">Score my idea</button>
            <button type="button" class="btn btn-ghost btn-sm" data-goto="habit">Start a focus timer</button>
            <button type="button" class="btn btn-ghost btn-sm" data-goto="ide">Edit files</button>
            <button type="button" class="btn btn-ghost btn-sm" data-goto="slides">Present slides</button>
          </div>
          ${last&&last!=="atelier"&&LAYOUT[last]?`<p class="panel-copy small">Last place you worked: <button type="button" class="link-btn" data-goto="${last}">${escapeHtml(stageLabel(last))}</button></p>`:""}
        </section>
        <section class="hub-card"><h3>Status</h3>
          <ul class="hub-status">
            <li><span>Look</span><strong>${escapeHtml(THEME_LABELS[state.theme]||state.theme)}</strong></li>
            <li><span>Focus sessions</span><strong>${sessions}</strong></li>
            <li><span>IDE files</span><strong>${ideEdits||"Sample set"}</strong></li>
            <li><span>Saved data</span><strong>${(bytes/1024).toFixed(0)} KB in this browser</strong></li>
          </ul>
          <a class="btn btn-ghost btn-sm" href="/apps/makedas-canvas/" target="_blank" rel="noopener">Open a second copy in a new tab ↗</a>
        </section>
      </div></div>`;
  }

  
function addMsg(role,html){ const log=$("#chat-log"); if(!log)return; const div=document.createElement("div"); div.className="msg "+(role==="You"?"msg-user":"msg-bot"); div.innerHTML=`<div class="msg-role">${role}</div><div>${html}</div>`; log.appendChild(div); log.scrollTop=log.scrollHeight; }
  function planReply(text){
    if(state.stage==="launch" && window.MCLaunch){
      return window.MCLaunch.coachReply(text, window.MCLaunch.loadPath());
    }
    const brief=(($("#intent-text")&&$("#intent-text").value)||"").trim();
    if(window.MCBuilder) return window.MCBuilder.plan(text, brief);
    const intent=brief||"Untitled";
    const team=ops.getTeamNames();
    const path = window.MCLaunch ? window.MCLaunch.loadPath() : null;
    const coachHint = path && path.stages && path.stages[1] && path.stages[1].best
      ? `<li>Launch Path best Stage 1: ${path.stages[1].best}/100.</li>` : `<li>Optional: open <strong>Launch Path</strong> for venture-coach rubric scoring.</li>`;
    return `<p>Plan for <strong>${escapeHtml(intent.slice(0,80))}</strong>:</p><ul><li>Lock design direction (${THEME_LABELS[state.theme]}) before Build.</li><li>Studio first; Mercatus Concierge is source of truth.</li><li>Ops Launch + Role kit: ${state.role}. ${team.length?"AI team: "+team.join(", ")+".":""}</li>${coachHint}<li>Ask: “${escapeHtml(text.slice(0,120))}”</li></ul>`;
  }
  const LOOK_WORDS={cream:"cream",night:"night",neo:"neo",neobrutalist:"neo",mono:"mono",monochrome:"mono",maison:"cartel"};
  function buildApply(text){
    const t=text.toLowerCase(); const notes=[];
    /* App look changes only when the user clearly asks for the app look, so colour words go to the page being built */
    const lm=t.match(/\b(?:app|shell|concierge)\s+(?:look|theme)\s+(?:to\s+)?(\w+)|\b(\w+)\s+(?:app|shell)\s+(?:look|theme)\b/);
    const lw=lm&&(lm[1]||lm[2]); if(lw && LOOK_WORDS[lw]){ applyTheme(LOOK_WORDS[lw]); notes.push("App look: "+THEME_LABELS[LOOK_WORDS[lw]]+"."); }
    if(/\bglass|frost/.test(t)){ setGlass(true); notes.push("Glass chrome on."); }
    if(!(lw && LOOK_WORDS[lw] && !/page|site|section|headline|add|dark|light/.test(t.replace(lm[0],""))) && window.MCBuilder){
      const r=window.MCBuilder.apply(text); notes.push(...r.notes);
      requestAnimationFrame(()=>studio.resizeAnn());
      const open = state.stage==="chat" ? "" : ` <button type="button" class="btn btn-ghost btn-sm" data-goto="studio">Open Studio</button>`;
      return `<p>${r.isNew?"Built":"Updated"} the preview <span class="msg-tag">local template, not AI</span></p><ul>${notes.map(n=>`<li>${escapeHtml(n)}</li>`).join("")}</ul><p class="small">Try next: “add a pricing section”, “add testimonials”, “make it darker”, “button 'Order now'”.${open}</p>`;
    }
    return `<p>Build applied:</p><ul>${notes.map(n=>`<li>${escapeHtml(n)}</li>`).join("")}</ul>`;
  }
  function syncArt(ev){ const h=$("#art-headline")?.value,s=$("#art-subline")?.value,n=$("#art-note")?.value; if(h!=null&&$("#artboard-headline"))$("#artboard-headline").textContent=h; if(s!=null&&$("#artboard-subline"))$("#artboard-subline").textContent=s; if(n!=null&&$("#artboard-note"))$("#artboard-note").textContent=n; localStorage.setItem(LS.art,JSON.stringify({h,s,n})); if(ev && ev.type==='input' && window.MCBuilder&&window.MCBuilder.load()){ if(h!=null) window.MCBuilder.setField("headline",h); if(s!=null) window.MCBuilder.setField("subline",s); } }


  const studio = {
    init(){ const board=$("#artboard"); if(!board)return; $$(".tool-btn[data-tool]").forEach(b=>b.addEventListener("click",()=>studio.setTool(b.dataset.tool))); $("#btn-clear-ann")?.addEventListener("click",()=>studio.clearAnn()); board.addEventListener("click",e=>studio.onClick(e)); this.resizeAnn(); window.addEventListener("resize",()=>this.resizeAnn()); this.bindAnnDraw(); ["art-headline","art-subline","art-note"].forEach(id=>$("#"+id)?.addEventListener("input",syncArt)); syncArt(); },
    setTool(tool){ state.tool=tool; $$(".tool-btn[data-tool]").forEach(b=>{const on=b.dataset.tool===tool;b.classList.toggle("is-active",on);b.setAttribute("aria-pressed",on?"true":"false");}); const board=$("#artboard"); board.classList.toggle("is-select",tool==="select"); board.classList.toggle("is-edit",tool==="edit"); board.classList.toggle("is-annotate",tool==="annotate"); board.classList.toggle("is-comment",tool==="comment"); $$(".editable-text",board).forEach(el=>{el.contentEditable=tool==="edit"?"true":"false";}); },
    onClick(e){ const board=$("#artboard"); if(state.tool==="select"){ const sel=e.target.closest(".selectable"); $$(".selectable",board).forEach(el=>el.classList.remove("is-selected")); if(sel)sel.classList.add("is-selected"); } else if(state.tool==="comment"){ if(e.target.closest(".pin"))return; const layer=$("#comment-layer"); const r=board.getBoundingClientRect(); const x=e.clientX-r.left,y=e.clientY-r.top; const n=layer.querySelectorAll(".pin").length+1; const pin=document.createElement("div"); pin.className="pin"; pin.style.left=x+"px"; pin.style.top=y+"px"; pin.innerHTML=`<span>${n}</span>`; const note=document.createElement("div"); note.className="pin-note"; note.style.left=(x+14)+"px"; note.style.top=(y+14)+"px"; note.innerHTML=`<textarea placeholder="Comment…"></textarea><button type="button" class="btn btn-ghost btn-sm">Done</button>`; note.querySelector("button").onclick=()=>note.remove(); layer.appendChild(pin); layer.appendChild(note); } },
    resizeAnn(){ const canvas=$("#annotate-layer"), board=$("#artboard"); if(!canvas||!board)return; canvas.width=board.clientWidth; canvas.height=board.clientHeight; },
    bindAnnDraw(){ const canvas=$("#annotate-layer"); if(!canvas)return; const ctx=canvas.getContext("2d"); let drawing=false,mode="pen",start=null; canvas.addEventListener("pointerdown",e=>{ if(state.tool!=="annotate")return; drawing=true; canvas.setPointerCapture(e.pointerId); const r=canvas.getBoundingClientRect(); start={x:e.clientX-r.left,y:e.clientY-r.top}; mode=e.shiftKey?"rect":"pen"; ctx.strokeStyle=getComputedStyle(document.documentElement).getPropertyValue("--accent").trim()||"#c8102e"; ctx.lineWidth=2; ctx.lineCap="round"; if(mode==="pen"){ctx.beginPath();ctx.moveTo(start.x,start.y);} }); canvas.addEventListener("pointermove",e=>{ if(!drawing||state.tool!=="annotate")return; const r=canvas.getBoundingClientRect(); const x=e.clientX-r.left,y=e.clientY-r.top; if(mode==="pen"){ctx.lineTo(x,y);ctx.stroke();} }); canvas.addEventListener("pointerup",e=>{ if(!drawing)return; drawing=false; if(mode==="rect"&&start){ const r=canvas.getBoundingClientRect(); const x=e.clientX-r.left,y=e.clientY-r.top; ctx.strokeRect(start.x,start.y,x-start.x,y-start.y);} start=null; }); },
    clearAnn(){ const canvas=$("#annotate-layer"); if(canvas)canvas.getContext("2d").clearRect(0,0,canvas.width,canvas.height); const layer=$("#comment-layer"); if(layer)layer.innerHTML=""; toast("Annotations cleared"); }
  };

  const paint = {
    undoStack:[], drawing:false, last:null, _ready:false, tool:"pen",
    ensure(){ const c=$("#paint-canvas"); if(!c||this._ready)return; this._ready=true; this.c=c; this.ctx=c.getContext("2d"); this.ctx.fillStyle="#fff"; this.ctx.fillRect(0,0,c.width,c.height); this.load();
      this.tool=$("#paint-tool")?.value||"pen";
      const pos=e=>{ const r=c.getBoundingClientRect(); return {x:(e.clientX-r.left)*(c.width/r.width), y:(e.clientY-r.top)*(c.height/r.height)}; };
      c.addEventListener("pointerdown",e=>{ if(e.pointerType==="mouse" && e.button!==0) return; e.preventDefault(); this.pushUndo(); this.drawing=true; try{ c.setPointerCapture(e.pointerId); }catch(_){ } this.last=pos(e); this.pts=[this.last];
        if(this.tool==="brush"){ try{ this.snap=this.ctx.getImageData(0,0,c.width,c.height); }catch(_){ this.snap=null; } this.redrawBrush(); } else this.dot(this.last); });
      c.addEventListener("pointermove",e=>{ if(!this.drawing||!this.last) return; e.preventDefault(); const evs=(typeof e.getCoalescedEvents==="function" && e.getCoalescedEvents().length) ? e.getCoalescedEvents() : [e];
        if(this.tool==="brush" && this.snap){ evs.forEach(ev=>this.pts.push(pos(ev))); this.last=this.pts[this.pts.length-1]; this.redrawBrush(); return; }
        evs.forEach(ev=>{ const p=pos(ev); this.segment(this.last,p); this.last=p; }); });
      const end=()=>{ if(!this.drawing) return; this.drawing=false; this.last=null; this.pts=null; this.snap=null; this.save(); };
      c.addEventListener("pointerup",end); c.addEventListener("pointercancel",end); c.addEventListener("lostpointercapture",end);
      const bind=(sel,fn)=>$(sel)?.addEventListener("click",fn);
      bind("#paint-undo",()=>this.undo()); bind("#paint-undo-inline",()=>this.undo());
      bind("#paint-clear",()=>this.clear()); bind("#paint-clear-inline",()=>this.clear());
      bind("#paint-export",()=>this.exportPng()); bind("#paint-export-inline",()=>this.exportPng());
      bind("#paint-to-image",()=>this.drawToImage());
      $("#paint-tool")?.addEventListener("change",e=>this.setTool(e.target.value));
      $$("[data-paint-tool]").forEach(b=>b.addEventListener("click",()=>this.setTool(b.dataset.paintTool)));
      ["paint-size","paint-size-inline","paint-color","paint-color-inline"].forEach(id=>{ $("#"+id)?.addEventListener("input",()=>{ const v=$("#"+id).value; if(id.includes("size")){ if($("#paint-size"))$("#paint-size").value=v; if($("#paint-size-inline"))$("#paint-size-inline").value=v; const o=$("#paint-size-out"); if(o)o.textContent=v; } if(id.includes("color")){ if($("#paint-color"))$("#paint-color").value=v; if($("#paint-color-inline"))$("#paint-color-inline").value=v; } }); });
      document.addEventListener("keydown",e=>{ if(state.stage!=="paint") return; if((e.ctrlKey||e.metaKey) && !e.shiftKey && e.key.toLowerCase()==="z" && !isEditable(e.target) && !isEditable(document.activeElement)){ e.preventDefault(); this.undo(); } });
      this.setTool(this.tool); this.updateUndo();
    },
    setTool(t){ this.tool=["pen","brush","eraser"].includes(t)?t:"pen"; const sel=$("#paint-tool"); if(sel&&sel.value!==this.tool) sel.value=this.tool; $$("[data-paint-tool]").forEach(b=>{ const on=b.dataset.paintTool===this.tool; b.classList.toggle("is-active",on); b.setAttribute("aria-pressed",on?"true":"false"); }); if(this.c) this.c.style.cursor = this.tool==="eraser" ? "cell" : "crosshair"; },
    style(){ const ctx=this.ctx; const size=+($("#paint-size")?.value||$("#paint-size-inline")?.value||6); const color=$("#paint-color")?.value||$("#paint-color-inline")?.value||"#c8102e"; ctx.globalCompositeOperation="source-over"; ctx.lineCap="round"; ctx.lineJoin="round"; ctx.shadowBlur=0; ctx.shadowColor="transparent";
      if(this.tool==="eraser"){ ctx.globalAlpha=1; ctx.strokeStyle="#ffffff"; ctx.fillStyle="#ffffff"; ctx.lineWidth=Math.max(4,size*2); }
      else if(this.tool==="brush"){ ctx.globalAlpha=.45; ctx.strokeStyle=color; ctx.fillStyle=color; ctx.lineWidth=Math.max(2,size*2); ctx.shadowBlur=Math.max(2,size*.8); ctx.shadowColor=color; }
      else { ctx.globalAlpha=1; ctx.strokeStyle=color; ctx.fillStyle=color; ctx.lineWidth=size; }
      return ctx; },
    redrawBrush(){ const ctx=this.ctx, c=this.c, pts=this.pts||[]; if(!pts.length) return; if(this.snap) ctx.putImageData(this.snap,0,0); this.style(); ctx.beginPath(); ctx.moveTo(pts[0].x,pts[0].y); if(pts.length===1) ctx.lineTo(pts[0].x+0.01,pts[0].y); for(let i=1;i<pts.length;i++){ const a=pts[i-1], b=pts[i]; ctx.quadraticCurveTo(a.x,a.y,(a.x+b.x)/2,(a.y+b.y)/2); } ctx.stroke(); ctx.globalAlpha=1; ctx.shadowBlur=0; },
    dot(p){ const ctx=this.style(); ctx.beginPath(); ctx.arc(p.x,p.y,ctx.lineWidth/2,0,Math.PI*2); ctx.fill(); ctx.globalAlpha=1; ctx.shadowBlur=0; },
    segment(a,b){ const ctx=this.style(); ctx.beginPath(); ctx.moveTo(a.x,a.y); ctx.lineTo(b.x,b.y); ctx.stroke(); ctx.globalAlpha=1; ctx.shadowBlur=0; },
    pushUndo(){ const c=$("#paint-canvas"); if(!c)return; try{ this.undoStack.push(c.toDataURL("image/png")); }catch(_){ } if(this.undoStack.length>30)this.undoStack.shift(); this.updateUndo(); },
    updateUndo(){ const none=!this.undoStack.length; ["#paint-undo","#paint-undo-inline"].forEach(s=>{ const b=$(s); if(b){ b.disabled=none; b.title=none?"Nothing to undo yet":"Undo last stroke (Ctrl/Cmd+Z)"; } }); },
    undo(){ const c=$("#paint-canvas"); if(!c||!this.undoStack.length){ toast("Nothing to undo"); return; } const url=this.undoStack.pop(); this.updateUndo(); const img=new Image(); img.onload=()=>{ this.ctx.globalCompositeOperation="source-over"; this.ctx.globalAlpha=1; this.ctx.fillStyle="#fff"; this.ctx.fillRect(0,0,c.width,c.height); this.ctx.drawImage(img,0,0); this.save(); }; img.src=url; },
    clear(){ const c=$("#paint-canvas"); if(!c)return; this.pushUndo(); this.ctx.globalCompositeOperation="source-over"; this.ctx.globalAlpha=1; this.ctx.fillStyle="#fff"; this.ctx.fillRect(0,0,c.width,c.height); this.save(); toast("Canvas cleared — Undo brings it back"); },
    exportPng(){ const c=$("#paint-canvas"); if(!c)return; const a=document.createElement("a"); a.href=c.toDataURL("image/png"); a.download="mercatus-concierge-paint.png"; document.body.appendChild(a); a.click(); a.remove(); toast("PNG downloaded"); },
    drawToImage(){ toast("Making placeholder art (local, no AI)…"); const bar=$("#paint-gen-progress"); if(bar){bar.hidden=false;bar.value=0;} let p=0; const iv=setInterval(()=>{ p+=12; if(bar)bar.value=Math.min(p,100); if(p>=100){ clearInterval(iv); const c=$("#paint-canvas"); if(c){ this.pushUndo(); const g=this.ctx.createLinearGradient(0,0,c.width,c.height); g.addColorStop(0,"#c9a227"); g.addColorStop(.5,"#1a1512"); g.addColorStop(1,"#f3ead8"); this.ctx.globalCompositeOperation="source-over"; this.ctx.globalAlpha=1; this.ctx.fillStyle=g; this.ctx.fillRect(0,0,c.width,c.height); this.ctx.fillStyle="rgba(255,255,255,.9)"; this.ctx.font="bold 42px 'DM Sans',sans-serif"; this.ctx.fillText("Mercatus Concierge",48,c.height/2); this.ctx.font="20px 'DM Sans',sans-serif"; this.ctx.fillText("Draw → Image placeholder · local, no AI model",48,c.height/2+40); this.save(); } toast("Placeholder art ready — Undo to get your sketch back"); if(bar)setTimeout(()=>bar.hidden=true,600);} },120); },
    save(){ try{ localStorage.setItem(LS.paint,$("#paint-canvas").toDataURL("image/png")); }catch(_){ toast("Couldn't save the drawing (browser storage full)"); } },
    load(){ const data=localStorage.getItem(LS.paint); if(!data)return; const img=new Image(); img.onload=()=>this.ctx.drawImage(img,0,0); img.src=data; }
  };


  const ops = {
    sheet:null, recruit:null, estate:null, team:null,
    load(){
      try{this.sheet=JSON.parse(localStorage.getItem(LS.sheet));}catch(_){this.sheet=null;}
      if(!this.sheet) this.sheet={cols:["Metric","Owner","Status","Notes"],rows:[["MRR","Katlego","Tracking","Demo"],["Pipeline","Ops bot","Open",""],["Hiring","Recruiter","Active","3 roles"]]};
      try{this.recruit=JSON.parse(localStorage.getItem(LS.recruit));}catch(_){this.recruit=null;}
      if(!this.recruit){ const d=n=>new Date(Date.now()-n*864e5).toISOString(); this.recruit={Sourced:[{id:"c1",name:"Amina K.",role:"Analyst",touched:d(5)}],Outreach:[{id:"c2",name:"Jordan P.",role:"Recruiter",touched:d(1)}],Interview:[{id:"c3",name:"Sam R.",role:"Listing ops",touched:d(4)}],Offer:[],Hired:[{id:"c4",name:"Lex M.",role:"Spreadsheet bot",touched:d(0)}]}; }
      try{this.estate=JSON.parse(localStorage.getItem(LS.estate));}catch(_){this.estate=null;}
      if(!this.estate) this.estate={Lead:[{id:"d1",title:"Sandton loft",value:"R2.4M"}],Tour:[{id:"d2",title:"Cape Town villa",value:"R8.1M"}],Offer:[],Underwrite:[{id:"d3",title:"Joburg warehouse",value:"R5.0M"}],Close:[]};
      try{this.team=JSON.parse(localStorage.getItem(LS.team));}catch(_){this.team=null;}
      if(!this.team) this.team=[{id:"t1",name:"Atlas",role:"Analyst",brief:"Summarize sheet metrics daily."},{id:"t2",name:"Hera",role:"Recruiter",brief:"Draft outreach for Sourced column."}];
    },
    persist(){ localStorage.setItem(LS.sheet,JSON.stringify(this.sheet)); localStorage.setItem(LS.recruit,JSON.stringify(this.recruit)); localStorage.setItem(LS.estate,JSON.stringify(this.estate)); localStorage.setItem(LS.team,JSON.stringify(this.team)); },
    getTeamNames(){ return (this.team||[]).map(t=>t.name); },
    setTab(tab){ state.opsTab=tab; $$(".ops-tab").forEach(b=>{const on=b.dataset.ops===tab;b.classList.toggle("is-active",on);b.setAttribute("aria-selected",on?"true":"false");}); $$("[data-ops-mod]").forEach(m=>{m.hidden=m.dataset.opsMod!==tab;m.classList.toggle("is-active",m.dataset.opsMod===tab);}); const hints={sheet:"Spreadsheet desk — cells, rows, CSV.",recruit:"Kanban: Sourced → Hired. Stale >3 days.",estate:"Lead → Tour → Offer → Underwrite → Close.",team:"Digital coworker roster for Plan/Build."}; const h=$("#ops-hint"); if(h)h.textContent=hints[tab]||""; },
    render(){ this.renderSheet(); this.renderRecruit(); this.renderEstate(); this.renderTeam(); this.setTab(state.opsTab); },
    renderSheet(){ const table=$("#ops-sheet"); if(!table)return; const {cols,rows}=this.sheet; if(!rows.length){ table.innerHTML=`<caption class="empty-note">No rows yet — use <strong>Add row</strong> above to start your sheet.</caption>`; return; } let html="<thead><tr>"+cols.map(c=>`<th>${escapeHtml(c)}</th>`).join("")+"</tr></thead><tbody>"; rows.forEach((row,ri)=>{ html+="<tr>"; cols.forEach((_,ci)=>{ html+=`<td><input data-r="${ri}" data-c="${ci}" aria-label="${escapeHtml((cols[ci]||"Column")+" — row "+(ri+1))}" value="${escapeHtml(row[ci]||"")}"></td>`; }); html+="</tr>"; }); html+="</tbody>"; table.innerHTML=html; table.querySelectorAll("input").forEach(inp=>{ const put=()=>{ this.sheet.rows[+inp.dataset.r][+inp.dataset.c]=inp.value; this.persist(); }; inp.addEventListener("change",put); inp.addEventListener("input",()=>{ clearTimeout(inp._t); inp._t=setTimeout(put,250); }); }); },
    renderRecruit(){ const board=$("#recruit-board"); if(!board)return; const cols=["Sourced","Outreach","Interview","Offer","Hired"]; board.innerHTML=cols.map(col=>{ const cards=(this.recruit[col]||[]).map(c=>{ const days=(Date.now()-new Date(c.touched).getTime())/864e5; const stale=days>3?`<span class="stale">Stale ${Math.floor(days)}d</span>`:""; return `<div class="cand-card" draggable="true" data-id="${c.id}" data-col="${col}"><strong>${escapeHtml(c.name)}</strong><div>${escapeHtml(c.role)}</div>${stale}</div>`; }).join(""); return `<div class="kanban-col" data-col="${col}"><h4>${col}</h4>${cards}</div>`; }).join(""); let dragId=null,fromCol=null; board.querySelectorAll(".cand-card").forEach(card=>card.addEventListener("dragstart",()=>{dragId=card.dataset.id;fromCol=card.dataset.col;})); board.querySelectorAll(".kanban-col").forEach(col=>{ col.addEventListener("dragover",e=>e.preventDefault()); col.addEventListener("drop",()=>{ if(!dragId)return; const item=this.recruit[fromCol].find(x=>x.id===dragId); if(!item)return; this.recruit[fromCol]=this.recruit[fromCol].filter(x=>x.id!==dragId); item.touched=new Date().toISOString(); this.recruit[col.dataset.col].push(item); this.persist(); this.renderRecruit(); }); }); },
    renderEstate(){ const strip=$("#estate-strip"); if(!strip)return; const cols=["Lead","Tour","Offer","Underwrite","Close"]; strip.innerHTML=cols.map(col=>{ const cards=(this.estate[col]||[]).map(d=>`<div class="deal-card" contenteditable="true" data-id="${d.id}" data-col="${col}"><strong>${escapeHtml(d.title)}</strong><div>${escapeHtml(d.value)}</div></div>`).join(""); return `<div class="estate-col"><h4>${col}</h4>${cards}</div>`; }).join(""); strip.querySelectorAll(".deal-card").forEach(card=>card.addEventListener("blur",()=>{ const col=card.dataset.col; const item=this.estate[col].find(x=>x.id===card.dataset.id); if(!item)return; const parts=card.innerText.split("\n"); item.title=parts[0]||item.title; item.value=parts[1]||item.value; this.persist(); })); },
    renderTeam(){ const roster=$("#team-roster"); if(!roster)return; const roles=["Analyst","Recruiter","Listing ops","Spreadsheet bot"]; if(!this.team.length){ roster.innerHTML=`<div class="empty-state"><strong>No AI coworkers yet</strong><p>Add a coworker to give it a role and a daily brief (local roster only).</p></div>`; return; } roster.innerHTML=this.team.map(t=>`<div class="team-card" data-id="${t.id}"><strong>${escapeHtml(t.name)}</strong><label>Role<select data-f="role" aria-label="Role for ${escapeHtml(t.name)}">${roles.map(r=>`<option ${r===t.role?"selected":""}>${r}</option>`).join("")}</select></label><label>Brief<textarea data-f="brief" rows="2">${escapeHtml(t.brief)}</textarea></label><button type="button" class="btn btn-ghost btn-sm" data-rm>Remove</button></div>`).join(""); roster.querySelectorAll(".team-card").forEach(card=>{ const id=card.dataset.id; card.querySelectorAll("[data-f]").forEach(el=>el.addEventListener("change",()=>{ const item=this.team.find(x=>x.id===id); if(item){item[el.dataset.f]=el.value;this.persist();} })); card.querySelector("[data-rm]")?.addEventListener("click",()=>{ this.team=this.team.filter(x=>x.id!==id); this.persist(); this.renderTeam(); }); }); }
  };


  const roles = {
    data:null,
    load(){ try{this.data=JSON.parse(localStorage.getItem(LS.roles))||{};}catch(_){this.data={};} const d=this.data;
      if(!d.marketers) d.marketers={campaigns:[{name:"Blueprint launch",status:"Live"},{name:"Sound Deck AI push",status:"Draft"}],utm:{source:"linkedin",medium:"social",campaign:"cartel-launch"},funnel:["Awareness","Consideration","Signup","Activate"],checks:[{t:"Creative approved",on:true},{t:"UTM live",on:false},{t:"Landing QA",on:false}]};
      if(!d.sales) d.sales={pipe:{Lead:["Acme Retail"],Qualified:["Northwind"],Proposal:["Contoso"],Won:["Mens Mercatus"],Lost:[]},metrics:{pipeline:"R420k",winRate:"28%",attribution:"42% organic"}};
      if(!d.ops) d.ops={queue:[{id:"q1",title:"Expense approval",status:"Pending"},{id:"q2",title:"Vendor KYC",status:"Approved"}],intake:""};
      if(!d.people) d.people={dir:[{name:"Katlego Mokoto",role:"Founder",dept:"Executive"},{name:"Amina K.",role:"Analyst",dept:"Ops"},{name:"Jordan P.",role:"Recruiter",dept:"People"}],q:""};
      if(!d.designers) d.designers={pins:[{url:"",note:"Blueprint wheat mark"}],brand:{primary:"#c8102e",secondary:"#0a0a0a",cream:"#f3ead8"},palette:["#c8102e","#0a0a0a","#f3ead8","#ffd600","#ffffff"],stack:["Hero","Proof","CTA"]};
      if(!d.product) d.product={roadmap:{Now:["Paint canvas"],Next:["Ops Launch"],Later:["Realtime collab"]},requests:[{t:"Figma plugin",votes:3},{t:"Voice GPT Live",votes:1}]};
      if(!d.founders) d.founders={funding:[{round:"Pre-seed",amount:"R1.5M",status:"Open"}],waitlist:[],okrs:[{o:"Ship Mercatus Concierge",kr:"Live on mensmercatus.online",progress:80},{o:"Ops suite demo",kr:"4 modules local",progress:60},{o:"Role kits",kr:"7 kits",progress:50}]};
    },
    save(){ localStorage.setItem(LS.roles,JSON.stringify(this.data)); },
    search(q){
      const out=$("#roles-search-out"); if(!out) return; q=(q||"").trim().toLowerCase(); if(!q){ out.hidden=true; out.innerHTML=""; return; }
      const d=this.data, hits=[]; const add=(kit,label,text)=>{ if(`${label} ${text}`.toLowerCase().includes(q)) hits.push({kit,label,text}); };
      Object.entries(ROLE_HINTS).forEach(([k,h])=>add(k,"Kit: "+k.charAt(0).toUpperCase()+k.slice(1),h));
      (d.people?.dir||[]).forEach(p=>add("people",p.name,`${p.role} · ${p.dept}`));
      (d.marketers?.campaigns||[]).forEach(c=>add("marketers","Campaign: "+c.name,c.status));
      Object.entries(d.sales?.pipe||{}).forEach(([col,arr])=>arr.forEach(n=>add("sales","Deal: "+n,col)));
      (d.ops?.queue||[]).forEach(x=>add("ops","Request: "+x.title,x.status));
      Object.entries(d.product?.roadmap||{}).forEach(([col,arr])=>arr.forEach(n=>add("product","Roadmap: "+n,col)));
      (d.product?.requests||[]).forEach(r=>add("product","Request: "+r.t,r.votes+" votes"));
      (d.founders?.okrs||[]).forEach(o=>add("founders","OKR: "+o.o,o.kr));
      out.hidden=false;
      out.innerHTML = hits.length ? `<p class="eyebrow">${hits.length} result${hits.length>1?"s":""} across all kits</p><div class="search-hits">${hits.slice(0,20).map(h=>`<button type="button" class="role-card search-hit" data-kit="${h.kit}"><strong>${escapeHtml(h.label)}</strong><span>${escapeHtml(h.text)} · ${escapeHtml(h.kit)}</span></button>`).join("")}</div>`
        : `<div class="empty-state"><strong>No results for “${escapeHtml(q)}”</strong><p>Try a name, kit, campaign, deal or request.</p></div>`;
      out.querySelectorAll("[data-kit]").forEach(b=>b.addEventListener("click",()=>{ state.role=b.dataset.kit; this.render(); }));
    },
    render(){ const body=$("#roles-body"); if(!body)return; const role=state.role;
      if(!$("#roles-search")){ body.insertAdjacentHTML("beforebegin",`<div class="roles-search"><label class="field"><span>Search all kits</span><input type="search" id="roles-search" placeholder="Search people, campaigns, deals, requests…" autocomplete="off"></label><div id="roles-search-out" class="roles-search-out" aria-live="polite" hidden></div></div>`); $("#roles-search").addEventListener("input",e=>this.search(e.target.value)); } const badge=$("#role-badge"); if(badge)badge.textContent=role.charAt(0).toUpperCase()+role.slice(1); const hint=$("#role-hint"); if(hint)hint.textContent=ROLE_HINTS[role]||""; const sw=$("#role-switcher"); if(sw&&sw.value!==role)sw.value=role;
      if(role==="marketers") body.innerHTML=this.marketers(); else if(role==="sales") body.innerHTML=this.sales(); else if(role==="ops") body.innerHTML=this.opsRole(); else if(role==="people") body.innerHTML=this.people(); else if(role==="designers") body.innerHTML=this.designers(); else if(role==="product") body.innerHTML=this.product(); else if(role==="founders") body.innerHTML=this.founders();
      this.bind(role); },
    marketers(){ const m=this.data.marketers; const utm=`?utm_source=${encodeURIComponent(m.utm.source)}&utm_medium=${encodeURIComponent(m.utm.medium)}&utm_campaign=${encodeURIComponent(m.utm.campaign)}`; return `<div class="role-kit"><div class="role-kit-grid"><div class="role-section"><h3>Campaigns</h3>${m.campaigns.map(c=>`<div class="role-card"><strong>${escapeHtml(c.name)}</strong><div>${escapeHtml(c.status)}</div></div>`).join("")}<button type="button" class="btn btn-ghost btn-sm" id="mk-add-camp">Add campaign</button></div><div class="role-section"><h3>UTM builder</h3><label class="field"><span>Source</span><input id="utm-source" value="${escapeHtml(m.utm.source)}"></label><label class="field"><span>Medium</span><input id="utm-medium" value="${escapeHtml(m.utm.medium)}"></label><label class="field"><span>Campaign</span><input id="utm-campaign" value="${escapeHtml(m.utm.campaign)}"></label><div class="utm-preview" id="utm-preview">${escapeHtml(utm)}</div></div><div class="role-section"><h3>Funnel</h3><ol>${m.funnel.map(f=>`<li>${escapeHtml(f)}</li>`).join("")}</ol></div><div class="role-section"><h3>Launch checklist</h3><div class="check-list">${m.checks.map((c,i)=>`<label><input type="checkbox" data-ck="${i}" ${c.on?"checked":""}> ${escapeHtml(c.t)}</label>`).join("")}</div></div></div></div>`; },
    sales(){ const s=this.data.sales; const cols=Object.keys(s.pipe); return `<div class="role-kit"><button type="button" class="btn btn-accent btn-sm" data-open-portal>Open Client Portal</button> <button type="button" class="btn btn-ghost btn-sm" id="sales-brief-gen">Customer call brief</button><div id="sales-brief-out"></div><div class="metric-rail">${Object.entries(s.metrics).map(([k,v])=>`<div class="metric"><div class="m-label">${escapeHtml(k)}</div><div class="m-val">${escapeHtml(v)}</div></div>`).join("")}</div><div class="kanban">${cols.map(col=>`<div class="kanban-col"><h4>${col}</h4>${(s.pipe[col]||[]).map(n=>`<div class="cand-card"><strong>${escapeHtml(n)}</strong></div>`).join("")}</div>`).join("")}</div></div>`; },
    opsRole(){ const o=this.data.ops; return `<div class="role-kit"><button type="button" class="btn btn-accent btn-sm" data-open-portal>Open Client Portal</button><div class="role-kit-grid"><div class="role-section"><h3>Request intake</h3><label class="field"><span>Request</span><input id="ops-intake" placeholder="e.g. Approve vendor invoice"></label><button type="button" class="btn btn-primary btn-sm" id="ops-intake-go">Add to queue</button></div><div class="role-section"><h3>Approval tracker</h3>${o.queue.map(q=>`<div class="queue-item"><span>${escapeHtml(q.title)}</span><strong>${escapeHtml(q.status)}</strong></div>`).join("")}</div><div class="role-section"><h3>Sheet bridge</h3><p class="panel-copy small">Full spreadsheet lives in Ops Launch.</p><button type="button" class="btn btn-ghost btn-sm" data-goto="ops">Open Ops Launch</button></div></div></div>`; },
    people(){ const p=this.data.people; const q=(p.q||"").toLowerCase(); const list=p.dir.filter(d=>!q||`${d.name} ${d.role} ${d.dept}`.toLowerCase().includes(q)); return `<div class="role-kit"><div class="role-section"><h3>Team directory</h3><label class="field"><span>Search</span><input id="people-q" value="${escapeHtml(p.q||"")}" placeholder="Name, role, dept"></label>${list.length?`<div class="role-kit-grid">${list.map(d=>`<div class="role-card"><strong>${escapeHtml(d.name)}</strong><div>${escapeHtml(d.role)} · ${escapeHtml(d.dept)}</div></div>`).join("")}</div>`:`<div class="empty-state"><strong>No one matches “${escapeHtml(p.q)}”</strong><p>Try a different name, role or department.</p></div>`}</div><div class="role-section"><h3>Hiring</h3><p class="panel-copy small">Recruiting Kanban is in Ops Launch → Recruit.</p><button type="button" class="btn btn-ghost btn-sm" data-goto="ops">Open recruiting</button></div></div>`; },
    designers(){ const d=this.data.designers; return `<div class="role-kit"><div class="role-kit-grid"><div class="role-section"><h3>Brand kit</h3><div class="swatch-row"><label class="swatch">Primary<input type="color" id="bk-primary" value="${d.brand.primary}"></label><label class="swatch">Secondary<input type="color" id="bk-secondary" value="${d.brand.secondary}"></label><label class="swatch">Cream<input type="color" id="bk-cream" value="${d.brand.cream}"></label></div></div><div class="role-section"><h3>Palette generator</h3><div class="swatch-row" id="palette-swatches">${d.palette.map((c,i)=>`<label class="swatch">S${i+1}<input type="color" data-pal="${i}" value="${c}"></label>`).join("")}</div><button type="button" class="btn btn-primary btn-sm" id="pal-copy" style="margin-top:8px">Copy CSS vars</button><pre class="utm-preview" id="pal-css"></pre></div><div class="role-section"><h3>Moodboard</h3><label class="field"><span>Image URL</span><input id="mood-url" placeholder="https://…"></label><label class="field"><span>Note</span><input id="mood-note" placeholder="Caption"></label><button type="button" class="btn btn-ghost btn-sm" id="mood-add">Pin</button><div class="mood-board" style="margin-top:8px">${d.pins.map(p=>`<div class="mood-pin">${p.url?`<img src="${escapeHtml(p.url)}" alt="">`:`<div style="height:90px;display:grid;place-items:center;color:var(--text-muted)">No URL</div>`}<div class="mood-note">${escapeHtml(p.note||"")}</div></div>`).join("")}</div></div><div class="role-section"><h3>Infinite card stack</h3><div class="card-stack" id="card-stack">${d.stack.map((t,i)=>`<div class="stack-card" style="--i:${i}"><strong>${escapeHtml(t)}</strong><p>CSS stack sample</p></div>`).join("")}</div><button type="button" class="btn btn-ghost btn-sm" id="stack-add" style="margin-top:8px">Push card</button></div></div></div>`; },
    product(){ const p=this.data.product; return `<div class="role-kit"><div class="roadmap-cols">${["Now","Next","Later"].map(col=>`<div class="role-section"><h3>${col}</h3>${(p.roadmap[col]||[]).map(x=>`<div class="role-card">${escapeHtml(x)}</div>`).join("")}</div>`).join("")}</div><div class="role-section"><h3>Feature requests</h3>${p.requests.map((r,i)=>`<div class="upvote-row"><span>${escapeHtml(r.t)}</span><button type="button" class="btn btn-ghost btn-sm" data-up="${i}">▲ ${r.votes}</button></div>`).join("")}<button type="button" class="btn btn-primary btn-sm" id="feat-add">Add request</button></div></div>`; },
    founders(){ const f=this.data.founders; return `<div class="role-kit"><button type="button" class="btn btn-accent btn-sm" data-open-portal>Open Client Portal</button> <button type="button" class="btn btn-ghost btn-sm" data-goto="launch">Launch Path</button><div class="role-kit-grid"><div class="role-section"><h3>Funding tracker</h3><table class="ops-sheet"><thead><tr><th>Round</th><th>Amount</th><th>Status</th></tr></thead><tbody>${f.funding.map(r=>`<tr><td>${escapeHtml(r.round)}</td><td>${escapeHtml(r.amount)}</td><td>${escapeHtml(r.status)}</td></tr>`).join("")}</tbody></table><button type="button" class="btn btn-ghost btn-sm" id="fund-add" style="margin-top:8px">Add round</button></div><div class="role-section"><h3>Waitlist mock</h3><label class="field"><span>Email</span><input id="wl-email" type="email" placeholder="you@company.com"></label><button type="button" class="btn btn-primary btn-sm" id="wl-add">Capture</button><p class="panel-copy small">${f.waitlist.length} captured (local only)</p></div><div class="role-section"><h3>OKRs</h3>${f.okrs.map(o=>`<div class="role-card"><strong>${escapeHtml(o.o)}</strong><div>${escapeHtml(o.kr)}</div><div>${o.progress}%</div></div>`).join("")}</div></div><div id="founders-launch-extra"></div></div>`; },
    bind(role){
      if(role==="marketers"){ ["utm-source","utm-medium","utm-campaign"].forEach(id=>{ $("#"+id)?.addEventListener("input",()=>{ const m=this.data.marketers.utm; m.source=$("#utm-source").value; m.medium=$("#utm-medium").value; m.campaign=$("#utm-campaign").value; $("#utm-preview").textContent=`?utm_source=${encodeURIComponent(m.source)}&utm_medium=${encodeURIComponent(m.medium)}&utm_campaign=${encodeURIComponent(m.campaign)}`; this.save(); }); }); $$("[data-ck]").forEach(ck=>ck.addEventListener("change",()=>{ this.data.marketers.checks[+ck.dataset.ck].on=ck.checked; this.save(); })); $("#mk-add-camp")?.addEventListener("click",()=>{ const name=prompt("Campaign name"); if(!name)return; this.data.marketers.campaigns.push({name,status:"Draft"}); this.save(); this.render(); }); }
      if(role==="ops"){ $("#ops-intake-go")?.addEventListener("click",()=>{ const v=$("#ops-intake")?.value?.trim(); if(!v)return; this.data.ops.queue.unshift({id:"q"+Date.now(),title:v,status:"Pending"}); this.save(); this.render(); }); }
      if(role==="people"){ $("#people-q")?.addEventListener("input",e=>{ this.data.people.q=e.target.value; this.save(); keepFocus($("#roles-body"),()=>this.render()); }); }
      if(role==="designers"){ const updatePalCss=()=>{ const pal=this.data.designers.palette; $("#pal-css").textContent=pal.map((c,i)=>`  --swatch-${i+1}: ${c};`).join("\n"); }; updatePalCss(); $$("[data-pal]").forEach(inp=>inp.addEventListener("input",()=>{ this.data.designers.palette[+inp.dataset.pal]=inp.value; this.save(); updatePalCss(); })); $("#pal-copy")?.addEventListener("click",()=>{ const css=`:root {\n${$("#pal-css").textContent}\n}`; navigator.clipboard?.writeText(css).then(()=>toast("CSS vars copied")); }); ["primary","secondary","cream"].forEach(k=>$("#bk-"+k)?.addEventListener("input",e=>{ this.data.designers.brand[k]=e.target.value; this.save(); })); $("#mood-add")?.addEventListener("click",()=>{ this.data.designers.pins.unshift({url:$("#mood-url")?.value||"",note:$("#mood-note")?.value||""}); this.save(); this.render(); }); $("#stack-add")?.addEventListener("click",()=>{ this.data.designers.stack.push("Card "+(this.data.designers.stack.length+1)); this.save(); this.render(); }); }
      if(role==="product"){ $$("[data-up]").forEach(b=>b.addEventListener("click",()=>{ this.data.product.requests[+b.dataset.up].votes++; this.save(); this.render(); })); $("#feat-add")?.addEventListener("click",()=>{ const t=prompt("Feature request"); if(!t)return; this.data.product.requests.push({t,votes:1}); this.save(); this.render(); }); }
      if(role==="founders"){ $("#fund-add")?.addEventListener("click",()=>{ this.data.founders.funding.push({round:"Round",amount:"TBD",status:"Open"}); this.save(); this.render(); }); $("#wl-add")?.addEventListener("click",()=>{ const e=$("#wl-email")?.value?.trim(); if(!e)return; this.data.founders.waitlist.push(e); this.save(); toast("Captured locally"); this.render(); }); if(window.MCLaunch) window.MCLaunch.renderFoundersVault($("#founders-launch-extra")); }
    }
  };


  const games = {
    render(){
      let pane=$("#games-pane");
      if(!pane){ const split=$("#stage-split"); if(!split)return; pane=document.createElement("section"); pane.className="roles-pane stage-pane"; pane.dataset.pane="games"; pane.id="games-pane"; pane.innerHTML=`<div class="pane-label"><span>Games arcade</span><span class="pane-badge">v0 · local</span></div><div class="roles-body" id="games-body"></div>`; split.appendChild(pane); } const body=$("#games-body");
      body.innerHTML=`<div class="role-kit-grid"><div class="role-section"><h3>Click-collect</h3><p class="panel-copy small">Score in 10s.</p><div style="font-size:28px;font-weight:800" id="cc-score">0</div><button type="button" class="btn btn-primary btn-sm" id="cc-start">Start</button> <button type="button" class="btn btn-accent btn-sm" id="cc-hit" disabled>Collect</button></div><div class="role-section"><h3>Bubble pop</h3><canvas id="bubble-canvas" width="320" height="180" style="width:100%;background:#111;border-radius:10px;cursor:crosshair"></canvas><button type="button" class="btn btn-ghost btn-sm" id="bubble-reset">Reset</button></div><div class="role-section"><h3>Reaction pad</h3><button type="button" class="btn btn-primary" id="react-pad" style="width:100%;height:80px">Wait…</button><p class="panel-copy small" id="react-msg">Click when it turns cream.</p></div></div>`;
      let score=0,timer; $("#cc-start").onclick=()=>{ score=0; $("#cc-score").textContent="0"; $("#cc-hit").disabled=false; clearInterval(timer); let left=10; timer=setInterval(()=>{ left--; if(left<=0){ clearInterval(timer); $("#cc-hit").disabled=true; toast("Score: "+score);} },1000); }; $("#cc-hit").onclick=()=>{ score++; $("#cc-score").textContent=String(score); };
      const bc=$("#bubble-canvas"), ctx=bc.getContext("2d"); let bubbles=[]; const spawn=()=>{ bubbles=Array.from({length:8},()=>({x:Math.random()*300+10,y:Math.random()*160+10,r:10+Math.random()*16})); draw(); }; const draw=()=>{ ctx.clearRect(0,0,320,180); ctx.fillStyle="#c8102e"; bubbles.forEach(b=>{ ctx.beginPath(); ctx.arc(b.x,b.y,b.r,0,Math.PI*2); ctx.fill(); }); }; spawn(); bc.onclick=e=>{ const r=bc.getBoundingClientRect(); const x=((e.clientX-r.left)/r.width)*320, y=((e.clientY-r.top)/r.height)*180; bubbles=bubbles.filter(b=>Math.hypot(b.x-x,b.y-y)>b.r); draw(); if(!bubbles.length){ toast("Cleared!"); spawn(); } }; $("#bubble-reset").onclick=spawn;
      let armed=false,t0=0; const pad=$("#react-pad"); const arm=()=>{ pad.textContent="Wait…"; pad.style.background="#c8102e"; pad.style.color=""; armed=false; setTimeout(()=>{ pad.textContent="NOW"; pad.style.background="#f3ead8"; pad.style.color="#111"; armed=true; t0=performance.now(); },800+Math.random()*1600); }; arm(); pad.onclick=()=>{ if(!armed){ $("#react-msg").textContent="Too soon."; arm(); return; } $("#react-msg").textContent=Math.round(performance.now()-t0)+" ms"; armed=false; setTimeout(arm,700); };
    }
  };

  function ensureExtrasInDom(){
    // Role kits portal shortcut injected after roles render via Mutation — also static hint
    document.addEventListener("click", function portalRoleJump(e){ const b=e.target.closest("[data-open-portal]"); if(b) goStage("portal"); }, true);
    if(!$('.rail-btn[data-stage="games"]')){ const settingsBtn=$('.rail-btn[data-stage="settings"]'); if(settingsBtn){ const b=document.createElement("button"); b.type="button"; b.className="rail-btn"; b.dataset.stage="games"; b.title="Games"; b.innerHTML=`<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="7" width="14" height="10" rx="2" fill="none" stroke="currentColor" stroke-width="1.7"/><circle cx="9" cy="12" r="1.2" fill="currentColor"/><circle cx="15" cy="12" r="1.2" fill="currentColor"/></svg><span>Games</span>`; settingsBtn.parentNode.insertBefore(b,settingsBtn); b.addEventListener("click",()=>goStage("games")); } }
    if(!$('.panel-view[data-view="games"]')){ const settings=$('.panel-view[data-view="settings"]'); if(settings){ const sec=document.createElement("section"); sec.className="panel-view"; sec.dataset.view="games"; sec.hidden=true; sec.innerHTML=`<div class="panel-head"><h1>Games</h1></div><p class="panel-copy">Mini arcade — click-collect, bubble pop, reaction pad. Local · free.</p>`; settings.parentNode.insertBefore(sec,settings); } }
    const grid=$("#direction-grid");
    if(grid && !grid.querySelector('[data-theme="neo"]')){ grid.insertAdjacentHTML("beforeend", `<button type="button" class="direction-card" data-theme="neo"><div class="direction-preview direction-preview--neo" aria-hidden="true"><span class="dp-bar"></span><span class="dp-rail"></span><span class="dp-stage"></span></div><strong>Neobrutalist</strong><span>Hard edges · loud blocks</span></button><button type="button" class="direction-card" data-theme="mono"><div class="direction-preview direction-preview--mono" aria-hidden="true"><span class="dp-bar"></span><span class="dp-rail"></span><span class="dp-stage"></span></div><strong>Monochrome</strong><span>Black / white / gray</span></button>`); grid.style.gridTemplateColumns="repeat(auto-fill, minmax(140px, 1fr))"; }
    const block=$('.panel-view[data-view="settings"] .settings-block');
    if(block && !$("#opt-glass")){ block.insertAdjacentHTML("beforeend", `<label class="check"><input type="checkbox" id="opt-glass"><span>Liquid-glass / frosted chrome</span></label><label class="check"><input type="checkbox" id="opt-motion"><span>Motion kit (parallax / sticky demo)</span></label>`); }
    const pc=$("#paint-controls-panel")||$(".paint-toolbar-inline");
    if(pc && !$("#paint-to-image")){ pc.insertAdjacentHTML("beforeend", `<button type="button" class="btn btn-accent btn-sm" id="paint-to-image" title="Fills the canvas with local placeholder art — no AI model">Draw → Image (placeholder)</button><progress id="paint-gen-progress" max="100" value="0" hidden style="width:120px"></progress>`); }
    const design=$('.panel-view[data-view="design"]');
    if(design && !$("#motion-demo")){ design.insertAdjacentHTML("beforeend", `<div class="settings-block" id="motion-demo"><p class="eyebrow">Motion kit</p><div class="motion-demo-stage"><div class="parallax-layer">Parallax layer</div><div class="sticky-foot">Sticky footer demo</div></div><p class="panel-copy small">Toggle in Settings · CSS only.</p></div>`); }
  }

  function syncLookCards(){ $$("#direction-grid .direction-card").forEach(c=>{ const on=c.dataset.theme===state.theme; c.classList.toggle("is-selected",on); c.setAttribute("aria-pressed",on?"true":"false"); }); }
  function closeLook(){ $("#direction-modal").hidden=true; const o=state._lookOpener; if(o&&o.isConnected) o.focus?.({preventScroll:true}); }
  /* Studio hero presets: only restyle the Studio preview artboard, never the shell look */
  const HERO_LABELS={none:"No hero preset",globe:"Immersive globe",aurora:"Aurora hero"};
  function applyHero(h){ if(!HERO_LABELS[h]) h="none"; if(h==="none") document.documentElement.removeAttribute("data-hero"); else document.documentElement.setAttribute("data-hero",h); try{ localStorage.setItem(LS.hero,h); }catch(_){} $$(".hero-card").forEach(c=>{ const on=c.dataset.hero===h; c.classList.toggle("is-selected",on); c.setAttribute("aria-pressed",on?"true":"false"); }); }
  function chooseHero(h){ applyHero(h); localStorage.setItem(LS.seenDir,"1"); $("#direction-modal").hidden=true; goStage("studio"); const art=$("#artboard"); if(art){ art.classList.remove("is-flash"); void art.offsetWidth; art.classList.add("is-flash"); setTimeout(()=>art.classList.remove("is-flash"),1600); } toast(h==="none" ? "Studio hero preset removed — Studio preview is back to plain" : `${HERO_LABELS[h]} applied to the Studio preview hero (shell look unchanged)`); $("#studio-pane-title")?.focus?.({preventScroll:true}); }
  function chooseLook(t){ if(!t) return; if(t==="globe"||t==="aurora"){ chooseHero(t); return; } state.pendingTheme=t; { applyTheme(t); toast("Applied "+(THEME_LABELS[t]||t)); } syncLookCards(); localStorage.setItem(LS.seenDir,"1"); if(state.stage==="home") renderHome(); closeLook(); }
  function openDirections(){ state.pendingTheme=state.theme; state._lookOpener=document.activeElement; syncLookCards(); $("#direction-modal").hidden=false; requestAnimationFrame(()=>{ ($("#direction-grid .direction-card.is-selected")||$("#direction-grid .direction-card"))?.focus({preventScroll:true}); }); }

  function bindGlobal(){
    $("#app-nav")?.addEventListener("click",e=>{ const b=e.target.closest(".rail-btn[data-stage]"); if(b) goStage(b.dataset.stage,{focus:true}); });
    (function typingGuard(){
      // Intent to leave a field = a pointer press somewhere else, or Tab / Escape / F6 / a modifier shortcut.
      // Pressing inside the field itself, or plain typing, is never a reason for focus to jump away.
      let intent=0, intentTarget=null; const mark=t=>{ intent=performance.now(); intentTarget=t||null; };
      document.addEventListener("pointerdown",e=>mark(e.target),true);
      document.addEventListener("keydown",e=>{ if(e.key==="Tab"||e.key==="Escape"||e.key==="F6"||e.ctrlKey||e.metaKey||e.altKey) mark(null); },true);
      document.addEventListener("focusout",e=>{
        const el=e.target, to=e.relatedTarget; if(!isEditable(el) || !to || isEditable(to)) return;
        if(performance.now()-intent<700 && !(intentTarget && el.contains(intentTarget))) return;
        let s0=null,s1=null; try{ s0=el.selectionStart; s1=el.selectionEnd; }catch(_){}
        setTimeout(()=>{ if(!el.isConnected || !el.offsetParent || document.activeElement!==to) return; el.focus({preventScroll:true}); try{ if(s0!=null) el.setSelectionRange(s0,s1); }catch(_){} },0);
      },true);
    })();
    $("#app-nav")?.addEventListener("keydown",e=>{ if(!["ArrowDown","ArrowUp","Home","End"].includes(e.key)) return; const items=$$(".rail-btn[data-stage]"); const i=items.indexOf(document.activeElement); if(i<0) return; e.preventDefault(); let n=i; if(e.key==="ArrowDown")n=Math.min(items.length-1,i+1); if(e.key==="ArrowUp")n=Math.max(0,i-1); if(e.key==="Home")n=0; if(e.key==="End")n=items.length-1; items[n].focus(); });
    document.body.addEventListener("click",e=>{ const g=e.target.closest("[data-goto]"); if(g){ goStage(g.dataset.goto,{focus:!!g.closest(".home-pane,.atelier-native,.bottom-bar,.home-snapshot")}); return; } const l=e.target.closest("[data-open-look]"); if(l) openDirections(); });
    $("#btn-nav-toggle")?.addEventListener("click",()=>setNavOpen(!document.documentElement.classList.contains("nav-open")));
    $("#btn-bb-more")?.addEventListener("click",()=>setNavOpen(!document.documentElement.classList.contains("nav-open")));
    $("#nav-backdrop")?.addEventListener("click",()=>setNavOpen(false));
    const applyRail=on=>{ document.documentElement.classList.toggle("rail-collapsed",on); const b=$("#btn-rail-collapse"); if(b){ b.setAttribute("aria-pressed",on?"true":"false"); b.setAttribute("aria-label",on?"Expand navigation":"Collapse navigation"); b.title=on?"Expand navigation":"Collapse navigation"; } };
    applyRail(localStorage.getItem(LS.railCollapsed)==="1");
    $("#btn-rail-collapse")?.addEventListener("click",()=>{ const on=!document.documentElement.classList.contains("rail-collapsed"); localStorage.setItem(LS.railCollapsed,on?"1":"0"); applyRail(on); });
    document.addEventListener("keydown",e=>{ if(e.key!=="Escape"||e.defaultPrevented) return; const m=$("#direction-modal"); if(m&&!m.hidden){ closeLook(); return; } const d=$("#prompt-drawer"); if(d&&!d.hidden){ d.hidden=true; return; } if(document.documentElement.classList.contains("nav-open")){ setNavOpen(false); $("#btn-nav-toggle")?.focus(); } });
    window.addEventListener("hashchange",()=>{ const h=(location.hash||"").slice(1); if(h && h!==state.stage && LAYOUT[h]) goStage(h,{keepHash:true}); });
    $("#btn-overview")?.addEventListener("click",()=>{ const cur=document.documentElement.getAttribute("data-nav"); setNav(cur==="overview"?"flow":"overview"); renderPuzzle(); });
    $("#btn-exit-overview")?.addEventListener("click",()=>{ setNav("flow"); renderPuzzle(); });
    $("#btn-new-look")?.addEventListener("click",()=>openDirections());
    $("#btn-open-directions")?.addEventListener("click",()=>openDirections());
    $$("[data-close-modal]").forEach(el=>el.addEventListener("click",()=>closeLook()));
    $("#direction-grid")?.addEventListener("click",e=>{ const card=e.target.closest(".direction-card"); if(!card)return; chooseLook(card.dataset.theme); });
    $("#hero-grid")?.addEventListener("click",e=>{ const card=e.target.closest(".hero-card"); if(!card)return; chooseHero(card.dataset.hero); });
    $("#apply-direction")?.addEventListener("click",()=>chooseLook(state.pendingTheme||state.theme));
    $("#btn-publish")?.addEventListener("click",()=>toast("Publish demo — not live deploy from shell"));
    $("#btn-preview")?.addEventListener("click",()=>{ const on=$("#btn-preview").getAttribute("aria-pressed")!=="true"; $("#btn-preview").setAttribute("aria-pressed",on?"true":"false"); toast(on?"Preview mode":"Edit chrome"); });
    $("#btn-save-intent")?.addEventListener("click",()=>{ localStorage.setItem(LS.intent,$("#intent-text")?.value||""); toast("Brief saved"); goStage("design",{focus:true}); });
    $("#btn-first-look")?.addEventListener("click",()=>{
      if(!window.MCLaunch) return;
      const fl = window.MCLaunch.firstLook($("#intent-text")?.value||"");
      const out=$("#first-look-out"); if(!out)return;
      out.hidden=false;
      if(!fl.line){ out.innerHTML=`<p class="panel-copy small">Write a rough idea in the brief first, then press First Look.</p>`; return; }
      out.innerHTML=`<p class="lp-sharp"><strong>Sharper:</strong> ${escapeHtml(fl.line)}</p><p class="panel-copy small">Stage 1 preview score: ${fl.score}/100 (local rules, not AI)</p>${(fl.missing&&fl.missing.length)?`<p class="panel-copy small"><strong>To make it stronger:</strong></p><ul class="bullet-list small">${fl.missing.map(m=>`<li>${escapeHtml(m)}</li>`).join("")}</ul>`:`<p class="panel-copy small">${escapeHtml(fl.note)}</p>`}<button type="button" class="btn btn-ghost btn-sm" id="btn-apply-sharp">Use this as my brief</button>`;
      $("#btn-apply-sharp")?.addEventListener("click",()=>{ if(fl.line && $("#intent-text")){ $("#intent-text").value=fl.line; localStorage.setItem(LS.intent,fl.line); toast("Brief updated"); }});
    });
    $$(".mode-btn").forEach(b=>b.addEventListener("click",()=>{ state.mode=b.dataset.mode; $$(".mode-btn").forEach(x=>{ const on=x===b; x.classList.toggle("is-active",on); x.setAttribute("aria-selected",on?"true":"false"); }); const launchCoach=state.stage==="launch"; $("#mode-hint").textContent=state.mode==="plan"?(launchCoach?"Plan · Coach mode — rubric score + strengths + strengthen + next step.":"Plan — advisory replies. Local demo only · free."):"Build — generates and edits the landing page in the preview. Local templates, not AI."; }));
    const chips=$("#prompt-chips"); if(chips){ chips.innerHTML=PROMPTS.map(p=>`<button type="button" class="prompt-chip" data-prompt="${escapeHtml(p.text)}">${escapeHtml(p.label)}</button>`).join(""); chips.addEventListener("click",e=>{ const c=e.target.closest(".prompt-chip"); if(!c)return; $("#chat-input").value=c.dataset.prompt; $("#chat-input").focus(); }); }
    $("#chat-form")?.addEventListener("submit",e=>{ e.preventDefault(); const input=$("#chat-input"); const text=(input.value||"").trim(); if(!text&&!state.attachments.length)return; const attachNote=state.attachments.length?` [${state.attachments.map(a=>a.name).join(", ")}]`:""; addMsg("You",`<p>${escapeHtml(text)}${escapeHtml(attachNote)}</p>`); input.value=""; addMsg(state.mode==="plan"?"Plan":"Build", state.mode==="plan"?planReply(text):buildApply(text)); state.attachments=[]; renderAttach(); });
    function renderAttach(){ const box=$("#attach-chips"); if(!box)return; box.hidden=!state.attachments.length; box.innerHTML=state.attachments.map((a,i)=>`<span class="attach-chip">${escapeHtml(a.name)} <button type="button" data-i="${i}" aria-label="Remove">✕</button></span>`).join(""); box.querySelectorAll("button").forEach(b=>b.addEventListener("click",()=>{ state.attachments.splice(+b.dataset.i,1); renderAttach(); })); }
    $("#btn-attach")?.addEventListener("click",()=>$("#file-input")?.click());
    $("#file-input")?.addEventListener("change",e=>{ [...e.target.files].forEach(f=>state.attachments.push({name:f.name,type:f.type})); e.target.value=""; renderAttach(); });
    $("#project-name")?.addEventListener("change",e=>localStorage.setItem(LS.project,e.target.value));
    const pn=localStorage.getItem(LS.project); if(pn&&$("#project-name"))$("#project-name").value=pn;
    const intent=localStorage.getItem(LS.intent); if(intent&&$("#intent-text"))$("#intent-text").value=intent;
    try{ const art=JSON.parse(localStorage.getItem(LS.art)||"null"); if(art){ if(art.h)$("#art-headline").value=art.h; if(art.s)$("#art-subline").value=art.s; if(art.n)$("#art-note").value=art.n; } }catch(_){ }
    $$(".ops-tab").forEach(b=>b.addEventListener("click",()=>ops.setTab(b.dataset.ops)));
    $("#sheet-add-row")?.addEventListener("click",()=>{ ops.sheet.rows.push(ops.sheet.cols.map(()=>"")); ops.persist(); ops.renderSheet(); });
    $("#sheet-add-col")?.addEventListener("click",()=>{ const name=prompt("Column name","Col "+(ops.sheet.cols.length+1)); if(!name)return; ops.sheet.cols.push(name); ops.sheet.rows.forEach(r=>r.push("")); ops.persist(); ops.renderSheet(); });
    $("#sheet-export")?.addEventListener("click",()=>{ const lines=[ops.sheet.cols.join(",")].concat(ops.sheet.rows.map(r=>r.map(c=>`"${String(c).replace(/"/g,'""')}"`).join(","))); const blob=new Blob([lines.join("\n")],{type:"text/csv"}); const a=document.createElement("a"); a.href=URL.createObjectURL(blob); a.download="mercatus-concierge-ops.csv"; a.click(); });
    $("#sheet-import")?.addEventListener("change",e=>{ const f=e.target.files[0]; if(!f)return; const reader=new FileReader(); reader.onload=()=>{ const lines=String(reader.result).trim().split(/\r?\n/); const parse=line=>line.split(",").map(c=>c.replace(/^"|"$/g,"").replace(/""/g,'"')); ops.sheet.cols=parse(lines[0]); ops.sheet.rows=lines.slice(1).map(parse); ops.persist(); ops.renderSheet(); toast("CSV imported"); }; reader.readAsText(f); });
    $("#recruit-add")?.addEventListener("click",()=>{ const name=prompt("Candidate name"); if(!name)return; ops.recruit.Sourced.push({id:"c"+Date.now(),name,role:"General",touched:new Date().toISOString()}); ops.persist(); ops.renderRecruit(); });
    $("#estate-add")?.addEventListener("click",()=>{ const title=prompt("Deal title"); if(!title)return; ops.estate.Lead.push({id:"d"+Date.now(),title,value:"TBD"}); ops.persist(); ops.renderEstate(); });
    $("#team-add")?.addEventListener("click",()=>{ ops.team.push({id:"t"+Date.now(),name:"Coworker",role:"Analyst",brief:""}); ops.persist(); ops.renderTeam(); });
    $("#role-switcher")?.addEventListener("change",e=>{ state.role=e.target.value; roles.render(); });
    $("#opt-show-iframe")?.addEventListener("change",e=>{ localStorage.setItem(LS.showOverview,e.target.checked?"1":"0"); syncOverview(); toast(e.target.checked?"Concierge overview card on":"Concierge overview card off — the Concierge tab shows an Open in new tab card"); });
    $("#opt-dense")?.addEventListener("change",e=>document.body.classList.toggle("is-dense",e.target.checked));
    document.body.addEventListener("change",e=>{ if(e.target.id==="opt-glass") setGlass(e.target.checked); if(e.target.id==="opt-motion") setMotion(e.target.checked); });
    const fbShow=$("#fallback-show"); if(fbShow) fbShow.addEventListener("click",()=>{ localStorage.setItem(LS.showOverview,"1"); syncOverview(); });
    if(window.self!==window.top){ const r=$("#fallback-reason"); if(r) r.textContent="This page is open inside another frame. The overview still works, but for the full experience open the Concierge in its own tab."; }
    syncOverview();
    addMsg("Plan",`<p>Welcome to <strong>Mercatus Concierge</strong>. In <strong>Plan</strong>, describe your business and get a page outline. Switch to <strong>Build</strong> and try “Build a landing page for a coffee roastery, headline 'Fresh Roast Daily', warm brown theme”, then follow up with “add a pricing section” or “make it darker”. Replies come from local templates, not AI.</p>`);
  }


  // Mercatus Concierge first-party studio — prompt + frames + artboard
  (function bindMcStudio(){
    const promptEl = $("#mc-studio-prompt");
    const genBtn = $("#mc-studio-generate");
    const artboard = $("#artboard");
    function applyStudioPrompt(){
      const text = (promptEl?.value || "").trim();
      if (!text) { toast("Describe what to build first"); return; }
      const chat = $("#chat-input");
      if (chat) chat.value = text;
      const buildBtn = document.querySelector('.mode-btn[data-mode="build"]');
      if (buildBtn) buildBtn.click();
      if (window.MCBuilder) { const r = window.MCBuilder.apply(text); try{ studio.resizeAnn(); }catch(_){}
        addMsg("You",`<p>${escapeHtml(text)}</p>`); addMsg("Build",`<p>${r.isNew?"Built":"Updated"} the preview <span class="msg-tag">local template, not AI</span></p><ul>${r.notes.map(n=>`<li>${escapeHtml(n)}</li>`).join("")}</ul>`);
        if (chat) chat.value = ""; toast(r.isNew?"Page built in the preview":"Preview updated"); return; }
      toast("Mercatus Concierge preview updated");
    }
    genBtn?.addEventListener("click", applyStudioPrompt);
    promptEl?.addEventListener("keydown", e => {
      if (e.key === "Enter") { e.preventDefault(); applyStudioPrompt(); }
    });
    $$(".mc-frame-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const frame = btn.dataset.frame || "desktop";
        $$(".mc-frame-btn").forEach(b => {
          const on = b === btn;
          b.classList.toggle("is-active", on);
          b.setAttribute("aria-pressed", on ? "true" : "false");
        });
        if (artboard) {
          artboard.dataset.frame = frame;
          artboard.classList.remove("is-desktop", "is-tablet", "is-mobile");
          artboard.classList.add("is-" + frame);
        }
        try { studio.resizeAnn(); } catch (_) {}
      });
    });
  })();

  /* Fold injected extras into the right panes (no extra nav rows) */
  function placeExtras(){
    const art=$("#mc-artifacts"), blk=$("#artifact-block"); if(art&&blk){ art.querySelector(".mc-art-ctx")?.remove(); blk.appendChild(art); }
    const close=$("#prompt-drawer-close"); if(close&&!close.getAttribute("aria-label")) close.setAttribute("aria-label","Close prompt library");
    const router=$("#agent-router"); if(router) router.setAttribute("aria-label","Reply style (demo)");
    const sc=$("#start-chips .eyebrow"); if(sc) sc.textContent="Or jump straight to";
  }
  /* Give any control without an accessible name one, from its placeholder/title */
  function labelUnnamed(root){
    $$("button, input, select, textarea", root||document).forEach(el=>{
      if(el.type==="hidden"||el.getAttribute("aria-label")||el.getAttribute("aria-labelledby")) return;
      if(el.tagName==="BUTTON"){ if((el.textContent||"").trim()) return; const t=el.title; if(t) el.setAttribute("aria-label",t); return; }
      if(el.id && document.querySelector(`label[for="${el.id}"]`)) return; if(el.closest("label")) return;
      const t=el.getAttribute("placeholder")||el.title; if(t) el.setAttribute("aria-label",t);
    });
  }
  window.MCLabelUnnamed = labelUnnamed;

  function init(){ const boot=()=>{ ensureExtrasInDom(); if(window.MCMeeting) window.MCMeeting.ensure(); if(window.MCReplit) window.MCReplit.ensure(); if(window.MCBolt) window.MCBolt.ensure(); applyTheme(state.theme); applyHero(localStorage.getItem(LS.hero)||"none"); setGlass(state.glass); setMotion(state.motion); setNav("flow"); ops.load(); roles.load(); studio.init(); bindGlobal(); if(window.MCBuilder) window.MCBuilder.render(); placeExtras(); const h=(location.hash||"").slice(1); const lv=localStorage.getItem(LS.lastView); goStage(LAYOUT[h]?h:(LAYOUT[lv]?lv:"home"),{keepHash:!LAYOUT[h]&&!lv}); const cdb=$("#cdb-host"); if(cdb&&window.MCDB) window.MCDB.bindUi(cdb); labelUnnamed(); }; if(window.MCDB) window.MCDB.init().then(boot).catch(boot); else boot(); }
  if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",init); else init();
})();
