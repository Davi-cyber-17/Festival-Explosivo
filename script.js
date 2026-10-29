/* ================== CONFIG ================== */
let W=540,H=1170,SL=[],ready=false;
const DUR=60,MAXA=1.05;
const COL=['#00e5ff','#ff3d71','#39ff88','#ffd23f','#b66dff'];
const DK=['#0097b2','#c42a52','#25b862','#c9a020','#8a4fd0'];
const PCFG={config:{iceServers:[{urls:'stun:stun.l.google.com:19302'},{urls:'stun:stun1.l.google.com:19302'},{urls:'stun:stun.cloudflare.com:3478'}]}};
/* teclado: 1 tecla por jogador no modo local; com 1 jogador / online vale Espaço, Enter, W ou ↑ */
const KEYS=['a','l','p','z','g'];
const FIREKEYS=[' ','enter','w','arrowup'];

/* A arena se adapta ao formato da tela: retrato = 540 de largura; paisagem = 540 de altura */
function desiredWorld(){
 const iw=innerWidth,ih=innerHeight,cl=(v)=>Math.round(Math.max(760,Math.min(1170,v)));
 return ih>=iw?[540,cl(540*ih/iw)]:[cl(540*iw/ih),540];
}
function applyWorld(w,h){
 W=w;H=h;
 const mx=140,ly=Math.min(205,Math.max(150,h*.175));
 SL=[
  {lx:mx,ly:ly},            // azul - topo esquerda
  {lx:w-mx,ly:h-ly},        // vermelho - base direita
  {lx:w-mx,ly:ly},          // verde - topo direita
  {lx:mx,ly:h-ly},          // amarelo - base esquerda
  {lx:mx+10,ly:h/2}         // roxo - meio esquerda
 ].map(s=>{s.base=Math.atan2(h/2-s.ly,w/2-s.lx);return s});
 if(ready)resize();
}
applyWorld(540,1170);

/* ================== LÓGICA DO JOGO ================== */
class Game{
 constructor(names,w,h){
  this.W=w;this.H=h;
  this.t=0;this.left=DUR;this.over=false;this.ev=[];
  this.p=names.map((n,i)=>({s:0,r:null,on:true,ph:i*1.7}));
  this.st=[];for(let i=0;i<4;i++)this.st.push(this.mk());
 }
 mk(){
  const my=Math.min(250,this.H*.3);let x,y;
  for(let k=0;k<12;k++){
   x=60+Math.random()*(this.W-120);y=my+Math.random()*(this.H-2*my);
   if(SL.every((s,i)=>i>=this.p.length||Math.hypot(s.lx-x,s.ly-y)>120))break;
  }
  return{x,y,a:Math.random()*6.283,v:90+Math.random()*80,w:(Math.random()-.5)*1.2};
 }
 aim(i){return SL[i].base+MAXA*Math.sin(this.t*2+this.p[i].ph)}
 fire(i){
  const p=this.p[i];if(this.over||!p||!p.on||p.r)return;
  const a=this.aim(i),s=SL[i];
  p.r={x:s.lx+Math.cos(a)*50,y:s.ly+Math.sin(a)*50,a,l:1.5};
 }
 step(dt){
  if(this.over)return;
  this.t+=dt;this.left-=dt;
  const W=this.W,H=this.H;
  for(const s of this.st){
   s.a+=s.w*dt;s.x+=Math.cos(s.a)*s.v*dt;s.y+=Math.sin(s.a)*s.v*dt;
   if(s.x<30||s.x>W-30){s.a=Math.PI-s.a;s.x=Math.max(30,Math.min(W-30,s.x))}
   if(s.y<30||s.y>H-30){s.a=-s.a;s.y=Math.max(30,Math.min(H-30,s.y))}
  }
  this.p.forEach((p,i)=>{
   const r=p.r;if(!r)return;
   r.x+=Math.cos(r.a)*780*dt;r.y+=Math.sin(r.a)*780*dt;r.l-=dt;
   for(let k=0;k<this.st.length;k++){
    const s=this.st[k];
    if(Math.hypot(s.x-r.x,s.y-r.y)<36){
     p.s++;this.ev.push([s.x|0,s.y|0,i]);this.st[k]=this.mk();p.r=null;return;
    }
   }
   if(r.l<=0||r.x<-20||r.x>W+20||r.y<-20||r.y>H+20){this.ev.push([r.x|0,r.y|0,-1]);p.r=null}
  });
  if(this.left<=0){this.left=0;this.over=true}
 }
 snap(){
  const o={l:this.left,o:this.over,
   p:this.p.map((p,i)=>[p.s,+this.aim(i).toFixed(3),p.r?[p.r.x|0,p.r.y|0,+p.r.a.toFixed(2)]:0,p.on?1:0]),
   st:this.st.map(s=>[s.x|0,s.y|0]),ev:this.ev};
  this.ev=[];return o;
 }
}

