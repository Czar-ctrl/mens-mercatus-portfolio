(function(){
'use strict';
var $=function(s,r){return (r||document).querySelector(s)},$$=function(s,r){return Array.prototype.slice.call((r||document).querySelectorAll(s))};
var pages=$$('article.page'),N=pages.length,cur=0;
var tocLinks={};$$('.toc-list a').forEach(function(a){tocLinks[a.dataset.id]=a});
var prog=$('#prog'),pager=$('#pager');
// progress
function onScroll(){var h=document.documentElement,max=h.scrollHeight-h.clientHeight;prog.style.width=(max>0?(h.scrollTop/max*100):0)+'%'}
addEventListener('scroll',onScroll,{passive:true});onScroll();
// active page
function setCur(i){if(i<0||i>=N)return;cur=i;var id=pages[i].id;pager.textContent=String(i+1).padStart(2,'0')+' / '+N;
 $$('.toc-list a.on').forEach(function(a){a.classList.remove('on');a.removeAttribute('aria-current')});
 var a=tocLinks[id];if(a){a.classList.add('on');a.setAttribute('aria-current','location');var t=$('#toc');if(t&&!t.matches(':hover')){var r=a.getBoundingClientRect(),tr=t.getBoundingClientRect();if(r.top<tr.top+60||r.bottom>tr.bottom-20)a.scrollIntoView({block:'center'})}}}
if('IntersectionObserver' in window){var io=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting)setCur(+e.target.dataset.seq-1)})},{rootMargin:'-35% 0px -60% 0px'});pages.forEach(function(p){io.observe(p)})}
function go(i){i=Math.max(0,Math.min(N-1,i));location.hash=pages[i].id;closeToc()}
$('#prev').onclick=function(){go(cur-1)};$('#next').onclick=function(){go(cur+1)};$('#top').onclick=function(){scrollTo(0,0)};
// mobile toc
var toc=$('#toc'),tb=$('.toc-btn');
function closeToc(){toc.classList.remove('open');tb.setAttribute('aria-expanded','false')}
tb.onclick=function(){var o=toc.classList.toggle('open');tb.setAttribute('aria-expanded',o?'true':'false');if(o)$('#q').focus()};
toc.addEventListener('click',function(e){if(e.target.closest('a'))closeToc()});
// keyboard
addEventListener('keydown',function(e){var t=e.target.tagName;if(t==='INPUT'||t==='TEXTAREA'||e.metaKey||e.ctrlKey||e.altKey)return;
 if(e.key==='/'){e.preventDefault();if(innerWidth<=980){toc.classList.add('open')}$('#q').focus()}
 else if(e.key==='j'||e.key==='ArrowRight'&&e.shiftKey){go(cur+1)}else if(e.key==='k'||e.key==='ArrowLeft'&&e.shiftKey){go(cur-1)}
 else if(e.key==='Escape'){closeToc()}});
// read marks
var KEY='ec-read-v1',read={};try{read=JSON.parse(localStorage.getItem(KEY)||'{}')}catch(_){}
function paintRead(){var c=0;$$('.mark').forEach(function(b){var on=!!read[b.dataset.id];b.setAttribute('aria-pressed',on);b.textContent=on?'✓ Read':'Mark as read';if(tocLinks[b.dataset.id])tocLinks[b.dataset.id].classList.toggle('read',on);if(on)c++});$('#readc').textContent=c}
$$('.mark').forEach(function(b){b.onclick=function(){var id=b.dataset.id;if(read[id])delete read[id];else read[id]=1;try{localStorage.setItem(KEY,JSON.stringify(read))}catch(_){}paintRead()}});paintRead();
// videos
$$('.video .vload').forEach(function(b){b.onclick=function(){var v=b.parentNode,id=v.dataset.vid,f=document.createElement('div');f.className='vframe';
 f.innerHTML='<iframe src="https://www.youtube-nocookie.com/embed/'+encodeURIComponent(id)+'?autoplay=1&rel=0" title="YouTube video" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen loading="lazy"></iframe>';v.appendChild(f);b.remove()}});
