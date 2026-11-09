/* Bolt-inspired chrome — additive local demos (no Cloud/Stripe/WebContainers) */
window.MCBolt = (function(){
  const $=(s,el=document)=>el.querySelector(s);
  const $$=(s,el=document)=>[...el.querySelectorAll(s)];
  function esc(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
  const PROMPTS = [
    {id:"p1", title:"Landing hero", body:"Build a Blueprint red/black landing with wheat mark and Open Concierge CTA."},
    {id:"p2", title:"Ops sheet", body:"Add three hiring metrics to the Ops spreadsheet and mark status Active."},
    {id:"p3", title:"Portal invoice", body:"Open Client Portal as owner and mark invoice paid (stub)."},
    {id:"p4", title:"Slides deck", body:"Create a 4-slide pitch: problem, atelier, ops, ask."}
  ];

  function ensure(){
    injectStartChips();
    injectAgentRouter();
    injectVoiceAndHealth();
    injectPromptDrawer();
    injectIdeAndSlidesAndChecks();
    injectHabitTile();
  }

  function injectStartChips(){
    const intent = $('.panel-view[data-view="intent"]');
    if(!intent || $("#start-chips")) return;
    intent.insertAdjacentHTML("beforeend", `<div class="settings-block" id="start-chips"><p class="eyebrow">Start</p>
      <div class="prompt-chips">
        <button type="button" class="prompt-chip" data-start="website">Website</button>
        <button type="button" class="prompt-chip" data-start="slides">Slides</button>
        <button type="button" class="prompt-chip" data-start="app">App</button>
        <button type="button" class="prompt-chip" data-start="prototype">Prototype</button>
        <button type="button" class="prompt-chip" data-start="figma" title="Stub">Figma</button>
        <button type="button" class="prompt-chip" data-start="github" title="Stub">GitHub</button>
        <button type="button" class="prompt-chip" data-start="team" title="Stub">Team</button>
      </div></div>`);
    intent.addEventListener("click", e=>{
      const b=e.target.closest("[data-start]"); if(!b)return;
      const map={website:"design",slides:"slides",app:"portal",prototype:"studio",figma:"design",github:"ide",team:"roles"};
      const stage=map[b.dataset.start]||"design";
      if(window.MCGoStage) window.MCGoStage(stage);
      else document.querySelector(`.rail-btn[data-stage="${stage}"]`)?.click();
      const t=document.getElementById("toast"); if(t){t.textContent="Start: "+b.dataset.start; t.hidden=false; setTimeout(()=>t.hidden=true,2000);}
    });
  }

  function injectAgentRouter(){
    const head = $('.panel-view[data-view="chat"] .panel-head');
    if(!head || $("#agent-router")) return;
    head.insertAdjacentHTML("beforeend", `<label class="agent-router"><span class="sr-only">Agent</span>
      <select id="agent-router" title="Agent / model router">
        <option>Bolt Agent</option><option selected>Standard</option><option>Forge OSS</option>
      </select></label>`);
  }

  function injectVoiceAndHealth(){
    const form = $("#chat-form");
    if(!form || $("#voice-btn")) return;
    const health = `<div class="ctx-health" id="ctx-health" title="Context health"><span class="ctx-bar"><i style="width:72%"></i></span><span>Context 72%</span></div>`;
    const chat = $('.panel-view[data-view="chat"]');
    if(chat && !$("#ctx-health")) chat.querySelector(".mode-hint")?.insertAdjacentHTML("afterend", health);
    const btn = document.createElement("button");
    btn.type="button"; btn.id="voice-btn"; btn.className="icon-btn"; btn.title="Voice to prompt (stub)"; btn.setAttribute("aria-label","Voice to prompt");
    btn.innerHTML=`<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M6 11a6 6 0 0 0 12 0M12 17v3" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>`;
    form.insertBefore(btn, form.firstChild);
    btn.addEventListener("click",()=>{
      const input=$("#chat-input"); if(!input)return;
      input.value="(Voice stub) Make the studio hero denser with a gold CTA.";
      input.focus();
      const t=document.getElementById("toast"); if(t){t.textContent="Transcribe stub → chat"; t.hidden=false; setTimeout(()=>t.hidden=true,2000);}
    });
  }

  function injectPromptDrawer(){
    if($("#prompt-drawer")) return;
    document.body.insertAdjacentHTML("beforeend", `<aside id="prompt-drawer" class="prompt-drawer" hidden>
      <div class="modal-head"><div><p class="eyebrow">Prompt library</p><h2>Saved prompts</h2></div>
      <button type="button" class="icon-btn" id="prompt-drawer-close">✕</button></div>
      <div class="prompt-lib">${PROMPTS.map(p=>`<button type="button" class="role-card prompt-lib-item" data-body="${esc(p.body)}"><strong>${esc(p.title)}</strong><p>${esc(p.body)}</p></button>`).join("")}</div>
    </aside>`);
    const chat = $('.panel-view[data-view="chat"] .panel-head');
    if(chat && !$("#btn-prompts")){
      chat.insertAdjacentHTML("beforeend", `<button type="button" class="btn btn-ghost btn-sm" id="btn-prompts">Prompts</button>`);
      $("#btn-prompts").onclick=()=>{$("#prompt-drawer").hidden=false;};
    }
    $("#prompt-drawer-close")?.addEventListener("click",()=>{$("#prompt-drawer").hidden=true;});
    $("#prompt-drawer")?.addEventListener("click",e=>{
      const it=e.target.closest("[data-body]"); if(!it)return;
      const input=$("#chat-input"); if(input){ input.value=it.dataset.body; input.focus(); }
      $("#prompt-drawer").hidden=true;
    });
  }

  function injectIdeAndSlidesAndChecks(){
    // stages injected via app STAGES already if we patch; render panes on demand
  }

  /* IDE: a small local file system (saved in this browser) with a real editor and an HTML preview */
  const IDE_LS="mc-ide-files";
  const IDE_SAMPLE={
    "index.html":"<!doctype html>\n<html>\n<head>\n  <link rel=\"stylesheet\" href=\"styles.css\">\n</head>\n<body>\n  <header class=\"hero\">\n    <h1>Fresh Roast Daily</h1>\n    <p>Small-batch coffee, roasted in Johannesburg.</p>\n    <a class=\"btn\" href=\"#\">Order beans</a>\n  </header>\n</body>\n</html>\n",
    "styles.css":"body { margin: 0; font-family: system-ui, sans-serif; background: #f6efe6; color: #2b1d14; }\n.hero { padding: 48px 32px; }\n.hero h1 { font-size: 40px; margin: 0 0 8px; }\n.btn { display: inline-block; margin-top: 12px; padding: 10px 18px; border-radius: 999px; background: #8b4a2b; color: #fff; text-decoration: none; }\n",
    "app.js":"// Scripts are not run in the preview (it is sandboxed).\nconsole.log('hello from app.js');\n",
    "README.md":"# My project\n\nEdit files on the left. Press Save (or Ctrl/Cmd+S).\nThe Preview shows index.html with styles.css applied.\n"
  };
  function ideLoad(){ try{ const d=JSON.parse(localStorage.getItem(IDE_LS)); if(d&&d.files&&Object.keys(d.files).length) return d; }catch(_){} return {files:Object.assign({},IDE_SAMPLE), open:"index.html"}; }
  function ideSave(d){ try{ localStorage.setItem(IDE_LS, JSON.stringify(d)); return true; }catch(_){ return false; } }
  function renderIde(host){
    const d=ideLoad(); let cur=d.files[d.open]!=null?d.open:Object.keys(d.files)[0]; let dirty=false;
    host.innerHTML = `<div class="ide-chrome">
      <div class="ide-tree"><p class="eyebrow">Files</p><ul id="ide-files" role="listbox" aria-label="Files"></ul>
        <div class="ide-tree-actions"><button type="button" class="btn btn-ghost btn-sm" id="ide-new">New file</button><button type="button" class="btn btn-ghost btn-sm" id="ide-del">Delete</button><button type="button" class="btn btn-ghost btn-sm" id="ide-reset">Reset samples</button></div></div>
      <div class="ide-main">
        <div class="ide-editor-head"><strong id="ide-cur"></strong><span class="ide-dirty" id="ide-dirty" hidden>● unsaved</span><span class="ide-spacer"></span><button type="button" class="btn btn-primary btn-sm" id="ide-save">Save</button><button type="button" class="btn btn-ghost btn-sm" id="ide-run">Preview</button></div>
        <div class="ide-editor"><pre class="ide-gutter" id="ide-gutter" aria-hidden="true"></pre><textarea id="ide-text" spellcheck="false" autocapitalize="off" autocomplete="off" aria-label="File contents"></textarea></div>
        <iframe class="ide-preview-frame" id="ide-frame" title="Preview of index.html" sandbox=""></iframe>
        <div class="ide-term"><p class="eyebrow">Log</p><pre id="ide-log">Files are saved in this browser. The preview renders index.html + styles.css; scripts don't run.</pre></div>
      </div>
    </div>
    <div class="postbuild-strip" id="postbuild-strip"><strong>Self-check</strong><button type="button" class="btn btn-ghost btn-sm" id="run-selfcheck">Check my files</button><div id="selfcheck-results" class="panel-copy small"></div></div>`;
    const ta=$("#ide-text"), gut=$("#ide-gutter"), log=m=>{ const l=$("#ide-log"); l.textContent+="\n"+m; l.scrollTop=l.scrollHeight; };
    const gutter=()=>{ const n=(ta.value.match(/\n/g)||[]).length+1; gut.textContent=Array.from({length:n},(_,i)=>i+1).join("\n"); gut.scrollTop=ta.scrollTop; };
    const setDirty=v=>{ dirty=v; $("#ide-dirty").hidden=!v; };
    const tree=()=>{ $("#ide-files").innerHTML=Object.keys(d.files).sort().map(f=>`<li><button type="button" class="ide-file${f===cur?" is-active":""}" data-file="${esc(f)}" role="option" aria-selected="${f===cur}">${/\.css$/.test(f)?"🎨":/\.js$/.test(f)?"⚙️":/\.html?$/.test(f)?"📄":"📝"} ${esc(f)}</button></li>`).join(""); };
    const open=f=>{ if(dirty) save(true); cur=f; d.open=f; ta.value=d.files[f]||""; $("#ide-cur").textContent=f; setDirty(false); tree(); gutter(); ideSave(d); };
    const save=(quiet)=>{ d.files[cur]=ta.value; const ok=ideSave(d); setDirty(false); if(!quiet) log(ok?`saved ${cur} (${ta.value.length} chars)`:"could not save — browser storage full"); preview(); };
    const preview=()=>{ let html=d.files["index.html"]||"<p>No index.html</p>"; const css=d.files["styles.css"]||""; html=html.replace(/<link[^>]+styles\.css[^>]*>/i,"").replace(/<script[\s\S]*?<\/script>/gi,""); $("#ide-frame").srcdoc=`<style>${css}</style>`+html; };
    $("#ide-files").addEventListener("click",e=>{ const b=e.target.closest("[data-file]"); if(b) open(b.dataset.file); });
    ta.addEventListener("input",()=>{ setDirty(true); gutter(); clearTimeout(ta._t); ta._t=setTimeout(()=>save(true),800); });
    ta.addEventListener("scroll",()=>{ gut.scrollTop=ta.scrollTop; });
    ta.addEventListener("keydown",e=>{ if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==="s"){ e.preventDefault(); save(); } if(e.key==="Tab"&&!e.shiftKey){ e.preventDefault(); const a=ta.selectionStart,b=ta.selectionEnd; ta.value=ta.value.slice(0,a)+"  "+ta.value.slice(b); ta.selectionStart=ta.selectionEnd=a+2; setDirty(true); gutter(); } });
    $("#ide-save").onclick=()=>save(); $("#ide-run").onclick=()=>{ save(true); preview(); log("preview refreshed"); };
    $("#ide-new").onclick=()=>{ const n=(prompt("New file name","notes.md")||"").trim(); if(!n) return; if(!/^[\w.\-]+$/.test(n)){ log("file names can use letters, numbers, dot, dash and underscore"); return; } if(d.files[n]==null) d.files[n]=""; open(n); log("created "+n); };
    $("#ide-del").onclick=()=>{ if(Object.keys(d.files).length<2){ log("keep at least one file"); return; } if(!confirm("Delete "+cur+"?")) return; delete d.files[cur]; dirty=false; log("deleted "+cur); open(Object.keys(d.files)[0]); };
    $("#ide-reset").onclick=()=>{ if(!confirm("Replace all files with the samples?")) return; d.files=Object.assign({},IDE_SAMPLE); dirty=false; open("index.html"); log("samples restored"); };
    $("#run-selfcheck").onclick=()=>{ const r=[]; const h=d.files["index.html"]||""; r.push((h?"✅":"❌")+" index.html exists"); r.push((/<h1/i.test(h)?"✅":"⚠️")+" page has an <h1>"); r.push((/styles\.css/.test(h)?"✅":"⚠️")+" index.html links styles.css"); const css=d.files["styles.css"]||""; const bal=(css.match(/{/g)||[]).length===(css.match(/}/g)||[]).length; r.push((bal?"✅":"❌")+" styles.css braces balanced"); $("#selfcheck-results").innerHTML="<ul>"+r.map(x=>"<li>"+esc(x)+"</li>").join("")+"</ul>"; };
    open(cur); preview();
  }

  function renderSlides(host){
    const slides=[
      {t:"Mercatus Concierge", b:"Builder shell for Mens Mercatus · Katlego Mokoto", notes:"Open with Blueprint energy."},
      {t:"Atelier truth", b:"Mercatus Concierge stays source of truth — same-origin iframe + Open Concierge.", notes:"Mention CSP SAMEORIGIN."},
      {t:"Ops + Roles", b:"Founders Launch–style ops and Lovable-style role kits, all localStorage.", notes:"Demo sheet + recruiting."},
      {t:"Client Portal", b:"Atelier Desk mock — OTP, invoices, messages. No real payments.", notes:"Toggle client/owner."}
    ];
    let i=0, present=false;
    const draw=()=>{
      const s=slides[i];
      host.innerHTML=`<div class="slides-stage ${present?"is-present":""}">
        <div class="slide-card"><p class="eyebrow">Slide ${i+1}/${slides.length}</p><h2>${esc(s.t)}</h2><p>${esc(s.b)}</p></div>
        <div class="slide-notes" ${present?"hidden":""}><p class="eyebrow">Speaker notes</p><p>${esc(s.notes)}</p></div>
        <div class="btn-row">
          <button type="button" class="btn btn-ghost btn-sm" id="sl-prev">Prev</button>
          <button type="button" class="btn btn-ghost btn-sm" id="sl-next">Next</button>
          <button type="button" class="btn btn-primary btn-sm" id="sl-present">${present?"Exit present":"Present"}</button>
          <button type="button" class="btn btn-ghost btn-sm" id="sl-gate">Password gate</button>
        </div>
        <div id="sl-gate-box" class="role-section" hidden><label class="field"><span>Deck password (stub)</span><input id="sl-pass" type="password" placeholder="makeda"><button type="button" class="btn btn-accent btn-sm" id="sl-unlock">Unlock</button></label></div>
      </div>`;
      const last=i===slides.length-1;
      $("#sl-prev").disabled=i===0; $("#sl-next").disabled=last;
      if(last) $(".slide-card",host).insertAdjacentHTML("beforeend",`<p class="slide-end">End of deck · <button type="button" class="link-btn" id="sl-restart">Back to slide 1</button></p>`);
      $("#sl-restart")?.addEventListener("click",()=>{ i=0; draw(); });
      $("#sl-prev").onclick=()=>{ if(i>0){ i--; draw(); } };
      $("#sl-next").onclick=()=>{ if(i<slides.length-1){ i++; draw(); } };
      $("#sl-present").onclick=()=>{ present=!present; draw(); };
      $("#sl-gate").onclick=()=>{ $("#sl-gate-box").hidden=false; };
      $("#sl-unlock")?.addEventListener("click",()=>{ if(($("#sl-pass")?.value||"")==="makeda"){ $("#sl-gate-box").hidden=true; toast("Deck unlocked"); } else toast("Try makeda"); });
    };
    function toast(msg){ if(window.MCToast) return window.MCToast(msg); }
    draw();
  }

  function injectHabitTile(){
    // rendered inside games or ops via stage — skip if host missing; app will call renderHabit
  }

  /* Pomodoro keeps running when you switch panes; time is based on the clock, not on tick counts */
  const pomo={ total:25*60, endAt:0, left:25*60, running:false, iv:null };
  function fmt(sec){ sec=Math.max(0,Math.ceil(sec)); return String(Math.floor(sec/60)).padStart(2,"0")+":"+String(sec%60).padStart(2,"0"); }
  function pomoTick(){
    if(pomo.running){ pomo.left=(pomo.endAt-Date.now())/1000; if(pomo.left<=0){ pomo.left=0; pomo.running=false; clearInterval(pomo.iv); pomo.iv=null; window.MCToast&&window.MCToast("Focus session done — take a 5 minute break",5000); const n=+(localStorage.getItem("mc-habit")||0)+1; localStorage.setItem("mc-habit",String(n)); const hn=document.getElementById("habit-n"); if(hn) hn.textContent=String(n); } }
    const t=document.getElementById("pomo-t"); if(t) t.textContent = pomo.left<=0 && !pomo.running ? "Done" : fmt(pomo.left);
    const go=document.getElementById("pomo-go"), pa=document.getElementById("pomo-pause");
    if(go){ go.textContent = pomo.running ? "Running…" : (pomo.left<pomo.total && pomo.left>0 ? "Resume" : "Start 25m"); go.disabled=pomo.running; }
    if(pa) pa.disabled=!pomo.running;
    const bar=document.getElementById("pomo-bar"); if(bar) bar.value=Math.round((1-pomo.left/pomo.total)*100);
    if(pomo.running) document.title = fmt(pomo.left)+" · Focus · Mercatus Concierge"; else if(/· Focus ·/.test(document.title) && document.documentElement.getAttribute("data-stage")==="habit") document.title="Focus · Mercatus Concierge · Mens Mercatus";
  }
  function pomoStart(){ if(pomo.running) return; if(pomo.left<=0) pomo.left=pomo.total; pomo.endAt=Date.now()+pomo.left*1000; pomo.running=true; clearInterval(pomo.iv); pomo.iv=setInterval(pomoTick,250); pomoTick(); }
  function pomoPause(){ if(!pomo.running) return; pomo.left=(pomo.endAt-Date.now())/1000; pomo.running=false; clearInterval(pomo.iv); pomo.iv=null; pomoTick(); }
  function pomoReset(){ pomo.running=false; clearInterval(pomo.iv); pomo.iv=null; pomo.left=pomo.total; pomoTick(); }
  function renderHabit(host){
    let n = +(localStorage.getItem("mc-habit")||0);
    host.innerHTML=`<div class="role-kit-grid">
      <div class="role-section"><h3>Pomodoro timer</h3><p class="m-val pomo-time" id="pomo-t" aria-live="off">25:00</p>
        <progress id="pomo-bar" max="100" value="0" aria-label="Session progress"></progress>
        <div class="btn-row"><button type="button" class="btn btn-accent btn-sm" id="pomo-go">Start 25m</button>
        <button type="button" class="btn btn-ghost btn-sm" id="pomo-pause" disabled>Pause</button>
        <button type="button" class="btn btn-ghost btn-sm" id="pomo-stop">Reset</button></div>
        <p class="panel-copy small">Keeps running if you switch to another section. A finished session is logged automatically.</p></div>
      <div class="role-section"><h3>Habit tracker</h3><p class="m-val" id="habit-n">${n}</p><p class="panel-copy small">Focus sessions logged</p>
        <button type="button" class="btn btn-primary btn-sm" id="habit-plus">Log session</button></div>
    </div>`;
    $("#habit-plus").onclick=()=>{ n=+(localStorage.getItem("mc-habit")||0)+1; localStorage.setItem("mc-habit",String(n)); $("#habit-n").textContent=String(n); };
    $("#pomo-go").onclick=pomoStart; $("#pomo-pause").onclick=pomoPause; $("#pomo-stop").onclick=pomoReset;
    pomoTick();
  }

  return { ensure, renderIde, renderSlides, renderHabit };
})();