/* ================== ESTADO / UI ================== */
const $=id=>document.getElementById(id);
const cv=$('cv'),ctx=cv.getContext('2d',{alpha:false});
let mode=null,game=null,view=null,names=[],my=0,net={},fx=[],resultShown=false,netEv=[],frameN=0,last=0,tt=0,nLoc=2,playing=false,sc=1,ox=0,oy=0;
let flash={},exitHold=0,exitDown=false;
const DOTS=Array.from({length:70},()=>[Math.random(),Math.random(),3+Math.random()*3]);

function show(id){
 document.querySelectorAll('.screen').forEach(s=>s.classList.toggle('on',s.id===id));
 playing=(id===null);
 if(playing)wake();
}
function esc(s){const d=document.createElement('div');d.textContent=s;return d.innerHTML}
let DPR=1,dview=null,sm={st:[],p:[]},T=0,bgCache=null;
function resize(){
 DPR=Math.min(devicePixelRatio||1,1.5);
 const iw=innerWidth,ih=innerHeight;
 const cw=Math.round(iw*DPR),ch=Math.round(ih*DPR);
 if(cv.width!==cw)cv.width=cw;
 if(cv.height!==ch)cv.height=ch;
 bgCache=null;
 const sa=getComputedStyle($('sa'));
 const pt=parseFloat(sa.paddingTop)||0,pb=parseFloat(sa.paddingBottom)||0,pl=parseFloat(sa.paddingLeft)||0,pr=parseFloat(sa.paddingRight)||0;
 const aw=iw-pl-pr-4,ah=ih-pt-pb-4;
 sc=Math.min(aw/W,ah/H);
 ox=pl+(iw-pl-pr-W*sc)/2;oy=pt+(ih-pt-pb-H*sc)/2;
}
addEventListener('resize',resize);
addEventListener('orientationchange',()=>setTimeout(resize,250));
if(window.visualViewport)visualViewport.addEventListener('resize',resize);
resize();ready=true;

function send(d){
 try{
  if(mode==='host')(net.players||[]).forEach(p=>p.conn&&p.conn.open&&p.conn.send(d));
  else if(mode==='client'&&net.conn&&net.conn.open)net.conn.send(d);
 }catch(e){}
}
function toMenu(){
 try{net.peer&&net.peer.destroy()}catch(e){}
 net={};mode=null;game=null;view=null;fx=[];resultShown=false;names=[];netEv=[];flash={};exitDown=false;
 $('omsg').textContent='';show('home');
}

/* ---------- Modo Local ---------- */
$('bLocal').onclick=()=>show('local');
$('bBack1').onclick=()=>show('home');
$('nMinus').onclick=()=>{nLoc=Math.max(1,nLoc-1);$('nloc').textContent=nLoc};
$('nPlus').onclick=()=>{nLoc=Math.min(5,nLoc+1);$('nloc').textContent=nLoc};
$('bPlayLocal').onclick=()=>startLocal(nLoc);
function startLocal(n){
 mode='local';names=Array.from({length:n},(_,i)=>'Jogador '+(i+1));
 const w=desiredWorld();applyWorld(w[0],w[1]);
 game=new Game(names,W,H);view=null;fx=[];my=0;resultShown=false;resetInput();show(null);
}

/* ---------- Modo Online ---------- */
$('bOnline').onclick=()=>{
 if(typeof Peer==='undefined'){alert('Não foi possível carregar a biblioteca online (PeerJS). Verifique sua conexão.')}
 show('online');
};
$('bBack2').onclick=()=>show('home');
$('bLeave').onclick=toMenu;
$('bMenu').onclick=toMenu;
const getName=()=>($('pname').value.trim()||'Jogador').slice(0,12);
const omsg=t=>$('omsg').textContent=t;