// search
var idx=pages.map(function(p){return{id:p.id,seq:+p.dataset.seq,title:$('h2',p).textContent,text:p.textContent.replace(/\s+/g,' ')}});
var q=$('#q'),qres=$('#qres'),qc=$('#qcount');
function esc(s){return s.replace(/[&<>"]/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})}
function search(){var s=q.value.trim().toLowerCase();qres.innerHTML='';
 if(s.length<2){qc.textContent='';$$('.toc-list li').forEach(function(l){l.hidden=false});return}
 var terms=s.split(/\s+/),hits=[];
 idx.forEach(function(d){var lt=d.text.toLowerCase(),tt=d.title.toLowerCase(),score=0,ok=terms.every(function(t){return lt.indexOf(t)>-1});if(!ok)return;
  terms.forEach(function(t){if(tt.indexOf(t)>-1)score+=10;score+=Math.min(lt.split(t).length-1,10)});
  var pos=lt.indexOf(terms[0]),a=Math.max(0,pos-60),snip=(a?'…':'')+d.text.slice(a,pos+110)+'…';hits.push({d:d,score:score,snip:snip})});
 hits.sort(function(a,b){return b.score-a.score});
 qc.textContent=hits.length+' page'+(hits.length===1?'':'s')+' match';
 var re=new RegExp('('+terms.map(function(t){return t.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}).join('|')+')','gi');
 qres.innerHTML=hits.slice(0,30).map(function(h){return '<li><a href="#'+h.d.id+'"><b>'+String(h.d.seq).padStart(2,'0')+' · '+esc(h.d.title)+'</b><small>'+esc(h.snip).replace(re,'<mark>$1</mark>')+'</small></a></li>'}).join('');
 var set={};hits.forEach(function(h){set[h.d.id]=1});$$('.toc-list ol a').forEach(function(a){a.parentNode.hidden=!set[a.dataset.id]});$$('.toc-list li.tg').forEach(function(g){g.hidden=!$('ol li:not([hidden])',g)});var tl=$('#toc');if(tl)tl.scrollTop=0}
var qt;q.addEventListener('input',function(){clearTimeout(qt);qt=setTimeout(search,120)});
q.addEventListener('keydown',function(e){if(e.key==='Enter'){var a=$('a',qres);if(a){location.hash=a.getAttribute('href').slice(1);closeToc()}}else if(e.key==='Escape'){q.value='';search();q.blur()}});
// calculator
var c=$('#calculator');
if(c){var v=function(id){var x=parseFloat($('#'+id).value);return isFinite(x)?x:0};
 var fmt=function(x,cur){if(!isFinite(x))return '–';return cur+x.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})};
 var calc=function(){var cur=$('#c-cur').value||'',rev=v('c-comp')+v('c-over')+v('c-res'),ut=v('c-ut')/100,cap=v('c-wk')*v('c-hr')*ut,vr=Math.min(v('c-var'),99)/100;
  $('#c-ut-o').textContent=Math.round(ut*100)+'%';
  var floor=cap>0?rev/cap:NaN,adj=cap>0?rev/(1-vr)/cap:NaN;
  $('#o-rev').textContent=fmt(rev,cur).replace(/\.00$/,'');$('#o-cap').textContent=Math.round(cap).toLocaleString()+' h';
  $('#o-floor').textContent=fmt(floor,cur);$('#o-adj').textContent=fmt(adj,cur);
  var fee=v('c-fee'),rows='';[80,120,160].forEach(function(h,i){var e=fee/h,ok=e>=adj;rows+='<tr><td>'+['Low effort','Central','Adverse'][i]+'</td><td>'+h+'</td><td>'+fmt(e,cur)+'</td><td class="'+(ok?'ok':'no')+'">'+(ok?'Above floor':'Below floor')+'</td></tr>'});
  $('#o-fixed').innerHTML=rows};
 $$('input',c).forEach(function(i){i.addEventListener('input',calc)});calc()}
addEventListener('hashchange',function(){var t=document.getElementById(location.hash.slice(1));if(t){var a=t.closest('article.page');if(a)setCur(pages.indexOf(a))}});
// initial hash
if(location.hash){var t=document.getElementById(location.hash.slice(1));if(t){var i=pages.indexOf(t.closest('article.page'));if(i>-1)setCur(i)}}
})();
