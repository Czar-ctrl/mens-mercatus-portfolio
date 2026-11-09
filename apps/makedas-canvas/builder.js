/* Mercatus Concierge — local page builder (rule-based templates, not AI).
   Parses a plain-English request into a landing-page spec and renders it into the Studio artboard. */
window.MCBuilder = (function(){
  "use strict";
  const LS = "mc-site";
  const esc = s => String(s==null?"":s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const cap = s => s ? s.charAt(0).toUpperCase()+s.slice(1) : s;
  const title = s => String(s||"").replace(/\b\w/g,c=>c.toUpperCase());

  const INDUSTRIES = [
    {id:"coffee", re:/coffee|roast|caf[eé]|espresso|barista|bean/, noun:"coffee roastery", featTitle:"On the menu",
      items:[["Single-origin beans","Small batches from Ethiopia, Colombia and Kenya, roasted weekly."],["Espresso bar","Flat whites, cortados and pour-overs pulled by trained baristas."],["Subscriptions","Fresh bags delivered every two or four weeks."]],
      about:"We roast in small batches so every bag reaches you within days of roasting.", cta:"Order fresh beans", palette:"warm"},
    {id:"restaurant", re:/restaurant|bistro|kitchen|food|eatery|diner|bakery|pizza|grill/, noun:"restaurant", featTitle:"Menu highlights",
      items:[["Seasonal starters","Built around what local farms are harvesting this week."],["Signature mains","Slow-cooked, fire-grilled and plated with care."],["Desserts","House-made every morning."]],
      about:"A neighbourhood kitchen cooking honest food with local produce.", cta:"Book a table", palette:"warm"},
    {id:"fitness", re:/gym|fitness|yoga|pilates|trainer|workout|crossfit/, noun:"fitness studio", featTitle:"Programs",
      items:[["Strength","Coached small-group lifting sessions."],["Conditioning","High-energy classes that build stamina."],["Personal training","One-on-one plans built around your goals."]],
      about:"Coaches who track your progress and keep you consistent.", cta:"Book a free class", palette:"bold"},
    {id:"beauty", re:/salon|beauty|spa|nail|hair|barber|skincare|lash/, noun:"salon", featTitle:"Services",
      items:[["Cut & style","Precision cuts tailored to you."],["Colour","Balayage, highlights and full colour."],["Treatments","Restorative care for hair and skin."]],
      about:"A calm studio where every appointment is unhurried.", cta:"Book an appointment", palette:"soft"},
    {id:"law", re:/law|legal|attorney|lawyer|advocate|notary/, noun:"law firm", featTitle:"Practice areas",
      items:[["Business law","Contracts, company setup and compliance."],["Property","Transfers, leases and disputes."],["Family","Clear advice through difficult moments."]],
      about:"Plain-language legal advice with fixed, upfront fees.", cta:"Book a consultation", palette:"classic"},
    {id:"property", re:/real estate|property|realtor|estate agent|homes|rental|letting/, noun:"property agency", featTitle:"What we do",
      items:[["Buy","Curated listings matched to your brief."],["Sell","Valuation, staging and marketing that sells."],["Rent","Vetted tenants and managed leases."]],
      about:"Local agents who know every street in the area.", cta:"Get a valuation", palette:"classic"},
    {id:"saas", re:/saas|software|app\b|platform|startup|dashboard|api|tool/, noun:"software product", featTitle:"Features",
      items:[["Fast setup","Up and running in minutes, no engineers needed."],["Live insights","Dashboards that update in real time."],["Integrations","Connects to the tools you already use."]],
      about:"Built by a small team obsessed with saving you time.", cta:"Start free trial", palette:"cool"},
    {id:"photo", re:/photo|studio|wedding|film|video/, noun:"photography studio", featTitle:"Work",
      items:[["Weddings","Documentary-style coverage of your day."],["Portraits","Natural light sessions in studio or on location."],["Brands","Product and team imagery for the web."]],
      about:"Honest, timeless photographs you will keep for decades.", cta:"Check availability", palette:"mono"},
    {id:"agency", re:/agency|consult|marketing|design studio|branding|freelanc/, noun:"agency", featTitle:"Services",
      items:[["Strategy","Positioning and messaging workshops."],["Design","Brand identity and websites."],["Growth","Campaigns measured against revenue."]],
      about:"A senior team that ships fast and reports honestly.", cta:"Book a discovery call", palette:"bold"}
  ];
  const GENERIC = {id:"generic", noun:"business", featTitle:"What we offer",
    items:[["Quality first","Every order is checked before it leaves us."],["Local team","Real people you can call."],["Fair pricing","Clear prices, no surprises."]],
    about:"A small, focused team serving customers who care about quality.", cta:"Get in touch", palette:"classic"};

  const PALETTES = {
    warm:   {bg:"#f6efe6", surface:"#fffaf3", text:"#2b1d14", muted:"#7a5c48", accent:"#8b4a2b", accentText:"#fff"},
    brown:  {bg:"#efe4d6", surface:"#f9f2e9", text:"#2a1a10", muted:"#6f4e37", accent:"#6f4e37", accentText:"#fff"},
    dark:   {bg:"#141110", surface:"#1e1916", text:"#f3ead8", muted:"#b8a894", accent:"#c9a227", accentText:"#141110"},
    darkbrown:{bg:"#1b120c", surface:"#26190f", text:"#f3e6d3", muted:"#c2a283", accent:"#c7834a", accentText:"#1b120c"},
    gold:   {bg:"#0f0d0a", surface:"#1a1611", text:"#f6edd6", muted:"#bfae86", accent:"#c9a227", accentText:"#0f0d0a"},
    cool:   {bg:"#f3f6fb", surface:"#ffffff", text:"#0f1b2d", muted:"#506079", accent:"#2457d6", accentText:"#fff"},
    green:  {bg:"#f1f6f1", surface:"#ffffff", text:"#132a1a", muted:"#4f6b57", accent:"#2f7a45", accentText:"#fff"},
    bold:   {bg:"#0d0d0d", surface:"#181818", text:"#ffffff", muted:"#b5b5b5", accent:"#e63946", accentText:"#fff"},
    soft:   {bg:"#fbf3f3", surface:"#ffffff", text:"#3a2328", muted:"#8a6a70", accent:"#c06c84", accentText:"#fff"},
    classic:{bg:"#f7f5f0", surface:"#ffffff", text:"#1d1d1f", muted:"#5f5f66", accent:"#1f3a5f", accentText:"#fff"},
    mono:   {bg:"#ffffff", surface:"#f4f4f4", text:"#111111", muted:"#666666", accent:"#111111", accentText:"#fff"},
    red:    {bg:"#fff6f5", surface:"#ffffff", text:"#2a0f0f", muted:"#7a4a4a", accent:"#c8102e", accentText:"#fff"}
  };
  const SECTION_LABEL = {hero:"Hero",features:"Features",about:"About",pricing:"Pricing",testimonials:"Testimonials",faq:"FAQ",gallery:"Gallery",team:"Team",contact:"Contact",cta:"Call to action",footer:"Footer"};
  const SECTION_RE = {pricing:/pricing|prices|plans?\b|packages/, testimonials:/testimonial|reviews?|social proof/, faq:/faq|questions/, gallery:/gallery|photos|portfolio/, team:/team|staff|people/, contact:/contact|map|address|location/, about:/about|story/, features:/features|menu|services|products/};

  const BUYER_NOUNS="owners?|managers?|teams?|people|parents|students|businesses|smes?|founders?|freelancers?|clinics?|shops?|customers?|clients?|users?|sellers?|buyers?|agents?|drivers?|landlords?|tenants?|retailers?|restaurants?|cafes?|coaches|creators?|developers?|designers?|marketers?|accountants?|lawyers?|doctors?|nurses?|teachers?|schools?|companies|startups?|agencies|recruiters?|hr|cfos?|ceos?|households?|families|homeowners?|investors?|traders?|farmers?";
  function load(){ try{ return JSON.parse(localStorage.getItem(LS)); }catch(_){ return null; } }
  function save(s){ try{ localStorage.setItem(LS, JSON.stringify(s)); }catch(_){} }

  function pickPalette(t, fallback){
    const dark=/\b(dark|darker|night|moody|black)\b/.test(t), brown=/\b(brown|coffee|mocha|chocolate|earthy)\b/.test(t), warm=/\b(warm|cosy|cozy|terracotta|rustic)\b/.test(t), gold=/\bgold(en)?\b/.test(t);
    if(dark && (brown||warm)) return "darkbrown";
    if(gold) return "gold"; if(dark) return "dark"; if(brown) return "brown"; if(warm) return "warm";
    if(/\b(blue|cool|corporate|tech)\b/.test(t)) return "cool"; if(/\b(green|eco|natural|organic)\b/.test(t)) return "green";
    if(/\b(pink|pastel|soft|blush)\b/.test(t)) return "soft"; if(/\b(red)\b/.test(t)) return "red";
    if(/\b(minimal|monochrome|black and white|mono)\b/.test(t)) return "mono"; if(/\b(bold|loud|punchy)\b/.test(t)) return "bold";
    return fallback;
  }
  function quoted(text){ return [...String(text).matchAll(/["“”'‘’]([^"“”‘’]{2,80})["“”'‘’]/g)].map(m=>m[1].trim()); }
  function analyze(text){
    const t=String(text||"").toLowerCase();
    const ind=INDUSTRIES.find(i=>i.re.test(t))||GENERIC;
    let name=null; const nm=String(text).match(/\b(?:called|named)\s+["“']?([A-Z][\w&'’ -]{1,40}?)["”']?(?=[,.;]|\s+(?:with|and|that|for|in)\b|$)/);
    if(nm) name=nm[1].trim();
    const forM=t.match(/\bfor\s+(?:an?\s+|the\s+|my\s+|our\s+)?([a-z][a-z &'-]{2,40}?)(?=[,.;]|\s+(?:with|and|that|called|named|headline|in)\b|$)/);
    const audience = forM ? forM[1].trim() : null;
    const q=quoted(text);
    const hm=String(text).match(/headline\s*(?:to|:|of|=)?\s*["“']([^"”']+)["”']/i);
    const sm=String(text).match(/sub(?:line|title|heading)\s*(?:to|:|of|=)?\s*["“']([^"”']+)["”']/i);
    const cm=String(text).match(/(?:cta|button)\s*(?:to|:|of|=)?\s*["“']([^"”']+)["”']/i);
    const extras=Object.keys(SECTION_RE).filter(k=>SECTION_RE[k].test(t) && !["features","about"].includes(k));
    return { t, ind, name, audience, headline: hm?hm[1]:(q[0]&&!sm&&!cm?q[0]:null), subline: sm?sm[1]:null, cta: cm?cm[1]:null, palette: pickPalette(t, null), extras };
  }
  function freshSpec(a){
    const ind=a.ind;
    const name = a.name || (a.audience && ind===GENERIC ? title(a.audience) : title(ind.noun));
    const secs=["hero","features","about"].concat(a.extras.filter(x=>x!=="contact")).concat(["cta","footer"]);
    if(a.extras.includes("contact")) secs.splice(secs.length-1,0,"contact");
    return {
      name, industry:ind.id, noun:ind.noun,
      headline: a.headline || (ind===GENERIC ? name : ("Welcome to "+name)),
      subline: a.subline || `${cap(ind.noun)} — ${ind.about.split(".")[0].toLowerCase()}.`,
      cta: a.cta || ind.cta, featTitle: ind.featTitle, items: ind.items.map(x=>x.slice()), about: ind.about,
      palette: a.palette || ind.palette, sections: [...new Set(secs)], version: 1
    };
  }
  function addSection(spec, key){ if(spec.sections.includes(key)) return false; const at=spec.sections.indexOf("cta"); spec.sections.splice(at<0?spec.sections.length:at,0,key); return true; }

  const NEW_PAGE = /\b(build|create|make|generate|design)\b.{0,40}\b(landing|page|site|website|homepage)\b|\blanding page\b/;
  /* Returns {spec, notes[]} — applies a request to the current spec (or starts a new one) */
  function apply(text){
    const a=analyze(text); const t=a.t; let spec=load(); const notes=[];
    const isNew = !spec || (NEW_PAGE.test(t) && !/\b(add|remove|change|update)\b/.test(t.slice(0,12)));
    if(isNew){
      spec=freshSpec(a);
      notes.push(`New ${spec.noun} landing page: ${spec.sections.map(s=>SECTION_LABEL[s]).join(" → ")}.`);
      notes.push(`Headline “${spec.headline}”.`);
      notes.push(`Palette: ${spec.palette}${a.palette?" (from your colour words)":" (default for this kind of business)"}.`);
      if(a.ind===GENERIC) notes.push("I couldn't tell the kind of business, so I used a general template. Mention it (e.g. coffee, salon, law firm, software) for better copy.");
    } else {
      spec.version=(spec.version||1)+1;
      if(a.headline && /headline|title/.test(t)){ spec.headline=a.headline; notes.push(`Headline → “${a.headline}”.`); }
      else if(a.headline && !a.subline && !a.cta && !/\badd|remove\b/.test(t)){ spec.headline=a.headline; notes.push(`Headline → “${a.headline}”.`); }
      if(a.subline){ spec.subline=a.subline; notes.push(`Subline → “${a.subline}”.`); }
      if(a.cta){ spec.cta=a.cta; notes.push(`Button → “${a.cta}”.`); }
      if(a.name && /\b(rename|call it|called|named)\b/.test(t)){ spec.name=a.name; notes.push(`Name → ${a.name}.`); }
      const rm=t.match(/\b(remove|delete|drop|hide)\b\s+(?:the\s+)?(\w+)/);
      if(rm){ const key=Object.keys(SECTION_RE).find(k=>SECTION_RE[k].test(rm[2]))||(rm[2] in SECTION_LABEL?rm[2]:null); if(key && !["hero","footer"].includes(key)){ if(spec.sections.includes(key)){ spec.sections=spec.sections.filter(s=>s!==key); notes.push(`Removed ${SECTION_LABEL[key]}.`); } else notes.push(`There's no ${SECTION_LABEL[key]} section to remove.`); } }
      if(/\b(add|include|with|plus|show)\b/.test(t)){ Object.keys(SECTION_RE).forEach(k=>{ if(SECTION_RE[k].test(t) && !(rm && SECTION_RE[k].test(rm[2]))){ if(addSection(spec,k)) notes.push(`Added ${SECTION_LABEL[k]} section.`); else notes.push(`${SECTION_LABEL[k]} is already on the page.`); } }); }
      if(/\b(darker|dark mode|make it dark)\b/.test(t)){ spec.palette = /brown|warm|coffee/.test(spec.palette+t) || ["warm","brown"].includes(spec.palette) ? "darkbrown" : (spec.palette==="gold"?"gold":"dark"); notes.push(`Darker palette (${spec.palette}).`); }
      else if(/\b(lighter|light mode|brighter|make it light)\b/.test(t)){ spec.palette = ["darkbrown","brown"].includes(spec.palette)?"warm":(["dark","gold","bold"].includes(spec.palette)?"classic":spec.palette); notes.push(`Lighter palette (${spec.palette}).`); }
      else if(a.palette && a.palette!==spec.palette){ spec.palette=a.palette; notes.push(`Palette → ${a.palette}.`); }
      if(!notes.length) notes.push("I didn't find a change I know how to make. Try: “add a pricing section”, “make it darker”, “headline 'Fresh Roast Daily'”, “remove the FAQ”, or “button 'Order now'”.");
    }
    save(spec); render(spec);
    return {spec, notes, isNew};
  }

  function sectionHtml(s, spec){
    const p=spec;
    switch(s){
      case "hero": return `<header class="sb-hero selectable" data-label="Hero"><p class="sb-kicker editable-text">${esc(p.name)}</p><h2 class="sb-h1 editable-text" id="artboard-headline">${esc(p.headline)}</h2><p class="sb-sub editable-text" id="artboard-subline">${esc(p.subline)}</p><p class="sb-note editable-text" id="artboard-note" hidden></p><div class="sb-cta-row"><span class="sb-btn selectable" data-label="CTA">${esc(p.cta)}</span><span class="sb-btn sb-btn--ghost">Learn more</span></div></header>`;
      case "features": return `<section class="sb-sec selectable" data-label="${esc(p.featTitle)}"><h3 class="editable-text">${esc(p.featTitle)}</h3><div class="sb-grid">${p.items.map(([h,b])=>`<div class="sb-card"><strong class="editable-text">${esc(h)}</strong><p class="editable-text">${esc(b)}</p></div>`).join("")}</div></section>`;
      case "about": return `<section class="sb-sec selectable" data-label="About"><h3 class="editable-text">About ${esc(p.name)}</h3><p class="editable-text">${esc(p.about)}</p></section>`;
      case "pricing": return `<section class="sb-sec selectable" data-label="Pricing"><h3 class="editable-text">Pricing</h3><div class="sb-grid">${[["Starter","R149","For trying us out"],["Regular","R299","Most popular"],["Pro","R549","For teams and regulars"]].map(([n,v,d],i)=>`<div class="sb-card${i===1?" is-featured":""}"><strong class="editable-text">${n}</strong><p class="sb-price editable-text">${v}<small>/month</small></p><p class="editable-text">${d}</p></div>`).join("")}</div></section>`;
      case "testimonials": return `<section class="sb-sec selectable" data-label="Testimonials"><h3 class="editable-text">What customers say</h3><div class="sb-grid">${[["“Best I've had in Joburg.”","Thandi M."],["“Fast, friendly, consistent.”","Pieter V."],["“I tell everyone about them.”","Ayesha K."]].map(([q,w])=>`<blockquote class="sb-card"><p class="editable-text">${q}</p><cite class="editable-text">${w}</cite></blockquote>`).join("")}</div></section>`;
      case "faq": return `<section class="sb-sec selectable" data-label="FAQ"><h3 class="editable-text">FAQ</h3>${[["Do you deliver?","Yes — nationwide, usually within 3 working days."],["Can I change my order?","Any time before it ships."],["How do I pay?","Card, EFT or SnapScan."]].map(([q,a])=>`<details class="sb-faq"><summary class="editable-text">${q}</summary><p class="editable-text">${a}</p></details>`).join("")}</section>`;
      case "gallery": return `<section class="sb-sec selectable" data-label="Gallery"><h3 class="editable-text">Gallery</h3><div class="sb-gallery">${[1,2,3,4].map(i=>`<div class="sb-ph" aria-hidden="true">Image ${i}</div>`).join("")}</div></section>`;
      case "team": return `<section class="sb-sec selectable" data-label="Team"><h3 class="editable-text">Meet the team</h3><div class="sb-grid">${[["Lerato","Founder"],["Sipho","Operations"],["Naledi","Customer care"]].map(([n,r])=>`<div class="sb-card"><strong class="editable-text">${n}</strong><p class="editable-text">${r}</p></div>`).join("")}</div></section>`;
      case "contact": return `<section class="sb-sec selectable" data-label="Contact"><h3 class="editable-text">Visit or contact us</h3><p class="editable-text">12 Example Street, Johannesburg · hello@example.co.za · 010 000 0000</p></section>`;
      case "cta": return `<section class="sb-sec sb-cta selectable" data-label="Call to action"><h3 class="editable-text">Ready when you are</h3><span class="sb-btn">${esc(p.cta)}</span></section>`;
      case "footer": return `<footer class="sb-foot selectable" data-label="Footer"><span class="editable-text">© ${new Date().getFullYear()} ${esc(p.name)}</span><span>Privacy · Terms · Contact</span></footer>`;
    }
    return "";
  }
  function render(spec){
    spec = spec || load(); const board=document.getElementById("artboard"); if(!board || !spec) return false;
    let host=document.getElementById("site-render");
    if(!host){ [...board.children].forEach(ch=>{ if(ch.classList.contains("art-hero")||ch.classList.contains("art-cards")) ch.remove(); }); host=document.createElement("div"); host.id="site-render"; host.className="site-render"; board.insertBefore(host, board.firstChild); }
    const pal=PALETTES[spec.palette]||PALETTES.classic;
    Object.entries({bg:pal.bg,surface:pal.surface,text:pal.text,muted:pal.muted,accent:pal.accent,"accent-text":pal.accentText}).forEach(([k,v])=>host.style.setProperty("--sb-"+k,v));
    host.innerHTML=spec.sections.map(s=>sectionHtml(s,spec)).join("");
    const ah=document.getElementById("art-headline"), as=document.getElementById("art-subline");
    if(ah) ah.value=spec.headline; if(as) as.value=spec.subline;
    const editable = document.getElementById("artboard")?.classList.contains("is-edit");
    host.querySelectorAll(".editable-text").forEach(el=>el.contentEditable=editable?"true":"false");
    return true;
  }
  function setField(field, val){ const s=load(); if(!s) return; if(field==="headline") s.headline=val; if(field==="subline") s.subline=val; save(s); }

  /* Plan mode: structured plan from the brief + request */
  function plan(text, brief){
    const src=(brief?brief+". ":"")+(text||"");
    const a=analyze(src); const spec=freshSpec(a);
    const aud=a.audience && a.ind!==GENERIC ? a.audience : (a.audience||"your first 10 paying customers (name who they are)");
    return `<p><strong>Plan: ${esc(spec.name)}</strong> <span class="msg-tag">local template, not AI</span></p>
      <p><strong>Goal:</strong> a landing page that gets ${esc(aud)} to “${esc(spec.cta)}”.</p>
      <p><strong>Page outline</strong></p><ol>${spec.sections.map(s=>`<li>${SECTION_LABEL[s]}${s==="hero"?` — “${esc(spec.headline)}”`:s==="features"?` — ${spec.items.map(i=>esc(i[0])).join(", ")}`:""}</li>`).join("")}</ol>
      <p><strong>Look:</strong> ${esc(spec.palette)} palette${a.palette?" (from your words)":" (suggested for a "+esc(spec.noun)+")"}.</p>
      <p><strong>Next steps</strong></p><ol><li>Switch to <strong>Build</strong> and send the same request to generate this page in the preview.</li><li>Refine with follow-ups like “add a pricing section” or “make it darker”.</li><li>Swap the sample copy for real prices, photos and contact details in Studio → Edit text.</li></ol>
      ${a.ind===GENERIC?`<p class="small">Tip: say what kind of business it is (coffee, salon, law firm, software…) for a closer template.</p>`:""}`;
  }

  /* First Look: rewrite a rough brief into one clear positioning line */
  function sharpen(raw){
    let t=String(raw||"").trim().replace(/\s+/g," ").replace(/[.!]+$/,"");
    if(!t) return {line:"", missing:["Write a rough idea first."]};
    let body=t.replace(/^(i|we)\s*('m| am|'re| are)?\s*(want|would like|hope|plan|trying|going)?\s*(to)?\s*(build|make|create|start|launch|do)?\s*/i,"")
              .replace(/^(an?|the)\s+/i,"").replace(/^(app|platform|website|tool|service|business)\s+(that|which|to)\s+/i,"$1 that ");
    const a=analyze(t);
    const audH=t.match(new RegExp("\\bhelps?\\s+((?:[a-z-]+\\s){0,3}(?:"+BUYER_NOUNS+"))\\b","i"));
    const audM=audH ? [null,audH[1]] : t.match(/\bfor\s+((?:small |local |busy |new |young )?[a-z][a-z &'-]{2,40}?)(?=[,.;]|\s+(?:who|that|to|so|with|in|by)\b|$)/i);
    const benM=t.match(/\b(?:so (?:that )?|to help (?:them )?|helping (?:them )?|so they can |which lets them )([^,.;]{4,80})/i);
    const what = body.replace(/\bfor\s+[^,.;]*$/i,"").replace(/\b(so that|so|to help|helping)\b.*$/i,"").trim() || body;
    const who = audM ? audM[1].trim() : null;
    const outcome = benM ? benM[1].trim() : null;
    let line = `${cap(what.replace(/\s+$/,""))}${who&&!audH?` for ${who}`:""}${outcome?`, so they can ${outcome.replace(/^(they\s+)?(can\s+)?/i,"")}`:""}.`;
    line=line.replace(/\s+,/g,",").replace(/\.\.+$/,".");
    if(line.length>160) line=line.slice(0,157)+"…";
    const missing=[]; if(!who) missing.push("Who exactly is it for? Add “for <specific buyer>”.");
    if(!outcome) missing.push("What result do they get? Add “so they can <outcome>”.");
    if(!/\d/.test(t)) missing.push("Add one number: a price, a time saved, or how many people you spoke to.");
    return {line, missing, who, outcome, industry:a.ind.noun};
  }

  return { BUYER_NOUNS, apply, analyze, render, load, save, setField, plan, sharpen, PALETTES };
})();