function newCode(){const c='ABCDEFGHJKLMNPQRSTUVWXYZ';let s='';for(let i=0;i<4;i++)s+=c[Math.random()*c.length|0];return s}

$('bCreate').onclick=()=>createRoom();
function createRoom(){
 if(typeof Peer==='undefined'){omsg('Biblioteca online indisponível.');return}
 omsg('Criando sala…');
 const code=newCode();
 const peer=new Peer('xfest-'+code,PCFG);
 net={peer,code,players:[{name:getName(),conn:null}],phase:'lobby'};
 mode='host';my=0;
 peer.on('disconnected',()=>{try{peer.reconnect()}catch(e){}});
 peer.on('open',()=>{omsg('');$('rcode').textContent=code;renderLobby();show('lobby')});
 peer.on('error',e=>{
  if(e.type==='unavailable-id'){try{peer.destroy()}catch(_){};createRoom()}
  else{omsg('Erro de conexão: '+e.type);mode=null}
 });
 peer.on('connection',c=>{
  c.on('data',d=>{
   if(!d)return;
   if(d.t==='join'){
    if(net.phase!=='lobby'||net.players.length>=5){c.send({t:'full'});setTimeout(()=>c.close(),300);return}
    net.players.push({name:String(d.name||'Jogador').slice(0,12),conn:c});
    broadcastLobby();
   }else if(d.t==='fire'){
    const i=net.players.findIndex(p=>p.conn===c);
    if(i>=0&&game&&net.phase==='play')game.fire(i);
   }
  });
  c.on('close',()=>{
   const i=net.players?net.players.findIndex(p=>p.conn===c):-1;
   if(i<0)return;
   if(net.phase==='lobby'){net.players.splice(i,1);broadcastLobby()}
   else{net.players[i].conn=null;if(game&&game.p[i])game.p[i].on=false}
  });
 });
}
function broadcastLobby(){
 const list=net.players.map(p=>p.name);
 net.players.forEach((p,i)=>p.conn&&p.conn.open&&p.conn.send({t:'lobby',names:list,you:i,code:net.code}));
 renderLobby();
}
function renderLobby(){
 const list=mode==='host'?net.players.map(p=>p.name):names;
 $('players').innerHTML=list.map((n,i)=>`<li><i style="background:${COL[i]}"></i>${esc(n)}${i===my?' (você)':''}</li>`).join('');
 $('bStart').hidden=mode!=='host';
 $('wait').hidden=mode==='host';
}
$('bStart').onclick=()=>startOnline();
function startOnline(){
 net.phase='play';names=net.players.map(p=>p.name);
 const w=desiredWorld();applyWorld(w[0],w[1]);
 game=new Game(names,W,H);net.sentOver=false;netEv=[];view=null;fx=[];resultShown=false;resetInput();
 send({t:'start',names,W,H});show(null);
}

$('bJoin').onclick=()=>{
 if(typeof Peer==='undefined'){omsg('Biblioteca online indisponível.');return}
 const code=$('code').value.trim().toUpperCase();
 if(code.length!==4){omsg('Digite o código de 4 letras.');return}
 omsg('Conectando…');
 const peer=new Peer(undefined,PCFG);
 net={peer};mode='client';
 const timer=setTimeout(()=>{if(mode==='client'&&!net.joined){omsg('Sala não encontrada.');toMenuKeepMsg()}},10000);
 peer.on('open',()=>{
  const conn=peer.connect('xfest-'+code,{reliable:true});
  net.conn=conn;
  conn.on('open',()=>conn.send({t:'join',name:getName()}));
  conn.on('data',onClientData);
  conn.on('close',()=>{if(mode==='client'){clearTimeout(timer);alert('Conexão com a sala encerrada.');toMenu()}});
 });
 peer.on('error',e=>{clearTimeout(timer);omsg(e.type==='peer-unavailable'?'Sala não encontrada.':'Erro de conexão: '+e.type);toMenuKeepMsg()});
};
function toMenuKeepMsg(){const m=$('omsg').textContent;try{net.peer&&net.peer.destroy()}catch(e){}net={};mode=null;show('online');omsg(m)}

