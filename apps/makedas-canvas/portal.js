/* Mercatus Client Portal — Atelier Desk (local fixtures, no real auth) */
window.MCPortal = (function(){
  const LS = "mc-portal";
  const $ = (s,el=document)=>el.querySelector(s);
  const $$ = (s,el=document)=>[...el.querySelectorAll(s)];
  function esc(s){ return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); }
  function load(){ try{ return JSON.parse(localStorage.getItem(LS))||{}; }catch(_){ return {}; } }
  function save(d){ localStorage.setItem(LS, JSON.stringify(d)); }

  /* Dates are computed from today so the weekday is always right */
  function relDay(n, withYear){ const d=new Date(); d.setDate(d.getDate()+n); const o={weekday:"short",day:"numeric",month:"short"}; if(withYear) o.year="numeric"; return d.toLocaleDateString("en-GB",o).replace(",",""); }
  function defaults(){
    return {
      session: null, // {email, role: client|owner}
      otp: null,
      unread: 3,
      appt: { when: relDay(2) + " · 14:00 SAST", title: "Atelier review", status: "Confirmed" },
      invoice: { id: "INV-1042", amount: "R12,400", status: "Open", due: relDay(7, true) },
      orders: [
        {id:"ORD-88", title:"Brand kit refresh", status:"In progress"},
        {id:"ORD-91", title:"Blueprint event microsite", status:"Scheduled"},
        {id:"APT-12", title:"Atelier review", status:"Confirmed"}
      ],
      messages: [
        {from:"Atlas (Analyst)", text:"Sheet metrics look healthy.", ts:"Yesterday"},
        {from:"You", text:"Send invoice PDF when ready.", ts:"Today"},
        {from:"Hera (Recruiter)", text:"Two candidates moved to Interview.", ts:"Today"}
      ],
      brand: { primary:"#c8102e", cream:"#f3ead8", name:"Mens Mercatus" },
      phone: false,
      screen: "login"
    };
  }

  function state(){ const saved=load(); /* drop fixed demo dates saved by older versions (wrong weekday) */
    if(saved.appt && /^Thu 10 Oct/.test(saved.appt.when||"")) delete saved.appt;
    if(saved.invoice && saved.invoice.due==="15 Oct 2026" && saved.invoice.id==="INV-1042") saved.invoice.due=relDay(7,true);
    return Object.assign(defaults(), saved); }

  function mount(host){
    if(!host) return;
    const st = state();
    host.innerHTML = st.phone && window.MCDevice
      ? `<div id="portal-device-host"></div>`
      : `<div class="portal-shell ${st.phone?"is-phone":""}" id="portal-root"></div>`;
    render();
  }

  function render(){
    const root = $("#portal-root"); if(!root) return;
    const st = state();
    if(root) root.classList.toggle("is-phone", !!st.phone);
    if(st.phone && window.MCDevice && $("#portal-device-host") && !$("#portal-root")){
      /* deferred: content rendered into temporary then wrapped */
    }
    if(!st.session){ root.innerHTML = loginView(st); bindLogin(); return; }
    root.innerHTML = chrome(st) + screen(st);
    bindChrome();
  }

  function loginView(st){
    return `<div class="portal-login mc-glass-panel">
      <div class="portal-brand"><img src="../../assets/marks/mark-wheat-16.svg" width="20" height="20" alt=""><strong>${esc(st.brand.name)} · Client Portal</strong></div>
      <p class="panel-copy">Atelier Desk · mock OTP · no real auth</p>
      <label class="field"><span>Email</span><input id="p-email" type="email" placeholder="client@company.com" value="client@atelier.demo"></label>
      <div id="p-otp-wrap" hidden>
        <label class="field"><span>OTP (mock)</span><input id="p-otp" inputmode="numeric" placeholder="123456" maxlength="6"></label>
        <p class="panel-copy small">Demo code: <code>123456</code></p>
      </div>
      <div class="btn-row">
        <button type="button" class="btn btn-primary" id="p-send-otp">Send OTP</button>
        <button type="button" class="btn btn-accent" id="p-verify" hidden>Enter portal</button>
      </div>
      <div class="btn-row" style="margin-top:12px">
        <button type="button" class="btn btn-ghost btn-sm" data-demo="client">Demo as client</button>
        <button type="button" class="btn btn-ghost btn-sm" data-demo="owner">Demo as owner</button>
      </div>
    </div>`;
  }

  function chrome(st){
    return `<div class="portal-top">
      <div class="portal-brand"><img src="../../assets/marks/mark-wheat-16.svg" width="16" height="16" alt=""><span>${esc(st.brand.name)}</span>
        <span class="pane-badge">${st.session.role==="owner"?"Owner":"Client"}</span></div>
      <div class="portal-nav">
        <button type="button" class="btn btn-ghost btn-sm" data-ps="home">Home</button>
        <button type="button" class="btn btn-ghost btn-sm" data-ps="orders">Orders</button>
        <button type="button" class="btn btn-ghost btn-sm" data-ps="invoice">Invoice</button>
        <button type="button" class="btn btn-ghost btn-sm" data-ps="messages">Messages${st.unread?` <span class="unread">${st.unread}</span>`:""}</button>
      </div>
      <div class="btn-row">
        <button type="button" class="btn btn-ghost btn-sm" id="p-phone">${st.phone?"Desktop":"Device Lab"}</button>
        <button type="button" class="btn btn-ghost btn-sm" id="p-swap-brand">Swap brand</button>
        <button type="button" class="btn btn-ghost btn-sm" id="p-toggle-role">As ${st.session.role==="owner"?"client":"owner"}</button>
        <button type="button" class="btn btn-ghost btn-sm" id="p-logout">Log out</button>
      </div>
    </div>`;
  }

  function screen(st){
    const s = st.screen||"home";
    if(s==="orders") return ordersView(st);
    if(s==="invoice") return invoiceView(st);
    if(s==="messages") return messagesView(st);
    return homeView(st);
  }

  function homeView(st){
    return `<div class="portal-body"><div class="role-kit-grid">
      <div class="role-section"><h3>Next appointment</h3><strong>${esc(st.appt.title)}</strong><p>${esc(st.appt.when)}</p><span class="status-chip">${esc(st.appt.status)}</span></div>
      <div class="role-section"><h3>Open invoice</h3><strong>${esc(st.invoice.id)}</strong><p>${esc(st.invoice.amount)} · due ${esc(st.invoice.due)}</p>
        <button type="button" class="btn btn-primary btn-sm" data-ps="invoice">View invoice</button></div>
      <div class="role-section"><h3>Inbox</h3><p class="m-val">${st.unread}</p><p class="panel-copy small">Unread messages</p>
        <button type="button" class="btn btn-ghost btn-sm" data-ps="messages">Open thread</button></div>
    </div></div>`;
  }

  function ordersView(st){
    // try pull from ops sheet if present
    let rows = st.orders.slice();
    try{
      const sheet = JSON.parse(localStorage.getItem("mc-sheet")||"null");
      if(sheet && sheet.rows){
        sheet.rows.slice(0,3).forEach((r,i)=>{
          rows.push({id:"SHEET-"+i, title: String(r[0]||"Sheet row"), status: String(r[2]||"Open")});
        });
      }
    }catch(_){}
    return `<div class="portal-body"><div class="role-section"><h3>Orders & appointments</h3>
      ${rows.map(o=>`<div class="queue-item"><span><strong>${esc(o.id)}</strong> · ${esc(o.title)}</span><span class="status-chip">${esc(o.status)}</span></div>`).join("")}
    </div></div>`;
  }

  function invoiceView(st){
    return `<div class="portal-body">
      <div class="invoice-hero" style="--inv-accent:${esc(st.brand.primary)}">
        <div class="inv-mark">Mercatus Concierge · Paint brand stub</div>
        <h2>${esc(st.invoice.id)}</h2>
        <p>${esc(st.invoice.amount)} · ${esc(st.invoice.status)} · due ${esc(st.invoice.due)}</p>
      </div>
      <div class="pdf-preview role-section">
        <div class="pdf-line"></div><div class="pdf-line short"></div><div class="pdf-line"></div>
        <div class="pdf-line mid"></div><p class="panel-copy small">PDF-ish preview (local stub)</p>
      </div>
      <div class="btn-row">
        <button type="button" class="btn btn-primary" id="p-pay">Pay stub</button>
        <button type="button" class="btn btn-ghost" id="p-annotate">Annotate overlay</button>
        <button type="button" class="btn btn-ghost" id="p-invite">Invite colleague</button>
      </div>
      <div id="p-ann-layer" class="portal-ann" hidden></div>
      <p class="panel-copy small" id="p-pay-msg" hidden>Payment recorded (fake success · no Stripe).</p>
    </div>`;
  }

  function messagesView(st){
    let roster = [];
    try{
      const roles = JSON.parse(localStorage.getItem("mc-roles")||"{}");
      roster = (roles.people&&roles.people.dir)||[];
    }catch(_){}
    if(!roster.length) roster = [{name:"Atlas",role:"Analyst"},{name:"Hera",role:"Recruiter"}];
    return `<div class="portal-body portal-msg-grid">
      <div class="role-section"><h3>Team</h3>${roster.map(p=>`<div class="role-card"><strong>${esc(p.name)}</strong><div>${esc(p.role||"")}${p.dept?" · "+esc(p.dept):""}</div></div>`).join("")}</div>
      <div class="role-section"><h3>Thread</h3>
        <div class="chat-log" style="max-height:240px">${st.messages.map(m=>`<div class="msg ${m.from==="You"?"msg-user":"msg-bot"}"><div class="msg-role">${esc(m.from)}</div><p>${esc(m.text)}</p><div class="panel-copy small">${esc(m.ts)}</div></div>`).join("")}</div>
        <form id="p-msg-form" class="chat-compose" style="margin-top:8px"><input id="p-msg" type="text" placeholder="Message…" autocomplete="off"><button class="btn btn-primary btn-send" type="submit">Send</button></form>
      </div>
    </div>`;
  }

  function bindLogin(){
    $("#p-send-otp")?.addEventListener("click",()=>{
      const st=state(); st.otp="123456"; save(st);
      $("#p-otp-wrap").hidden=false; $("#p-verify").hidden=false; toast("OTP sent (mock)");
    });
    $("#p-verify")?.addEventListener("click",()=>{
      const code=$("#p-otp")?.value||""; if(code!=="123456"){ toast("Use demo OTP 123456"); return; }
      const st=state(); st.session={email:$("#p-email")?.value||"client@atelier.demo", role:"client"}; st.screen="home"; save(st); render();
    });
    $$("[data-demo]").forEach(b=>b.addEventListener("click",()=>{
      const st=state(); st.session={email:"demo@"+b.dataset.demo+".mm", role:b.dataset.demo}; st.screen="home"; save(st); render();
    }));
  }

  function bindChrome(){
    $$("[data-ps]").forEach(b=>b.addEventListener("click",()=>{ const st=state(); st.screen=b.dataset.ps; if(b.dataset.ps==="messages") st.unread=0; save(st); render(); }));
    $("#p-logout")?.addEventListener("click",()=>{ const st=state(); st.session=null; st.screen="login"; save(st); render(); });
    $("#p-phone")?.addEventListener("click",()=>{ const st=state(); st.phone=!st.phone; save(st); render();
      if(st.phone && window.MCDevice){
        const hostEl=$("#portal-host")||document.getElementById("portal-host");
        const shell=$("#portal-root");
        if(hostEl && shell){
          const html=shell.outerHTML;
          window.MCDevice.mountInto(hostEl, html, ()=>render());
        }
      }
    });
    $("#p-toggle-role")?.addEventListener("click",()=>{ const st=state(); if(!st.session)return; st.session.role=st.session.role==="owner"?"client":"owner"; save(st); render(); });
    $("#p-swap-brand")?.addEventListener("click",()=>{
      const st=state();
      if(st.brand.primary==="#c8102e"){ st.brand={primary:"#ffd600",cream:"#0a0a0a",name:"Night Shift Desk"}; }
      else { st.brand={primary:"#c8102e",cream:"#f3ead8",name:"Mens Mercatus"}; }
      save(st); render(); toast("Brand swapped");
    });
    $("#p-pay")?.addEventListener("click",()=>{ const st=state(); st.invoice.status="Paid"; save(st); const m=$("#p-pay-msg"); if(m)m.hidden=false; toast("Fake payment success"); });
    $("#p-annotate")?.addEventListener("click",()=>{ const layer=$("#p-ann-layer"); if(!layer)return; layer.hidden=false; layer.innerHTML=`<div class="ann-box">Annotation: confirm line items before pay</div>`; });
    $("#p-invite")?.addEventListener("click",()=>{
      const email=prompt("Colleague email"); if(!email)return;
      try{ const roles=JSON.parse(localStorage.getItem("mc-roles")||"{}"); if(!roles.founders)roles.founders={waitlist:[],funding:[],okrs:[]}; roles.founders.waitlist=roles.founders.waitlist||[]; roles.founders.waitlist.push(email); localStorage.setItem("mc-roles",JSON.stringify(roles)); }catch(_){ }
      toast("Invite stubbed to waitlist");
    });
    $("#p-msg-form")?.addEventListener("submit",e=>{
      e.preventDefault(); const v=$("#p-msg")?.value?.trim(); if(!v)return;
      const st=state(); st.messages.push({from:"You",text:v,ts:"Now"}); save(st); render();
    });
  }

  function toast(msg){ const t=document.getElementById("toast"); if(!t)return; t.textContent=msg; t.hidden=false; clearTimeout(toast._t); toast._t=setTimeout(()=>t.hidden=true,2400); }

  return { mount, render, state };
})();
