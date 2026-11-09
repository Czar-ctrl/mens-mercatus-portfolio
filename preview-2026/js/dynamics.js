(function(){
 var reduce=matchMedia("(prefers-reduced-motion: reduce)").matches;
 // live SAST clock
 var clk=document.querySelector("[data-clock]");
 function tick(){if(clk)clk.textContent=new Date().toLocaleTimeString("en-ZA",{timeZone:"Africa/Johannesburg",hour:"2-digit",minute:"2-digit"})+" SAST";}
 tick();setInterval(tick,30000);
 // sticky stack index
 var proj=document.querySelector(".gz-projects");
 if(proj){proj.classList.add("is-stack");[].forEach.call(proj.querySelectorAll(".gz-card"),function(c,i){c.style.setProperty("--i",i);});}
 var dock=document.querySelector(".gz-dock"),track=document.querySelector(".gz-marquee-track"),disp=document.querySelector(".gz-display");
 if(track){track.innerHTML+=track.innerHTML;}
 var x=0,lastY=scrollY,vel=0,cards=proj?proj.querySelectorAll(".gz-card"):[];
 function frame(){
  var y=scrollY,h=document.documentElement.scrollHeight-innerHeight;
  if(dock){dock.classList.toggle("on",y>innerHeight*.6);dock.style.setProperty("--sp",h>0?y/h:0);}
  if(!reduce){
   vel+=((y-lastY)-vel)*.1;lastY=y;
   if(track){x-=0.6+Math.min(Math.abs(vel),40)*.25;var w=track.scrollWidth/2;if(-x>w)x+=w;track.style.transform="translate3d("+x+"px,0,0)";}
   if(disp){var r=disp.getBoundingClientRect();var p=Math.max(-1,Math.min(1,(r.top-innerHeight*.5)/innerHeight));disp.style.setProperty("--dp",(p*30).toFixed(2));}
   if(innerWidth>=860)[].forEach.call(cards,function(c,i){var n=cards[i+1];if(!n)return;var d=n.getBoundingClientRect().top-c.getBoundingClientRect().top;var s=Math.max(0,Math.min(1,1-d/300));c.style.transform="scale("+(1-s*.05)+")";c.style.filter="brightness("+(1-s*.08)+")";});
  }
  requestAnimationFrame(frame);
 }
 requestAnimationFrame(frame);
})();