function onClientData(d){
 if(!d)return;
 if(d.t==='full'){omsg('Sala cheia ou jogo já iniciado.');toMenuKeepMsg();omsg('Sala cheia ou jogo já iniciado.')}
 else if(d.t==='lobby'){
  net.joined=true;names=d.names;my=d.you;$('rcode').textContent=d.code;renderLobby();show('lobby');
 }else if(d.t==='start'){
  names=d.names;if(d.W&&d.H)applyWorld(d.W,d.H);view=null;fx=[];resultShown=false;sm={st:[],p:[]};resetInput();show(null);
 }else if(d.t==='s'){
  d.names=names;view=d;processEv(d.ev);
 }
}

/* ---------- Resultado ---------- */
function showResult(){
 const rk=view.p.map((p,i)=>({i,s:p[0]})).sort((a,b)=>b.s-a.s);
 let title;
 if(rk.length===1)title='Pontuação final';
 else if(rk[0].s===rk[1].s)title='Empate!';
 else title='🏆 '+names[rk[0].i]+' venceu!';
 $('rtitle').textContent=title;
 $('rank').innerHTML=rk.map(r=>`<div style="color:${COL[r.i]}"><span>${esc(names[r.i])}</span><span>${r.s}</span></div>`).join('');
 $('bAgain').hidden=mode==='client';
 $('rwait').hidden=mode!=='client';
 show('result');playing=false;
}
$('bAgain').onclick=()=>{mode==='local'?startLocal(names.length):startOnline()};

/* ================== EFEITOS ================== */
function burst(x,y,c,n){
 for(let k=0;k<n;k++){
  const a=Math.random()*6.283,v=100+Math.random()*280;
  fx.push({k:'p',x,y,vx:Math.cos(a)*v,vy:Math.sin(a)*v,l:.8,m:.8,c:Math.random()<.3?'#fff':c,r:9+Math.random()*8});
 }
}
function processEv(ev){
 (ev||[]).forEach(e=>{
  if(e[2]>=0){burst(e[0],e[1],COL[e[2]],16);burst(e[0],e[1],'#ffe600',6)}
  else burst(e[0],e[1],'#ff8a84',6);
 });
}

/* ================== ENTRADA ================== */
/* O foguete gira sozinho. O jogador lança tocando na tela (ou no seu foguete, no modo local) ou apertando uma tecla. */
const XB={r:24};
const xbPos=()=>({x:W-36,y:36});
function resetInput(){flash={};exitDown=false;exitHold=0}
function press(i){
 flash[i]=performance.now();
 if(mode==='client')send({t:'fire'});else if(game)game.fire(i);
}
function toWorld(e){return{x:(e.clientX-ox)/sc,y:(e.clientY-oy)/sc}}
/* no modo local com vários jogadores, o toque vale para o foguete mais próximo */
function owner(x,y){
 if(mode!=='local')return my;
 if(names.length<2)return 0;
 let best=0,bd=1e9;
 for(let i=0;i<names.length;i++){const d=Math.hypot(x-SL[i].lx,y-SL[i].ly);if(d<bd){bd=d;best=i}}
 return best;
}
cv.addEventListener('pointerdown',e=>{
 e.preventDefault();if(!playing)return;
 if(e.pointerType==='mouse'&&e.button!==0)return;
 const w=toWorld(e),xp=xbPos();
 if(Math.hypot(w.x-xp.x,w.y-xp.y)<XB.r+14){exitDown=true;exitHold=0;return}
 press(owner(w.x,w.y));
});
const endPtr=()=>{exitDown=false;exitHold=0};
cv.addEventListener('pointerup',endPtr);
cv.addEventListener('pointercancel',endPtr);
cv.addEventListener('contextmenu',e=>e.preventDefault());
addEventListener('keydown',e=>{
 if(!playing||e.repeat)return;
 const k=e.key.toLowerCase();
 if(mode==='local'&&names.length>1){const i=KEYS.indexOf(k);if(i>=0&&i<names.length)press(i)}
 else if(FIREKEYS.includes(k)){e.preventDefault();press(mode==='local'?0:my)}
});

/* ================== DESENHO ================== */
const FONT="'Orbitron','Rajdhani',system-ui,sans-serif";
const fnt=(w,px)=>`${w} ${px}px ${FONT}`;
function GL(c,b){/* shadowBlur removido: era muito pesado; brilho agora é desenhado com formas translúcidas */}
function NG(){ctx.shadowBlur=0}
function alpha(c,a){const n=parseInt(c.slice(1),16);return `rgba(${n>>16},${n>>8&255},${n&255},${a})`}
function star(x,y,R,rot){
 ctx.beginPath();
 for(let i=0;i<10;i++){const r=i%2?R*.45:R,a=rot+i*Math.PI/5-Math.PI/2;ctx.lineTo(x+Math.cos(a)*r,y+Math.sin(a)*r)}
 ctx.closePath();
}
function rr(x,y,w,h,r){ctx.beginPath();ctx.roundRect(x,y,w,h,r)}
function hexPath(x,y,R,rot){
 ctx.beginPath();
 for(let i=0;i<6;i++){const a=rot+i*Math.PI/3;ctx.lineTo(x+Math.cos(a)*R,y+Math.sin(a)*R)}
 ctx.closePath();
}
function rocket(x,y,a,c,s=1){
 ctx.save();ctx.translate(x,y);ctx.rotate(a);ctx.scale(s,s);ctx.lineJoin='round';
 ctx.fillStyle='#ff9a2e';ctx.beginPath();ctx.moveTo(-18,-6);ctx.lineTo(-34-Math.random()*10,0);ctx.lineTo(-18,6);ctx.closePath();ctx.fill();
 GL(c,14);
 ctx.fillStyle='#0d1b33';ctx.strokeStyle=c;ctx.lineWidth=3;
 ctx.beginPath();ctx.rect(-20,-9,34,18);ctx.fill();ctx.stroke();
 ctx.fillStyle=c;ctx.beginPath();ctx.moveTo(14,-11);ctx.lineTo(37,0);ctx.lineTo(14,11);ctx.closePath();ctx.fill();
 ctx.beginPath();ctx.moveTo(-20,-9);ctx.lineTo(-28,-17);ctx.lineTo(-10,-9);ctx.moveTo(-20,9);ctx.lineTo(-28,17);ctx.lineTo(-10,9);ctx.stroke();
 NG();ctx.restore();
}
function streak(x,y,a,k,c){
 ctx.save();ctx.lineCap='round';ctx.strokeStyle=alpha(c,k);ctx.lineWidth=7*k+1;
 ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x-Math.cos(a)*34*k,y-Math.sin(a)*34*k);ctx.stroke();ctx.restore();
}
function aimingNow(i){return flash[i]&&performance.now()-flash[i]<160}
function launcher(i,p){
 const s=SL[i],c=COL[i],on=aimingNow(i);
 ctx.save();ctx.globalAlpha=p[3]?1:.3;

 if(mode==='local'&&names.length>1){ctx.setLineDash([]);ctx.strokeStyle=alpha(c,.35+.25*Math.sin(T*5));ctx.lineWidth=3;ctx.beginPath();ctx.arc(s.lx,s.ly,72+3*Math.sin(T*5),0,7);ctx.stroke()}
 /* arco de alcance da mira */
 ctx.setLineDash([4,10]);ctx.strokeStyle=alpha(c,.16);ctx.lineWidth=2;
 ctx.beginPath();ctx.arc(s.lx,s.ly,96,s.base-MAXA,s.base+MAXA);ctx.stroke();
 /* guia de mira */
 ctx.setLineDash([10,12]);ctx.strokeStyle=alpha(c,on?.8:.34);ctx.lineWidth=on?3.5:2;
 const len=on?520:300;
 ctx.beginPath();ctx.moveTo(s.lx+Math.cos(p[1])*62,s.ly+Math.sin(p[1])*62);ctx.lineTo(s.lx+Math.cos(p[1])*len,s.ly+Math.sin(p[1])*len);ctx.stroke();
 ctx.setLineDash([]);
 hexPath(s.lx,s.ly,56,p[1]*.6);ctx.strokeStyle=alpha(c,on?.38:.2);ctx.lineWidth=14;ctx.stroke();ctx.strokeStyle=c;ctx.lineWidth=5;ctx.fillStyle=alpha(c,on?.22:.12);ctx.fill();ctx.stroke();
 hexPath(s.lx,s.ly,34,-p[1]*.9);ctx.lineWidth=3;ctx.strokeStyle=alpha(c,.8);ctx.stroke();
 NG();ctx.beginPath();ctx.arc(s.lx,s.ly,7,0,7);ctx.fillStyle=c;ctx.fill();
 if(!p[2])rocket(s.lx+Math.cos(p[1])*72,s.ly+Math.sin(p[1])*72,p[1],c);
 /* nome do jogador embaixo do lançador */
 let label=names[i]||'';
 if(mode==='local'&&names.length>1)label='J'+(i+1);
 else if((mode==='host'||mode==='client')&&i===my)label='VOCÊ';
 else if(names.length===1)label='';
 if(label){ctx.textAlign='center';ctx.textBaseline='middle';ctx.font=fnt(700,13);ctx.fillStyle=alpha(c,.95);ctx.fillText(label.slice(0,10),s.lx,s.ly+82)}
 ctx.restore();
}
/* placar compacto no topo */
function hud(v){
 const n=v.p.length,gap=6,cw=Math.min(n===1?120:150,(W-20-gap*(n-1))/n),tw=n*cw+(n-1)*gap,x0=(W-tw)/2,y=62,h=34;
 const rk=v.p.map((p,i)=>p[0]);
 v.p.forEach((p,i)=>{
  const x=x0+i*(cw+gap),c=COL[i];
  ctx.save();ctx.globalAlpha=p[3]?1:.35;
  rr(x,y,cw,h,8);ctx.fillStyle='rgba(8,16,38,.82)';ctx.fill();
  ctx.strokeStyle=c;ctx.lineWidth=(mode==='host'||mode==='client')&&i===my?3:1.5;ctx.stroke();
  ctx.fillStyle=c;ctx.beginPath();ctx.arc(x+13,y+h/2,5,0,7);ctx.fill();
  ctx.textBaseline='middle';ctx.textAlign='left';ctx.font=fnt(700,11);
  const nm=n===1?'PONTOS':(mode==='local'?'J'+(i+1):(names[i]||'').slice(0,cw>110?9:5));
  ctx.fillText(nm,x+24,y+h/2+1);
  ctx.textAlign='right';ctx.font=fnt(900,19);ctx.fillText(p[0],x+cw-10,y+h/2+1);
  ctx.restore();
 });
}
function fireButton(){
 const x=W/2,y=H-62,r=44,on=aimingNow(my)||aimingNow(0),c=COL[mode==='local'?0:my]||COL[0];
 ctx.save();
 GL(c,on?34:18);ctx.beginPath();ctx.arc(x,y,r*(on?.93:1),0,7);
 const g=ctx.createRadialGradient(x,y,6,x,y,r);g.addColorStop(0,alpha(c,.9));g.addColorStop(1,alpha(c,.3));
 ctx.fillStyle=g;ctx.fill();ctx.lineWidth=4;ctx.strokeStyle=c;ctx.stroke();NG();
 ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle='#fff';ctx.font=fnt(800,13);ctx.fillText('LANÇAR',x,y+1);
 ctx.restore();
}
function hintText(v){
 const el=DUR-v.l;if(el>7)return;
 const k=el<5?1:1-(el-5)/2;
 ctx.save();ctx.globalAlpha=.85*k;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle='#e8f6ff';
 const lines=['TOQUE NA TELA OU APERTE UMA TECLA','PARA LANÇAR O FOGUETE'];
 if(mode==='local'&&names.length>1)lines.push('CADA UM TOCA PERTO DO SEU FOGUETE','TECLAS: '+KEYS.slice(0,names.length).join(' ').toUpperCase());
 ctx.font=fnt(700,Math.min(16,W/30));
 lines.forEach((t,j)=>ctx.fillText(t,W/2,H/2-20+j*26));
 ctx.restore();
}
function buildBg(){
 const iw=innerWidth,ih=innerHeight;
 bgCache=document.createElement('canvas');bgCache.width=cv.width;bgCache.height=cv.height;
 const b=bgCache.getContext('2d');b.setTransform(DPR,0,0,DPR,0,0);
 const g=b.createRadialGradient(iw/2,ih/2,0,iw/2,ih/2,Math.max(iw,ih)*.7);
 g.addColorStop(0,'#0c1530');g.addColorStop(1,'#03060f');
 b.fillStyle=g;b.fillRect(0,0,iw,ih);
}
function bg(){
 const iw=innerWidth,ih=innerHeight;
 ctx.setTransform(DPR,0,0,DPR,0,0);
 if(!bgCache)buildBg();
 ctx.drawImage(bgCache,0,0,iw,ih);
 const gs=48,off=(T*12)%gs;
 ctx.strokeStyle='rgba(0,229,255,.07)';ctx.lineWidth=1;ctx.beginPath();
 for(let x=-gs+off;x<iw;x+=gs){ctx.moveTo(x,0);ctx.lineTo(x,ih)}
 for(let y=-gs+off;y<ih;y+=gs){ctx.moveTo(0,y);ctx.lineTo(iw,y)}
 ctx.stroke();
 ctx.fillStyle='rgba(180,220,255,.28)';
 for(const d of DOTS){ctx.fillRect((d[0]*iw+T*d[2]*2)%iw,d[1]*ih,d[2]/2,d[2]/2)}
}
function brackets(x,y,w,h,L=30){
 ctx.save();ctx.strokeStyle='rgba(0,229,255,.25)';ctx.lineWidth=1;ctx.strokeRect(x,y,w,h);
 ctx.strokeStyle='#00e5ff';ctx.lineWidth=3;ctx.beginPath();
 ctx.moveTo(x,y+L);ctx.lineTo(x,y);ctx.lineTo(x+L,y);
 ctx.moveTo(x+w-L,y);ctx.lineTo(x+w,y);ctx.lineTo(x+w,y+L);
 ctx.moveTo(x+w,y+h-L);ctx.lineTo(x+w,y+h);ctx.lineTo(x+w-L,y+h);
 ctx.moveTo(x+L,y+h);ctx.lineTo(x,y+h);ctx.lineTo(x,y+h-L);
 ctx.stroke();ctx.restore();
}
function box(x,y,w,h,t){
 ctx.fillStyle='rgba(6,14,34,.72)';ctx.fillRect(x,y,w,h);
 ctx.strokeStyle='rgba(0,229,255,.45)';ctx.lineWidth=1.5;ctx.strokeRect(x,y,w,h);
 ctx.fillStyle='#00e5ff';ctx.font=fnt(700,13);ctx.textAlign='left';ctx.textBaseline='middle';ctx.fillText(t,x+16,y+24);
}
function draw(){
 T=performance.now()/1000;
 bg();
 const v=dview;
 if(!v)return;
 const fw=W*sc,fh=H*sc;
 ctx.fillStyle='rgba(4,10,26,.55)';ctx.fillRect(ox,oy,fw,fh);
 ctx.save();ctx.beginPath();ctx.rect(ox,oy,fw,fh);ctx.clip();
 ctx.setTransform(sc*DPR,0,0,sc*DPR,ox*DPR,oy*DPR);
 for(const q of fx){
  const k=Math.max(0,q.l/q.m);
  if(q.k==='r'){streak(q.x,q.y,q.a,k,q.c);continue}
  ctx.globalAlpha=k;ctx.fillStyle=q.c;
  star(q.x,q.y,q.k==='s'?q.r*k+2:q.r*k+1,q.k==='s'?q.x:q.l*6);ctx.fill();
 }
 ctx.globalAlpha=1;
 const now=T*1.1;
 v.st.forEach((s,k)=>{
  ctx.fillStyle='rgba(255,230,0,.2)';star(s[0],s[1],38,now+k);ctx.fill();
  ctx.fillStyle='#ffe600';star(s[0],s[1],27,now+k);ctx.fill();
  ctx.fillStyle='#fff7a8';star(s[0],s[1],11,now+k);ctx.fill();
 });
 v.p.forEach((p,i)=>launcher(i,p));
 v.p.forEach((p,i)=>{if(p[2])rocket(p[2][0],p[2][1],p[2][2],COL[i],1.1)});
hintText(v);
 hud(v);
 const c=v.l<10?'#ff3d71':'#00e5ff';
 GL(c,10);ctx.fillStyle=c;ctx.fillRect(0,0,W*v.l/DUR,5);NG();
 ctx.fillStyle=v.l<10?'#ff3d71':'rgba(232,246,255,.9)';ctx.font=fnt(800,32);ctx.textAlign='center';ctx.textBaseline='middle';
 ctx.fillText(Math.ceil(v.l),W/2,36);
 /* sair: segurar o X por 0,6 s */
 {const xp=xbPos(),r=XB.r;
  ctx.beginPath();ctx.arc(xp.x,xp.y,r,0,7);ctx.fillStyle='rgba(5,12,30,.85)';ctx.fill();
  GL('#00e5ff',8);ctx.strokeStyle='rgba(0,229,255,.7)';ctx.lineWidth=2.5;ctx.stroke();NG();
  if(exitDown&&exitHold>0){ctx.strokeStyle='#ff3d71';ctx.lineWidth=5;ctx.beginPath();ctx.arc(xp.x,xp.y,r+5,-Math.PI/2,-Math.PI/2+Math.min(1,exitHold/.6)*6.2832);ctx.stroke()}
  ctx.lineCap='round';ctx.lineWidth=4;ctx.strokeStyle='#e8f6ff';ctx.beginPath();
  ctx.moveTo(xp.x-8,xp.y-8);ctx.lineTo(xp.x+8,xp.y+8);ctx.moveTo(xp.x+8,xp.y-8);ctx.lineTo(xp.x-8,xp.y+8);ctx.stroke();}
 ctx.restore();
 ctx.setTransform(DPR,0,0,DPR,0,0);
 brackets(ox,oy,fw,fh);
}

/* ================== LOOP ================== */
function smooth(dt){
 if(mode!=='client'||!view){dview=view;sm={st:[],p:[]};return}
 const k=1-Math.exp(-dt*16);
 dview={l:view.l,o:view.o,
  st:view.st.map((s,i)=>{
   let o=sm.st[i];
   if(!o||Math.hypot(o[0]-s[0],o[1]-s[1])>140)o=sm.st[i]=[s[0],s[1]];
   else{o[0]+=(s[0]-o[0])*k;o[1]+=(s[1]-o[1])*k}
   return[o[0],o[1]];
  }),
  p:view.p.map((p,i)=>{
   let a=sm.p[i];if(!a)a=sm.p[i]={a:p[1],r:null};
   a.a+=(p[1]-a.a)*k;
   let r=null;
   if(p[2]){
    if(!a.r||Math.hypot(a.r[0]-p[2][0],a.r[1]-p[2][1])>200)a.r=[p[2][0],p[2][1]];
    else{a.r[0]+=(p[2][0]-a.r[0])*k;a.r[1]+=(p[2][1]-a.r[1])*k}
    r=[a.r[0],a.r[1],p[2][2]];
   }else a.r=null;
   return[p[0],a.a,r,p[3]];
  })};
}
let wl=null;
async function wake(){try{if(navigator.wakeLock&&!wl){wl=await navigator.wakeLock.request('screen');wl.addEventListener('release',()=>{wl=null})}}catch(e){wl=null}}

function frame(ts){
 const dt=Math.min(.05,(ts-last)/1000||0);last=ts;
 if(playing){
  if(exitDown){exitHold+=dt;if(exitHold>=.6){exitDown=false;exitHold=0;toMenu();requestAnimationFrame(frame);return}}
 }
 if((mode==='local'||mode==='host')&&game){
  game.step(dt);
  view=game.snap();
  processEv(view.ev);
  if(mode==='host'){
   netEv=netEv.concat(view.ev);
   if(++frameN%3===0||(view.o&&!net.sentOver)){
    if(view.o)net.sentOver=true;
    send({t:'s',l:view.l,o:view.o,p:view.p,st:view.st,ev:netEv});netEv=[];
   }
  }
 }
 smooth(dt);
 const v=dview;
 if(v){
  tt+=dt;
  if(tt>.06){
   tt=0;
   v.st.forEach(s=>fx.push({k:'s',x:s[0],y:s[1],l:.5,m:.5,c:Math.random()<.5?'#ffe600':'#7fdcff',r:6+Math.random()*4}));
   v.p.forEach((p,i)=>{if(p[2])fx.push({k:'r',x:p[2][0],y:p[2][1],a:p[2][2],l:.4,m:.4,c:COL[i]})});
  }
  if(view&&view.o&&!resultShown&&mode){resultShown=true;setTimeout(()=>{if(view&&mode)showResult()},700)}
 }
 for(const f of fx){f.l-=dt;if(f.vx){f.x+=f.vx*dt;f.y+=f.vy*dt}}
 fx=fx.filter(f=>f.l>0);
 if(fx.length>200)fx.splice(0,fx.length-200);
 draw();
 requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
