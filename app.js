const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const STORAGE = 'udt-coach-v1';
const formations={
  '4-3-3':[[50,88],[17,72],[38,75],[62,75],[83,72],[26,52],[50,58],[74,52],[19,27],[50,20],[81,27]],
  '4-2-3-1':[[50,89],[17,73],[38,76],[62,76],[83,73],[38,59],[62,59],[18,39],[50,42],[82,39],[50,20]],
  '4-4-2':[[50,89],[17,73],[38,76],[62,76],[83,73],[16,48],[39,53],[61,53],[84,48],[37,23],[63,23]],
  '3-5-2':[[50,89],[25,72],[50,76],[75,72],[12,50],[35,56],[50,47],[65,56],[88,50],[37,23],[63,23]],
  '3-4-3':[[50,89],[25,72],[50,76],[75,72],[18,50],[40,55],[60,55],[82,50],[18,25],[50,20],[82,25]]
};
const seedPlayers=[
  ['Álvaro Robles',1,'Portero','available','Seguridad en el juego aéreo.'],['Aythami',4,'Defensa','available','Central diestro.'],['David García',5,'Defensa','available','Líder de la línea defensiva.'],['Javi Trujillo',2,'Lateral','doubt','Molestias leves. Evaluar antes del partido.'],['Carlos Cid',3,'Lateral','available','Buena proyección ofensiva.'],['Dani Ojeda',6,'Mediocentro','available','Pivote defensivo.'],['Ale González',8,'Mediocentro','available','Llegada desde segunda línea.'],['Samuel Ramos',10,'Mediocentro','available','Balón parado.'],['Eros Delgado',7,'Extremo','available','Ataca bien el espacio.'],['Quintero',11,'Extremo','injured','Recuperación muscular.'],['Asdrúbal',9,'Delantero','available','Referencia ofensiva.'],['Julio Báez',14,'Delantero','suspended','Un partido de sanción.']
].map((p,i)=>({id:'p'+i,name:p[0],number:p[1],position:p[2],status:p[3],notes:p[4],photo:''}));
function defaultState(){return {players:seedPlayers.map(p=>({...p})),tactics:[{id:'t1',name:'Táctica 1',formation:'4-3-3',placed:[],arrows:[]}],activeTactic:'t1',match:{opponent:'CD Mensajero',competition:'Tercera Federación',date:'',venue:'Juan Guedes'}}}
function normalizeState(s){
  s.players||=[];s.match||={opponent:'',competition:'',date:'',venue:''};
  s.tactics||=[{id:'t1',name:'Táctica 1',formation:'4-3-3',placed:[],arrows:[]}];
  if(!s.tactics.find(t=>t.id===s.activeTactic))s.activeTactic=s.tactics[0].id;
  s.rivals ||= [['Portero rival',1,'Portero'],['Central rival',4,'Defensa'],['Lateral rival',2,'Lateral'],['Mediocentro rival',6,'Mediocentro'],['Delantero rival',9,'Delantero']].map((p,i)=>({id:'r'+i,name:p[0],number:p[1],position:p[2],status:'available',notes:'',photo:''}));
  s.rivalColors ||= {primary:'#20232b',secondary:'#ffbd35'};
  s.club ||= 'UD Tamaraceite';
  s.crest ??= '';
  s.match.time ??= '';s.match.meet ??= '';s.match.notice ??= '';s.match.goals ||= [];
  s.trainings ||= seedTrainings();
  s.trainings.forEach(t=>{t.name??='';t.date??='';t.notes??='';t.stations||=[];t.stations.forEach(st=>{st.name??='';st.notes??='';st.playerIds||=[]})});
  s.live ||= {};
  const L=s.live;
  L.started=!!L.started;L.finished=!!L.finished;
  L.running=false;              // siempre en pausa al cargar: ni tiempo fantasma ni doble conteo entre dispositivos
  L.half=L.half||1;L.halfLength=L.halfLength||45;L.elapsed=L.elapsed||0;
  L.minutes=L.minutes||{};      // segundos acumulados por jugador propio
  L.events=Array.isArray(L.events)?L.events:[];
  // called = ids convocados. undefined significa "aún no elegidos": la primera
  // vez se propone automáticamente a todos los disponibles.
  if(s.match.called && !Array.isArray(s.match.called))delete s.match.called;
  s.tactics.forEach(t=>{t.placed||=[];t.arrows||=[];t.opponentPlaced||=[];t.graphics||=[];t.labels||=[];t.highlighted||=[];t.substitutions||=[]});
  return s
}
let state=normalizeState(defaultState());
let editingId=null,photoData='',tool='move',drawing=null,substitutionPending=null;
const statusText={available:'Disponible',doubt:'En duda',injured:'Lesionado',suspended:'Sancionado'};
const initials=n=>n.split(/\s+/).map(x=>x[0]).slice(0,2).join('').toUpperCase();
// Todo lo que escribe el usuario acaba en innerHTML: sin esto, un jugador
// llamado "Pérez & Cía" o una anotación con < rompen el render.
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const tactic=()=>state.tactics.find(t=>t.id===state.activeTactic);
function storageKey(){return keyHash?STORAGE+':'+keyHash:STORAGE}
let toastTimer=null;
function showToast(msg,ms=1800){const t=$('#toast');t.textContent=msg;t.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.classList.remove('show'),ms)}
function persist(show=false){
  try{localStorage.setItem(storageKey(),JSON.stringify(state))}
  catch(e){console.warn('No se pudo guardar en el navegador:',e);showToast('Aviso: el navegador se ha quedado sin espacio. Usa fotos más ligeras.',4500)}
  scheduleCloudSave();
  if(show)showToast('Cambios guardados')
}
function avatarStyle(p){return p.photo?`style="background-image:url('${p.photo}')"`:''}
const VIEW_TITLES={board:'Pizarra táctica',squad:'Gestión de plantilla',training:'Entrenamientos',rival:'Análisis del rival'};
const VIEW_EYEBROWS={board:'PARTIDO · PLANIFICACIÓN',squad:'EQUIPO · TEMPORADA 2026/27',training:'SESIONES · PREPARACIÓN',rival:'SCOUTING · PRÓXIMO PARTIDO'};
function switchView(v){$$('.view,.nav-item').forEach(x=>x.classList.remove('active'));$(`#${v}View`).classList.add('active');$(`.nav-item[data-view="${v}"]`).classList.add('active');$('#pageTitle').textContent=VIEW_TITLES[v]||'';$('#sectionEyebrow').textContent=VIEW_EYEBROWS[v]||'';$('.sidebar').classList.remove('open');renderAll()}
$$('.nav-item').forEach(b=>b.onclick=()=>switchView(b.dataset.view));$$('[data-go-squad]').forEach(b=>b.onclick=()=>switchView('squad'));$$('[data-go-rival]').forEach(b=>b.onclick=()=>switchView('rival'));$('.mobile-menu').onclick=()=>$('.sidebar').classList.toggle('open');
function renderTabs(){$('#tacticTabs').innerHTML=state.tactics.map((t,i)=>`<button class="tactic-tab ${t.id===state.activeTactic?'active':''}" data-id="${t.id}">${esc(t.name)}${state.tactics.length>1?`<span class="remove" data-remove="${t.id}">×</span>`:''}</button>`).join('');$$('.tactic-tab').forEach(b=>b.onclick=e=>{if(e.target.dataset.remove){e.stopPropagation();state.tactics=state.tactics.filter(t=>t.id!==e.target.dataset.remove);if(state.activeTactic===e.target.dataset.remove)state.activeTactic=state.tactics[0].id}else state.activeTactic=b.dataset.id;persist();renderAll()})}
$('#addTactic').onclick=()=>{const n=state.tactics.length+1,id='t'+Date.now();state.tactics.push({id,name:`Táctica ${n}`,formation:'4-3-3',placed:[],arrows:[]});state.activeTactic=id;persist();renderAll()};
function renderBench(){const placed=new Set(tactic().placed.map(x=>x.playerId));const available=state.players.filter(p=>!placed.has(p.id));$('#availableCount').textContent=available.length;$('#benchList').innerHTML=available.map(p=>`<button class="bench-player own-choice" data-id="${p.id}"><span class="bench-avatar" ${avatarStyle(p)}>${p.photo?'':esc(initials(p.name))}</span><p><strong>${esc(p.name)}</strong><small>${esc(p.position)} · ${esc(p.number)}</small></p><i class="status-dot ${p.status}"></i></button>`).join('')||'<p class="helper">Toda la plantilla está en el campo.</p>';$$('.own-choice').forEach(b=>b.onclick=()=>benchAction(b.dataset.id,'own'));}
function renderRivalBench(){const placed=new Set(tactic().opponentPlaced.map(x=>x.playerId)),available=state.rivals.filter(p=>!placed.has(p.id));$('#rivalAvailableCount').textContent=available.length;$('#rivalBenchList').innerHTML=available.map(p=>`<button class="bench-player rival-choice" data-id="${p.id}"><span class="bench-avatar" ${avatarStyle(p)}>${p.photo?'':esc(initials(p.name))}</span><p><strong>${esc(p.name)}</strong><small>${esc(p.position)} · ${esc(p.number)}</small></p></button>`).join('')||'<p class="helper">Todo el rival está en el campo.</p>';$$('.rival-choice').forEach(b=>b.onclick=()=>benchAction(b.dataset.id,'rival'))}
function benchAction(id,team){if(tool==='sub'){if(!substitutionPending){showToast('Primero selecciona quién sale del campo');return}if(substitutionPending.team!==team){showToast('Elige un jugador del mismo equipo');return}completeSubstitution(id);return}placePlayer(id,team)}
function placePlayer(id,team='own'){const t=tactic(),list=team==='rival'?t.opponentPlaced:t.placed,spots=formations[t.formation]||[];let pos=team==='rival'?[15+list.length%4*23,15+Math.floor(list.length/4)*12]:(spots[list.length]||[50,50]);list.push({playerId:id,x:pos[0],y:pos[1]});persist();renderBoard()}
function renderPitch(){const t=tactic();$('#formation').value=t.formation;const own=t.placed.map(pp=>playerHTML(pp,state.players,'own')).join(''),rival=t.opponentPlaced.map(pp=>playerHTML(pp,state.rivals,'rival')).join('');$('#pitchPlayers').innerHTML=own+rival;$('#pitchHint').style.display=(t.placed.length+t.opponentPlaced.length)?'none':'block';$$('.pitch-player').forEach(el=>{el.onpointerdown=startPlayerDrag;el.oncontextmenu=e=>{e.preventDefault();e.stopPropagation();openContextMenu(e.clientX,e.clientY,el.dataset.id,el.dataset.team)}});renderArrows()}
function playerHTML(pp,roster,team){const p=roster.find(x=>x.id===pp.playerId);if(!p)return'';const marked=tactic().highlighted.includes(team+':'+p.id),selected=substitutionPending&&substitutionPending.team===team&&substitutionPending.id===p.id;const rivalStyle=team==='rival'?`--rival-primary:${state.rivalColors.primary};--rival-secondary:${state.rivalColors.secondary}`:'';const liveMin=(team==='own'&&state.live&&state.live.started&&!state.live.finished)?`<u class="live-min" data-min="${p.id}">${Math.floor((state.live.minutes[p.id]||0)/60)}′</u>`:'';return `<div class="pitch-player ${team==='rival'?'rival':''} ${marked?'highlighted':''} ${selected?'sub-selected':''}" data-id="${p.id}" data-team="${team}" style="left:${pp.x}%;top:${pp.y}%;${rivalStyle}"><div class="player-token" ${avatarStyle(p)}>${p.photo?'':esc(initials(p.name))}<b>${esc(p.number||'-')}</b>${liveMin}</div><small>${esc(p.name.split(' ')[0])}</small></div>`}
function startPlayerDrag(e){const el=e.currentTarget,id=el.dataset.id,team=el.dataset.team,key=team+':'+id;if(tool==='highlight'){e.preventDefault();const h=tactic().highlighted,i=h.indexOf(key);i>=0?h.splice(i,1):h.push(key);persist();renderPitch();return}if(tool==='sub'){e.preventDefault();substitutionPending={id,team};renderPitch();showToast('Ahora selecciona quién entra desde el banquillo',2000);return}if(tool==='remove'){e.preventDefault();removePlayerFromPitch(id,team);return}if(tool!=='move')return;if(e.pointerType==='mouse'&&e.button!==0)return;e.preventDefault();const pitch=$('#pitch'),list=team==='rival'?tactic().opponentPlaced:tactic().placed,pp=list.find(x=>x.playerId===id);el.setPointerCapture(e.pointerId);
  // Pulsación larga (táctil) abre el menú contextual; en ratón lo hace el clic
  // derecho vía oncontextmenu. Si el dedo se mueve, es un arrastre y se cancela.
  let lpTimer=null,sx=e.clientX,sy=e.clientY;
  if(e.pointerType!=='mouse')lpTimer=setTimeout(()=>{lpTimer=null;el.onpointermove=null;el.onpointerup=null;try{el.releasePointerCapture(e.pointerId)}catch(_){}openContextMenu(sx,sy,id,team)},480);
  el.onpointermove=ev=>{if(lpTimer&&Math.hypot(ev.clientX-sx,ev.clientY-sy)>8){clearTimeout(lpTimer);lpTimer=null}const r=pitch.getBoundingClientRect();pp.x=Math.max(3,Math.min(97,(ev.clientX-r.left)/r.width*100));pp.y=Math.max(3,Math.min(97,(ev.clientY-r.top)/r.height*100));el.style.left=pp.x+'%';el.style.top=pp.y+'%'};el.onpointerup=()=>{if(lpTimer){clearTimeout(lpTimer);lpTimer=null}el.onpointermove=null;persist();renderBench();renderRivalBench()}}
function completeSubstitution(inId){const t=tactic(),team=substitutionPending.team,list=team==='rival'?t.opponentPlaced:t.placed,spot=list.find(x=>x.playerId===substitutionPending.id);if(!spot)return;const outId=spot.playerId;spot.playerId=inId;t.substitutions.push({x:spot.x,y:spot.y,team,outId,inId});if(state.live.started&&!state.live.finished&&team==='own')state.live.events.push({id:'e'+Date.now()+Math.random().toString(36).slice(2,5),type:'sub',team,outId,inId,half:state.live.half,min:liveMinute()});substitutionPending=null;persist();renderBoard();showToast('Cambio realizado')}
function removePlayerFromPitch(id,team){const t=tactic(),key=team+':'+id;if(team==='rival')t.opponentPlaced=t.opponentPlaced.filter(x=>x.playerId!==id);else t.placed=t.placed.filter(x=>x.playerId!==id);t.highlighted=t.highlighted.filter(x=>x!==key);persist();renderBoard()}
function renderArrows(){const t=tactic();$('#arrows').innerHTML=t.arrows.map(a=>a.curve?`<path d="M ${a.x1} ${a.y1} Q ${a.cx} ${a.cy} ${a.x2} ${a.y2}"/>`:`<path d="M ${a.x1} ${a.y1} L ${a.x2} ${a.y2}"/>`).join('');$('#graphics').innerHTML=t.graphics.map(g=>g.type==='circle'?`<circle cx="${g.cx}" cy="${g.cy}" r="${g.r}"/>`:`<path d="${g.d}"/>`).join('');$('#textLayer').innerHTML=t.labels.map((l,i)=>`<span class="pitch-text" data-label="${i}" style="left:${l.x}%;top:${l.y}%">${esc(l.text)}</span>`).join('');$('#substitutionLayer').innerHTML=t.substitutions.map((s,i)=>`<span class="sub-badge" data-sub="${i}" style="left:${s.x}%;top:${s.y}%"><i class="in">↗</i><i class="out">↙</i></span>`).join('');$$('[data-label]').forEach(x=>x.onclick=()=>{if(tool==='remove'){t.labels.splice(+x.dataset.label,1);persist();renderArrows()}});$$('[data-sub]').forEach(x=>x.onclick=()=>{if(tool==='remove'){t.substitutions.splice(+x.dataset.sub,1);persist();renderArrows()}})}
$('#pitch').onpointerdown=e=>{if(e.pointerType==='mouse'&&e.button!==0)return;if(!['arrow','curve','circle','pen','text','remove'].includes(tool)||e.target.closest('.pitch-player,.pitch-text,.sub-badge'))return;const r=$('#pitch').getBoundingClientRect(),x=(e.clientX-r.left)/r.width*1000,y=(e.clientY-r.top)/r.height*1400;if(tool==='remove'){removeNearestAnnotation(x,y);return}if(tool==='text'){const value=prompt('Escribe la indicación:');if(value){tactic().labels.push({text:value.slice(0,60),x:x/10,y:y/14});persist();renderArrows()}return}drawing={x1:x,y1:y,x2:x,y2:y,points:[[x,y]]};$('#pitch').setPointerCapture(e.pointerId)};
function removeNearestAnnotation(x,y){const t=tactic(),candidates=[];t.arrows.forEach((a,i)=>candidates.push({kind:'arrows',i,d:Math.hypot(x-(a.x1+a.x2)/2,y-(a.y1+a.y2)/2)}));t.graphics.forEach((g,i)=>{let gx=g.cx,gy=g.cy;if(g.type==='pen'){const nums=(g.d.match(/[\d.]+/g)||[]).map(Number);gx=nums[nums.length-2];gy=nums[nums.length-1]}candidates.push({kind:'graphics',i,d:Math.hypot(x-gx,y-gy)})});t.labels.forEach((l,i)=>candidates.push({kind:'labels',i,d:Math.hypot(x-l.x*10,y-l.y*14)}));t.substitutions.forEach((s,i)=>candidates.push({kind:'substitutions',i,d:Math.hypot(x-s.x*10,y-s.y*14)}));const nearest=candidates.sort((a,b)=>a.d-b.d)[0];if(nearest&&nearest.d<180){t[nearest.kind].splice(nearest.i,1);persist();renderArrows()}}
$('#pitch').onpointermove=e=>{if(!drawing)return;const r=$('#pitch').getBoundingClientRect();drawing.x2=(e.clientX-r.left)/r.width*1000;drawing.y2=(e.clientY-r.top)/r.height*1400;if(tool==='pen')drawing.points.push([drawing.x2,drawing.y2]);let d;if(tool==='circle'){const radius=Math.hypot(drawing.x2-drawing.x1,drawing.y2-drawing.y1);d=`M ${drawing.x1-radius} ${drawing.y1} a ${radius} ${radius} 0 1 0 ${radius*2} 0 a ${radius} ${radius} 0 1 0 ${-radius*2} 0`}else if(tool==='pen')d='M '+drawing.points.map(p=>p.join(' ')).join(' L ');else d=tool==='curve'?`M ${drawing.x1} ${drawing.y1} Q ${drawing.x1+(drawing.x2-drawing.x1)*.65} ${drawing.y1-(Math.abs(drawing.x2-drawing.x1)*.45+70)} ${drawing.x2} ${drawing.y2}`:`M ${drawing.x1} ${drawing.y1} L ${drawing.x2} ${drawing.y2}`;$('#draftArrow').setAttribute('d',d)};
$('#pitch').onpointerup=()=>{if(!drawing)return;const distance=Math.hypot(drawing.x2-drawing.x1,drawing.y2-drawing.y1);if(distance>20){if(tool==='circle')tactic().graphics.push({type:'circle',cx:drawing.x1,cy:drawing.y1,r:distance});else if(tool==='pen')tactic().graphics.push({type:'pen',d:'M '+drawing.points.map(p=>p.join(' ')).join(' L ')});else{if(tool==='curve'){drawing.curve=true;drawing.cx=drawing.x1+(drawing.x2-drawing.x1)*.65;drawing.cy=drawing.y1-(Math.abs(drawing.x2-drawing.x1)*.45+70)}tactic().arrows.push(drawing)}}drawing=null;$('#draftArrow').setAttribute('d','');persist();renderArrows()};
$$('.tool[data-tool]').forEach(b=>b.onclick=()=>{tool=b.dataset.tool;if(tool!=='sub')substitutionPending=null;$$('.tool[data-tool]').forEach(x=>x.classList.toggle('active',x===b));renderPitch()});$('#clearArrows').onclick=()=>{const t=tactic();t.arrows=[];t.graphics=[];t.labels=[];t.highlighted=[];t.substitutions=[];persist();renderBoard()};$('#clearPitch').onclick=()=>{tactic().placed=[];tactic().opponentPlaced=[];substitutionPending=null;persist();renderBoard()};
$('#formation').onchange=e=>{const t=tactic();t.formation=e.target.value;const spots=formations[t.formation];if(spots)t.placed.forEach((p,i)=>{if(spots[i]){p.x=spots[i][0];p.y=spots[i][1]}});persist();renderPitch()};
function renderBoard(){renderTabs();renderBench();renderRivalBench();renderPitch();renderScoreboard();renderLive()}
function renderSquad(){const q=$('#playerSearch').value.toLowerCase(),filter=$('#statusFilter').value;const list=state.players.filter(p=>(filter==='all'||p.status===filter)&&(p.name+' '+p.position).toLowerCase().includes(q));$('#playerGrid').innerHTML=list.map(p=>`<article class="player-card"><div class="player-card-top"><div class="card-avatar" ${avatarStyle(p)}>${p.photo?'':esc(initials(p.name))}</div><div><h3>${esc(p.name)}</h3><span class="role">${esc(p.position)}</span><br><span class="status-tag"><i class="${p.status}"></i>${statusText[p.status]}</span></div><span class="number">${esc(p.number||'—')}</span></div><p class="notes">${esc(p.notes)||'Sin notas añadidas.'}</p><div class="card-actions"><button data-edit="${p.id}">Editar ficha</button><button class="delete" data-delete="${p.id}">×</button></div></article>`).join('')||'<p>No se encontraron jugadores.</p>';$('#totalPlayers').textContent=state.players.length;$('#fitPlayers').textContent=state.players.filter(p=>p.status==='available').length;$('#doubtPlayers').textContent=state.players.filter(p=>p.status==='doubt').length;$('#outPlayers').textContent=state.players.filter(p=>['injured','suspended'].includes(p.status)).length;$('#squadCount').textContent=state.players.length;$$('[data-edit]').forEach(b=>b.onclick=()=>openPlayer(b.dataset.edit));$$('[data-delete]').forEach(b=>b.onclick=()=>{if(confirm('¿Eliminar este jugador de la plantilla?')){const did=b.dataset.delete;state.players=state.players.filter(p=>p.id!==did);state.tactics.forEach(t=>t.placed=t.placed.filter(x=>x.playerId!==did));state.match.goals=state.match.goals.filter(x=>!(x.team==='own'&&x.scorerId===did));state.match.goals.forEach(x=>{if(x.team==='own'&&x.assistId===did)x.assistId=null});state.trainings.forEach(t=>t.stations.forEach(s=>{s.playerIds=s.playerIds.filter(pid=>pid!==did)}));persist();renderAll()}})}
$('#playerSearch').oninput=renderSquad;$('#statusFilter').onchange=renderSquad;$('#newPlayer').onclick=()=>openPlayer();
function renderRivals(){const q=$('#rivalSearch').value.toLowerCase();$('#rivalTeamName').textContent=state.match.opponent||'Equipo rival';const list=state.rivals.filter(p=>(p.name+' '+p.position).toLowerCase().includes(q));$('#rivalGrid').innerHTML=list.map(p=>`<article class="player-card"><div class="player-card-top"><div class="card-avatar" ${avatarStyle(p)}>${p.photo?'':esc(initials(p.name))}</div><div><h3>${esc(p.name)}</h3><span class="role">${esc(p.position)}</span></div><span class="number">${esc(p.number||'—')}</span></div><p class="notes">${esc(p.notes)||'Sin notas de scouting.'}</p><div class="card-actions"><button data-rival-edit="${p.id}">Editar ficha</button><button class="delete" data-rival-delete="${p.id}">×</button></div></article>`).join('')||'<p>No se encontraron jugadores rivales.</p>';$('#rivalCount').textContent=state.rivals.length;$$('[data-rival-edit]').forEach(b=>b.onclick=()=>openPlayer(b.dataset.rivalEdit,'rival'));$$('[data-rival-delete]').forEach(b=>b.onclick=()=>{if(confirm('¿Eliminar este jugador rival?')){const did=b.dataset.rivalDelete;state.rivals=state.rivals.filter(p=>p.id!==did);state.tactics.forEach(t=>t.opponentPlaced=t.opponentPlaced.filter(x=>x.playerId!==did));state.match.goals=state.match.goals.filter(x=>!(x.team==='rival'&&x.scorerId===did));state.match.goals.forEach(x=>{if(x.team==='rival'&&x.assistId===did)x.assistId=null});persist();renderAll()}})}
$('#rivalSearch').oninput=renderRivals;$('#newRival').onclick=()=>openPlayer(null,'rival');
function openPlayer(id=null,type='own'){editingId=id;$('#rosterType').value=type;const roster=type==='rival'?state.rivals:state.players;const p=roster.find(x=>x.id===id)||{name:'',number:'',position:'Portero',status:'available',notes:'',photo:''};$('#modalTitle').textContent=id?(type==='rival'?'Editar rival':'Editar jugador'):(type==='rival'?'Nuevo jugador rival':'Nuevo jugador');$('#playerName').value=p.name;$('#playerNumber').value=p.number;$('#playerPosition').value=p.position;$('#playerStatus').value=p.status;$('#playerNotes').value=p.notes;photoData=p.photo||'';updatePhoto(p.name);$('#playerDialog').showModal()}
function updatePhoto(name=''){$('#photoPreview').src=photoData;$('#photoPreview').style.display=photoData?'block':'none';$('#photoInitials').style.display=photoData?'none':'block';$('#photoInitials').textContent=name?initials(name):'+'}
$('#playerName').oninput=e=>updatePhoto(e.target.value);$('#photoInput').onchange=e=>{const f=e.target.files[0];if(!f)return;const reader=new FileReader();reader.onload=ev=>{const img=new Image();img.onload=()=>{const max=300,ratio=Math.min(1,max/Math.max(img.width,img.height)),c=document.createElement('canvas');c.width=Math.max(1,Math.round(img.width*ratio));c.height=Math.max(1,Math.round(img.height*ratio));const ctx=c.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,c.width,c.height);ctx.drawImage(img,0,0,c.width,c.height);photoData=c.toDataURL('image/jpeg',.78);updatePhoto($('#playerName').value)};img.src=ev.target.result};reader.readAsDataURL(f)};$$('.close').forEach(b=>b.onclick=()=>$('#playerDialog').close());
$('#playerForm').onsubmit=e=>{e.preventDefault();const type=$('#rosterType').value,roster=type==='rival'?state.rivals:state.players;const obj={id:editingId||(type==='rival'?'r':'p')+Date.now(),name:$('#playerName').value.trim(),number:Number($('#playerNumber').value)||'',position:$('#playerPosition').value,status:$('#playerStatus').value,notes:$('#playerNotes').value.trim(),photo:photoData};if(!obj.name)return;if(editingId)Object.assign(roster.find(p=>p.id===editingId),obj);else roster.push(obj);$('#playerDialog').close();persist(true);renderAll()};
const MATCH_FIELDS={opponent:'opponent',competition:'competition',matchDate:'date',matchTime:'time',venue:'venue'};
function refreshMatchInputs(){Object.entries(MATCH_FIELDS).forEach(([id,k])=>{$('#'+id).value=state.match[k]||''});$('#rivalPrimary').value=state.rivalColors.primary;$('#rivalSecondary').value=state.rivalColors.secondary}
Object.entries(MATCH_FIELDS).forEach(([id,k])=>{$('#'+id).onchange=e=>{state.match[k]=e.target.value;persist();renderScoreboard()}});
['rivalPrimary','rivalSecondary'].forEach(id=>$('#'+id).oninput=e=>{state.rivalColors[id==='rivalPrimary'?'primary':'secondary']=e.target.value;persist();renderPitch()});
refreshMatchInputs();
$('#saveBtn').onclick=()=>persist(true);$('#printBtn').onclick=()=>{document.body.classList.add('export-all');window.print();setTimeout(()=>document.body.classList.remove('export-all'),500)};window.onafterprint=()=>document.body.classList.remove('export-all');
/* ===== Identidad del club: escudo y nombre =====
   El escudo se guarda dentro de los datos de la pizarra, así que cada clave
   tiene el suyo y viaja a todos sus dispositivos. Para una venta personalizada
   basta con cambiar el archivo de DEFAULT_CREST: será el que vea quien todavía
   no haya subido ninguno, incluida la pantalla de acceso. */
const DEFAULT_CREST='escudos/Escudo-UD-Tamaraceite.png';
const crestSrc=()=>state.crest||DEFAULT_CREST;
function applyBrand(){
  const src=crestSrc(),nombre=state.club||'Equipo';
  // Solo se reasigna si cambia: renderAll() se llama a menudo y volver a poner
  // el mismo data URL hace parpadear la imagen.
  ['#brandCrest','#matchCrest'].forEach(sel=>{const el=$(sel);if(el.getAttribute('src')!==src)el.setAttribute('src',src)});
  if($('#brandName').textContent!==nombre.toUpperCase())$('#brandName').textContent=nombre.toUpperCase();
  if($('#matchClub').textContent!==nombre)$('#matchClub').textContent=nombre
}
function openClub(){
  $('#clubName').value=state.club||'';
  $('#crestPreview').src=crestSrc();
  $('#crestReset').style.display=state.crest?'block':'none';
  $('#clubDialog').showModal()
}
$('#clubBtn').onclick=openClub;
$('.brand').onclick=e=>{e.preventDefault();openClub()};
$$('.close-club').forEach(b=>b.onclick=()=>$('#clubDialog').close());
$('#clubName').oninput=()=>{state.club=$('#clubName').value.trim();applyBrand();persist();renderScoreboard()};
$('#crestReset').onclick=()=>{state.crest='';$('#crestPreview').src=crestSrc();$('#crestReset').style.display='none';applyBrand();persist(true)};
$('#crestInput').onchange=e=>{
  const f=e.target.files[0];if(!f)return;
  e.target.value='';
  const reader=new FileReader();
  reader.onload=ev=>{
    const img=new Image();
    img.onerror=()=>showToast('No se ha podido leer la imagen.',4000);
    img.onload=()=>{
      // PNG y sin fondo pintado, al revés que las fotos de jugador: un escudo en
      // JPEG saldría con un recuadro blanco sobre el morado de la barra lateral.
      const max=220,r=Math.min(1,max/Math.max(img.width,img.height)),c=document.createElement('canvas');
      c.width=Math.max(1,Math.round(img.width*r));c.height=Math.max(1,Math.round(img.height*r));
      c.getContext('2d').drawImage(img,0,0,c.width,c.height);
      state.crest=c.toDataURL('image/png');
      $('#crestPreview').src=state.crest;$('#crestReset').style.display='block';
      applyBrand();persist(true)
    };
    img.src=ev.target.result
  };
  reader.readAsDataURL(f)
};

/* ===== Convocatoria para WhatsApp =====
   El entrenador ya tiene su grupo del equipo, así que la app no envía nada:
   compone el mensaje y lo abre en SU WhatsApp. Sin API de Meta, sin coste por
   mensaje y sin que los datos de los jugadores salgan de su móvil. */
const MESES=['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
const DIAS=['domingo','lunes','martes','miércoles','jueves','viernes','sábado'];
function matchDateText(){
  const d=state.match.date;if(!d)return'';
  // A mano: new Date('2026-09-06') se interpreta como UTC y en Canarias puede
  // acabar mostrando el día anterior.
  const [y,m,dia]=d.split('-').map(Number),f=new Date(y,m-1,dia);
  const txt=`${DIAS[f.getDay()]}, ${dia} de ${MESES[m-1]}`;
  return txt.charAt(0).toUpperCase()+txt.slice(1)
}
const byNumber=(a,b)=>(Number(a.number)||99)-(Number(b.number)||99);
function calledIds(){
  // Sin elección previa se propone a los disponibles. Se descartan los ids de
  // jugadores que ya no estén en la plantilla.
  const sel=Array.isArray(state.match.called)?state.match.called:state.players.filter(p=>p.status==='available').map(p=>p.id);
  const vivos=new Set(state.players.map(p=>p.id));
  return sel.filter(id=>vivos.has(id))
}
function buildCallText(){
  const m=state.match,sel=new Set(calledIds()),lin=[];
  lin.push(`*${(state.club||'Equipo').toUpperCase()}* — Convocatoria`,'');
  const fecha=matchDateText();
  if(fecha||m.time)lin.push(`📅 ${[fecha,m.time].filter(Boolean).join(' · ')}`);
  if(m.opponent)lin.push(`⚔️ vs ${m.opponent}`);
  if(m.venue)lin.push(`🏟️ ${m.venue}`);
  if(m.competition)lin.push(`🏆 ${m.competition}`);
  const conv=state.players.filter(p=>sel.has(p.id)).sort(byNumber);
  lin.push('',`*CONVOCADOS (${conv.length})*`);
  conv.forEach(p=>lin.push(`${p.number||'–'} · ${p.name}`));
  if(m.meet||m.notice)lin.push('');
  if(m.meet)lin.push(`⏰ Citación: ${m.meet}`);
  if(m.notice)lin.push(`⚠️ ${m.notice}`);
  return lin.join('\n')
}
function refreshCallPreview(){$('#callPreview').value=buildCallText()}
function renderCallList(){
  const sel=new Set(calledIds());
  $('#callList').innerHTML=[...state.players].sort(byNumber).map(p=>`<label class="call-row"><input type="checkbox" data-call="${p.id}" ${sel.has(p.id)?'checked':''} /><span class="call-num">${esc(p.number||'–')}</span><strong>${esc(p.name)}</strong><span class="call-tag"><i class="${p.status}"></i>${statusText[p.status]}</span></label>`).join('')||'<p class="helper">No hay jugadores en la plantilla.</p>';
  $$('[data-call]').forEach(c=>c.onchange=()=>{
    state.match.called=$$('[data-call]').filter(x=>x.checked).map(x=>x.dataset.call);
    persist();$('#callCount').textContent=state.match.called.length;refreshCallPreview()
  });
  $('#callCount').textContent=sel.size
}
function openCall(){
  $('#callTeam').value=state.club||'';
  $('#callMeet').value=state.match.meet||'';
  $('#callNotice').value=state.match.notice||'';
  renderCallList();refreshCallPreview();
  $('#callDialog').showModal()
}
$('#callBtn').onclick=openCall;
$$('.close-call').forEach(b=>b.onclick=()=>$('#callDialog').close());
['callTeam','callMeet','callNotice'].forEach(id=>$('#'+id).oninput=()=>{
  state.club=$('#callTeam').value.trim();
  state.match.meet=$('#callMeet').value;
  state.match.notice=$('#callNotice').value.trim();
  applyBrand();persist();refreshCallPreview();renderScoreboard()
});
$('#callAll').onclick=()=>{state.match.called=state.players.map(p=>p.id);persist();renderCallList();refreshCallPreview()};
$('#callNone').onclick=()=>{state.match.called=[];persist();renderCallList();refreshCallPreview()};
$('#callSend').onclick=()=>{
  const texto=$('#callPreview').value.trim();
  if(!texto){showToast('El mensaje está vacío.');return}
  // wa.me sin número: WhatsApp deja elegir a qué chat o grupo se envía.
  window.open('https://wa.me/?text='+encodeURIComponent(texto),'_blank','noopener')
};
$('#callCopy').onclick=async()=>{
  try{await navigator.clipboard.writeText($('#callPreview').value);showToast('Mensaje copiado')}
  catch(e){$('#callPreview').select();showToast('Pulsa Ctrl+C para copiar el mensaje',3000)}
};
function renderAll(){applyBrand();renderBoard();renderSquad();renderRivals();renderTrainings()}

/* ===== Menú contextual del jugador (clic derecho en PC / pulsación larga en móvil) =====
   Sustituir reutiliza el flujo de la herramienta de cambio; Editar abre la ficha
   ya existente; Asignar gol registra goleador y asistencia. El menú aparece sobre
   la foto del jugador en la pizarra, en modo Mover (la herramienta por defecto). */
function rosterOf(team){return team==='rival'?state.rivals:state.players}
let menuTarget=null;
function openContextMenu(x,y,id,team){
  if(!rosterOf(team).find(p=>p.id===id))return;
  menuTarget={id,team};
  const ev=$('#ctxEvents');
  if(state.live.started&&!state.live.finished){
    ev.innerHTML='<div class="ctx-sep">REGISTRAR ACCIÓN</div><div class="ctx-ev-grid">'+LIVE_EVENTS.map(e=>`<button type="button" class="ctx-ev" data-ev="${e.t}" title="${e.label}">${e.ic}<span>${e.label}</span></button>`).join('')+'</div>';
    ev.style.display=''
  }else{ev.innerHTML='';ev.style.display='none'}
  const m=$('#playerMenu');m.classList.remove('hidden');
  const mw=m.offsetWidth||190,mh=m.offsetHeight||160;
  m.style.left=Math.max(8,Math.min(x,innerWidth-mw-8))+'px';
  m.style.top=Math.max(8,Math.min(y,innerHeight-mh-8))+'px'
}
function closeContextMenu(){$('#playerMenu').classList.add('hidden');menuTarget=null}
$('#playerMenu').onclick=e=>{
  const btn=e.target.closest('button');if(!btn||!menuTarget)return;
  const {id,team}=menuTarget;
  if(btn.dataset.ev){logEvent(btn.dataset.ev,id,team);closeContextMenu();return}
  const act=btn.dataset.act;closeContextMenu();
  if(act==='sub')startSubstitution(id,team);
  else if(act==='edit')openPlayer(id,team);
  else if(act==='goal')openGoalDialog(id,team)
};
// Cerrar al tocar fuera, al hacer scroll, al redimensionar o con Escape.
document.addEventListener('pointerdown',e=>{if(!e.target.closest('#playerMenu'))closeContextMenu()});
document.addEventListener('scroll',closeContextMenu,true);
window.addEventListener('resize',closeContextMenu);
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeContextMenu()});
// Sin menú nativo del navegador al usar el botón derecho sobre el campo.
$('#pitch').addEventListener('contextmenu',e=>e.preventDefault());

function startSubstitution(id,team){
  tool='sub';$$('.tool[data-tool]').forEach(x=>x.classList.toggle('active',x.dataset.tool==='sub'));
  substitutionPending={id,team};renderPitch();
  showToast('Ahora selecciona quién entra desde el banquillo',2200)
}

/* ===== Goles: goleador + asistencia, con marcador en la tarjeta del partido ===== */
let goalTeam='own';
function goalOptions(team,exclude){return rosterOf(team).slice().sort(byNumber).filter(p=>p.id!==exclude).map(p=>`<option value="${p.id}">${esc((p.number?p.number+' · ':'')+p.name)}</option>`).join('')}
function fillAssist(){$('#goalAssist').innerHTML='<option value="">Sin asistencia</option>'+goalOptions(goalTeam,$('#goalScorer').value)}
function openGoalDialog(id,team){
  goalTeam=team;
  const nombre=team==='rival'?(state.match.opponent||'Rival'):(state.club||'Equipo');
  $('#goalEyebrow').textContent=nombre.toUpperCase()+' · GOL';
  $('#goalScorer').innerHTML=goalOptions(team,null);
  $('#goalScorer').value=id;fillAssist();
  $('#goalDialog').showModal()
}
$('#goalScorer').onchange=fillAssist;
$$('.close-goal').forEach(b=>b.onclick=()=>$('#goalDialog').close());
$('#goalForm').onsubmit=e=>{
  e.preventDefault();
  const scorerId=$('#goalScorer').value;if(!scorerId)return;
  state.match.goals.push({id:'g'+Date.now(),team:goalTeam,scorerId,assistId:$('#goalAssist').value||null,min:(state.live.started&&!state.live.finished)?liveMinute():null});
  $('#goalDialog').close();persist(true);renderScoreboard();showToast('Gol registrado')
};
function renderScoreboard(){
  const box=$('#scoreboard');if(!box)return;
  const g=state.match.goals||[];
  const own=g.filter(x=>x.team==='own').length,riv=g.filter(x=>x.team==='rival').length;
  const nameOf=(team,pid)=>{const p=rosterOf(team).find(x=>x.id===pid);return p?p.name:'—'};
  // Local a la izquierda (side 'home'), visitante a la derecha ('away'). El balón
  // se coloca hacia la línea central para que cada columna "mire" al marcador.
  const item=(x,side)=>{
    const scorer=esc(nameOf(x.team,x.scorerId));
    const assist=x.assistId?`<div class="g-assist">↳ ${esc(nameOf(x.team,x.assistId))}</div>`:'';
    const min=x.min?`<span class="g-min">${x.min}′</span>`:'';
    const main=side==='home'
      ?`<span class="g-name">${scorer}</span><span class="g-ball">⚽</span>${min}`
      :`${min}<span class="g-ball">⚽</span><span class="g-name">${scorer}</span>`;
    return `<li class="g-row"><div class="g-main">${main}</div>${assist}<button class="g-del" data-goal="${x.id}" title="Quitar gol" aria-label="Quitar gol">×</button></li>`
  };
  const homeCol=g.filter(x=>x.team==='own').map(x=>item(x,'home')).join('');
  const awayCol=g.filter(x=>x.team==='rival').map(x=>item(x,'away')).join('');
  const awayBadge=`<span class="score-badge" style="--rp:${state.rivalColors.primary};--rs:${state.rivalColors.secondary}">${esc(initials(state.match.opponent||'Rival'))}</span>`;
  box.innerHTML=`
    <div class="score-head">
      <div class="score-team home"><img class="score-crest" src="${crestSrc()}" alt="" /><span class="score-name">${esc(state.club||'Equipo')}</span></div>
      <div class="score-num"><b>${own}</b><i>–</i><b>${riv}</b></div>
      <div class="score-team away"><span class="score-name">${esc(state.match.opponent||'Rival')}</span>${awayBadge}</div>
    </div>`
    +(g.length?`<div class="score-goals"><ul class="goal-col home">${homeCol}</ul><span class="goal-divider"></span><ul class="goal-col away">${awayCol}</ul></div>`
              :`<p class="score-hint">Clic derecho (PC) o pulsación larga (móvil) sobre un jugador para asignar un gol.</p>`);
  $$('[data-goal]').forEach(b=>b.onclick=()=>{state.match.goals=state.match.goals.filter(x=>x.id!==b.dataset.goal);persist();renderScoreboard()})
}

/* ===== Entrenamientos: sesiones con estaciones y jugadores, compartibles por WhatsApp =====
   Cada sesión tiene estaciones y cada estación sus jugadores. Compartir compone el
   mensaje agrupado por estación (así cada jugador ve lo que le toca) y lo abre en
   WhatsApp, igual que la convocatoria: la app no envía nada por su cuenta. Todo es
   texto, así que apenas pesa en la sincronización. */
function seedTrainings(){return [
  {id:'tr1',name:'Calentamiento y activación',date:'',notes:'Activación general antes de la parte principal. Material: balones, petos y conos.',stations:[
    {name:'Movilidad articular',notes:'Tobillos, rodillas y cadera. 8 min de movilidad dinámica.',playerIds:[]},
    {name:'Rondo 4v1',notes:'Dos toques máximo. Rota el jugador del medio cada minuto.',playerIds:['p5','p6','p7','p8']},
    {name:'Sprints progresivos',notes:'4 series de 20 m aumentando la intensidad.',playerIds:[]}
  ]},
  {id:'tr2',name:'Circuito de conos',date:'',notes:'Técnica individual con balón. Tres estaciones en rotación de 10 min.',stations:[
    {name:'Conducción en zigzag',notes:'Conos a 2 m. Ida con pie derecho, vuelta con el izquierdo.',playerIds:['p8','p10']},
    {name:'Slalom y finalización',notes:'Superar 5 conos y disparo a portería.',playerIds:['p9','p11']},
    {name:'Cambios de dirección',notes:'Agilidad y reactividad con conos de colores.',playerIds:[]}
  ]},
  {id:'tr3',name:'Sesión de recuperación',date:'',notes:'Día posterior al partido. Baja intensidad para quienes jugaron más minutos.',stations:[
    {name:'Trote suave continuo',notes:'12 min a ritmo cómodo.',playerIds:[]},
    {name:'Estiramientos guiados',notes:'Tren inferior. Mantén cada posición 20-30 s.',playerIds:[]},
    {name:'Core y movilidad',notes:'Planchas y trabajo de zona media. 3 rondas.',playerIds:[]}
  ]},
  {id:'tr4',name:'Táctico: presión tras pérdida',date:'',notes:'Trabajo colectivo de presión y transiciones en campo reducido.',stations:[
    {name:'Presión tras pérdida',notes:'Recuperar en los primeros 6 segundos. Situación 8v8.',playerIds:['p1','p2','p5','p6']},
    {name:'Salida de balón',notes:'Construir desde atrás superando la primera línea de presión.',playerIds:['p0','p3','p4']}
  ]}
]}
function sessionDateText(d){
  if(!d)return'';
  const [y,m,dia]=d.split('-').map(Number),f=new Date(y,m-1,dia);
  const txt=`${DIAS[f.getDay()]}, ${dia} de ${MESES[m-1]}`;
  return txt.charAt(0).toUpperCase()+txt.slice(1)
}
function playerTag(id){const p=state.players.find(x=>x.id===id);return p?((p.number?p.number+' ':'')+p.name):''}
function renderTrainings(){
  const q=($('#trainingSearch').value||'').toLowerCase();
  const list=state.trainings.filter(t=>(t.name+' '+t.notes+' '+t.stations.map(s=>s.name).join(' ')).toLowerCase().includes(q));
  $('#trainingCount').textContent=state.trainings.length;
  $('#trainingList').innerHTML=list.map(t=>{
    const nPlayers=new Set(t.stations.flatMap(s=>s.playerIds)).size;
    const stations=t.stations.map(s=>{
      const names=s.playerIds.map(id=>esc(playerTag(id))).filter(Boolean);
      return `<div class="tr-station"><div class="tr-station-head"><strong>${esc(s.name)||'Estación'}</strong>${names.length?`<span class="tr-count">${names.length}</span>`:''}</div>${s.notes?`<p>${esc(s.notes)}</p>`:''}${names.length?`<div class="tr-players">${names.map(n=>`<span class="tr-chip">${n}</span>`).join('')}</div>`:'<p class="tr-empty">Sin jugadores asignados</p>'}</div>`
    }).join('');
    const fecha=sessionDateText(t.date);
    return `<article class="training-card"><div class="training-card-top"><div><h3>${esc(t.name)||'Entrenamiento'}</h3>${fecha?`<span class="tr-date">📅 ${esc(fecha)}</span>`:'<span class="tr-date muted">Sin fecha</span>'}</div><span class="tr-meta">${t.stations.length} est. · ${nPlayers} jug.</span></div>${t.notes?`<p class="tr-notes">${esc(t.notes)}</p>`:''}<div class="tr-stations">${stations||'<p class="tr-empty">Sin estaciones todavía.</p>'}</div><div class="tr-actions"><button data-tr-edit="${t.id}">Editar</button><button data-tr-share="${t.id}">📤 Compartir</button><button class="delete" data-tr-del="${t.id}" aria-label="Eliminar">×</button></div></article>`
  }).join('')||'<p>No hay entrenamientos. Crea el primero con “Nuevo entrenamiento”.</p>';
  $$('[data-tr-edit]').forEach(b=>b.onclick=()=>openTraining(b.dataset.trEdit));
  $$('[data-tr-share]').forEach(b=>b.onclick=()=>openTrainingShare(b.dataset.trShare));
  $$('[data-tr-del]').forEach(b=>b.onclick=()=>{if(confirm('¿Eliminar este entrenamiento?')){state.trainings=state.trainings.filter(t=>t.id!==b.dataset.trDel);persist();renderTrainings()}})
}

/* Editor: trabaja sobre una copia y solo confirma al guardar. Los campos de texto
   actualizan la copia sin re-renderizar, para no perder el foco al escribir. */
let editingTraining=null;
function blankStation(){return {name:'',notes:'',playerIds:[]}}
function openTraining(id){
  const src=id?state.trainings.find(t=>t.id===id):null;
  editingTraining=src?JSON.parse(JSON.stringify(src)):{id:'tr'+Date.now(),name:'',date:'',notes:'',stations:[blankStation()]};
  $('#trainingModalTitle').textContent=id?'Editar entrenamiento':'Nuevo entrenamiento';
  $('#trainingName').value=editingTraining.name;
  $('#trainingDate').value=editingTraining.date||'';
  $('#trainingNotes').value=editingTraining.notes||'';
  renderStations();
  $('#trainingDialog').showModal()
}
function renderStations(){
  $('#stationCount').textContent=editingTraining.stations.length;
  const chips=st=>state.players.slice().sort(byNumber).map(p=>`<button type="button" class="pchip ${st.playerIds.includes(p.id)?'on':''}" data-pid="${p.id}">${esc((p.number?p.number+' ':'')+p.name.split(' ')[0])}</button>`).join('')||'<span class="tr-empty">No hay jugadores en la plantilla.</span>';
  $('#stationsList').innerHTML=editingTraining.stations.map((st,i)=>`<div class="station-block" data-si="${i}"><div class="station-top"><input class="station-name" placeholder="Nombre de la estación" value="${esc(st.name)}" /><button type="button" class="station-del" title="Quitar estación" aria-label="Quitar estación">×</button></div><textarea class="station-notes" rows="2" placeholder="Ejercicio, indicaciones, material…">${esc(st.notes)}</textarea><div class="mini-eyebrow">JUGADORES</div><div class="chip-row">${chips(st)}</div></div>`).join('')||'<p class="tr-empty">Añade una estación para asignar jugadores.</p>';
  $$('#stationsList .station-block').forEach(block=>{
    const st=editingTraining.stations[+block.dataset.si];
    block.querySelector('.station-name').oninput=e=>st.name=e.target.value;
    block.querySelector('.station-notes').oninput=e=>st.notes=e.target.value;
    block.querySelector('.station-del').onclick=()=>{editingTraining.stations.splice(+block.dataset.si,1);renderStations()};
    block.querySelectorAll('.pchip').forEach(c=>c.onclick=()=>{
      const arr=st.playerIds,idx=arr.indexOf(c.dataset.pid);
      idx>=0?arr.splice(idx,1):arr.push(c.dataset.pid);
      c.classList.toggle('on')
    })
  })
}
$('#addStation').onclick=()=>{editingTraining.stations.push(blankStation());renderStations()};
$$('.close-training').forEach(b=>b.onclick=()=>$('#trainingDialog').close());
$('#trainingForm').onsubmit=e=>{
  e.preventDefault();
  editingTraining.name=$('#trainingName').value.trim();
  editingTraining.date=$('#trainingDate').value;
  editingTraining.notes=$('#trainingNotes').value.trim();
  if(!editingTraining.name){showToast('Ponle un nombre al entrenamiento.');return}
  editingTraining.stations=editingTraining.stations.filter(s=>s.name.trim()||s.notes.trim()||s.playerIds.length);
  const i=state.trainings.findIndex(t=>t.id===editingTraining.id);
  if(i>=0)state.trainings[i]=editingTraining;else state.trainings.push(editingTraining);
  $('#trainingDialog').close();persist(true);renderTrainings()
};

/* Compartir por WhatsApp: mensaje agrupado por estación con sus jugadores. */
function buildTrainingText(t){
  const lin=[`*${(state.club||'Equipo').toUpperCase()}* — Entrenamiento`,''];
  lin.push(`🏋️ *${t.name||'Sesión'}*`);
  const f=sessionDateText(t.date);if(f)lin.push(`📅 ${f}`);
  if(t.notes)lin.push(`📝 ${t.notes}`);
  t.stations.forEach((s,i)=>{
    lin.push('',`*${i+1}. ${s.name||'Estación'}*`);
    if(s.notes)lin.push(s.notes);
    const names=s.playerIds.map(id=>playerTag(id)).filter(Boolean);
    lin.push(names.length?`👥 ${names.join(', ')}`:'👥 (sin asignar)')
  });
  return lin.join('\n')
}
function openTrainingShare(id){
  const t=state.trainings.find(x=>x.id===id);if(!t)return;
  $('#shareTrainingTitle').textContent=t.name||'Entrenamiento';
  $('#trainingPreview').value=buildTrainingText(t);
  $('#trainingShareDialog').showModal()
}
$$('.close-share').forEach(b=>b.onclick=()=>$('#trainingShareDialog').close());
$('#trainingSend').onclick=()=>{
  const texto=$('#trainingPreview').value.trim();
  if(!texto){showToast('El mensaje está vacío.');return}
  window.open('https://wa.me/?text='+encodeURIComponent(texto),'_blank','noopener')
};
$('#trainingCopy').onclick=async()=>{
  try{await navigator.clipboard.writeText($('#trainingPreview').value);showToast('Mensaje copiado')}
  catch(e){$('#trainingPreview').select();showToast('Pulsa Ctrl+C para copiar el mensaje',3000)}
};
$('#trainingSearch').oninput=renderTrainings;
$('#newTraining').onclick=()=>openTraining();

/* ===== Modo LIVE: partido en directo, minutos por jugador y acciones rápidas =====
   El cronómetro solo corre en el dispositivo que pulsa Iniciar/Reanudar (el
   "cronometrador"); al recargar queda en pausa (normalizeState pone running=false)
   para no contar tiempo fantasma ni chocar entre dispositivos. Cada segundo se suma
   1 s a los jugadores propios que están en el campo, así que una sustitución hace
   que empiece a contar el que entra. Para no saturar la nube, el reloj sincroniza
   cada ~20 s y de inmediato en cada acción (gol, evento, cambio, cambio de parte…). */
const LIVE_EVENTS=[
  {t:'recovery',label:'Recuperación',ic:'🔵'},
  {t:'loss',label:'Pérdida',ic:'🔴'},
  {t:'dribble_ok',label:'Regate ✓',ic:'💫'},
  {t:'dribble_ko',label:'Regate ✗',ic:'⛔'},
  {t:'shot',label:'Tiro',ic:'🎯'},
  {t:'foul_won',label:'Falta recibida',ic:'🟢'},
  {t:'foul_made',label:'Falta cometida',ic:'🟠'},
  {t:'save',label:'Parada',ic:'🧤'},
  {t:'yellow',label:'T. amarilla',ic:'🟨'},
  {t:'red',label:'T. roja',ic:'🟥'}
];
const EVENT_LABEL=Object.fromEntries(LIVE_EVENTS.map(e=>[e.t,e.label]));
const EVENT_IC=Object.fromEntries(LIVE_EVENTS.map(e=>[e.t,e.ic]));
const HALF_NAMES=['1ª parte','2ª parte','Prórroga 1','Prórroga 2','Prórroga 3'];
const halfName=h=>HALF_NAMES[h-1]||('Parte '+h);
const fmtClock=sec=>`${String(Math.floor(sec/60)).padStart(2,'0')}:${String(sec%60).padStart(2,'0')}`;
function liveMinute(){const L=state.live;if(!L.started)return null;return (L.half-1)*L.halfLength+Math.floor(L.elapsed/60)+1}

let liveInterval=null,isTimekeeper=false,liveSaveCount=0;
function liveStartTicking(){isTimekeeper=true;if(!liveInterval)liveInterval=setInterval(liveTick,1000)}
function liveStopTicking(){if(liveInterval){clearInterval(liveInterval);liveInterval=null}}
function liveTick(){
  const L=state.live;
  if(!L.running){liveStopTicking();return}
  L.elapsed++;
  tactic().placed.forEach(pp=>{L.minutes[pp.playerId]=(L.minutes[pp.playerId]||0)+1});
  updateLiveClockDOM();updateLiveMinutesDOM();
  if(++liveSaveCount>=20){liveSaveCount=0;persist()}
}
function updateLiveClockDOM(){const c=$('#liveClock');if(!c)return;c.textContent=fmtClock(state.live.elapsed);const ov=$('#liveOver');if(ov){const reg=state.live.halfLength*60;ov.textContent=state.live.elapsed>reg?`+${Math.floor((state.live.elapsed-reg)/60)}′`:''}}
function updateLiveMinutesDOM(){$$('#pitchPlayers .live-min').forEach(u=>{u.textContent=Math.floor((state.live.minutes[u.dataset.min]||0)/60)+'′'})}

function liveStart(){
  const L=state.live;
  if(!tactic().placed.length&&!confirm('No hay jugadores en el campo. Los minutos no contarán hasta que coloques a tu equipo. ¿Empezar igualmente?'))return;
  L.started=true;L.finished=false;L.running=true;L.half=1;L.elapsed=0;L.minutes={};L.events=[];
  liveSaveCount=0;persist();renderBoard();liveStartTicking();showToast('¡Partido en marcha!')
}
function livePause(){state.live.running=false;liveStopTicking();persist();renderLive()}
function liveResume(){state.live.running=true;persist();renderLive();liveStartTicking()}
function liveEndHalf(){const L=state.live;L.running=false;liveStopTicking();const fin=halfName(L.half);L.half++;L.elapsed=0;liveSaveCount=0;persist();renderBoard();showToast('Fin de la '+fin)}
function liveFinish(){const L=state.live;L.running=false;L.finished=true;liveStopTicking();persist();renderBoard();openReport()}
function liveReset(){
  if(!confirm('¿Reiniciar el partido en directo? Se borran el cronómetro, los minutos y los eventos. Los goles del marcador se mantienen.'))return;
  state.live={started:false,finished:false,running:false,half:1,halfLength:state.live.halfLength||45,elapsed:0,minutes:{},events:[]};
  liveStopTicking();persist();renderBoard()
}
function setHalfLength(m){state.live.halfLength=m;persist();renderLive()}

function renderLive(){
  const bar=$('#liveBar');if(!bar)return;
  const L=state.live;
  const lengths=[45,40,35,30,25];
  const lenChips=`<div class="live-lens">${lengths.map(m=>`<button type="button" class="live-len ${L.halfLength===m?'on':''}" data-len="${m}">${m}′</button>`).join('')}</div>`;
  let html;
  if(!L.started){
    html=`<div class="live-setup"><div class="live-setup-info"><span class="live-eyebrow">MODO EN DIRECTO</span><small>Cuenta los minutos de cada jugador y registra las acciones del partido. Elige la duración de cada parte:</small>${lenChips}</div><button type="button" class="btn-live-start" id="liveStart">▶ INICIAR PARTIDO</button></div>`;
  }else{
    const reg=L.halfLength*60,over=L.elapsed>reg?`+${Math.floor((L.elapsed-reg)/60)}′`:'';
    const clock=`<div class="live-clock-wrap"><span class="live-dot ${L.running?'on':''}"></span><div><b class="live-clock" id="liveClock">${fmtClock(L.elapsed)}</b><span class="live-over" id="liveOver">${over}</span><small class="live-half">${L.finished?'Final del partido':halfName(L.half)}</small></div></div>`;
    let controls='';
    if(L.finished){
      controls=`<button type="button" class="btn secondary" id="liveReport">📄 Informe</button><button type="button" class="btn secondary" id="liveReset">↺ Nuevo partido</button>`;
    }else if(L.running){
      controls=`<button type="button" class="btn secondary" id="livePause">⏸ Pausa</button><button type="button" class="btn secondary" id="liveEndHalf">⏹ Fin de parte</button><button type="button" class="btn secondary" id="liveReport">📄 Informe</button><button type="button" class="btn primary" id="liveFinish">Finalizar</button>`;
    }else{
      const resumeLabel=L.elapsed===0?('▶ Iniciar '+halfName(L.half)):'▶ Reanudar';
      controls=`${L.elapsed===0?lenChips:''}<button type="button" class="btn primary" id="liveResume">${resumeLabel}</button><button type="button" class="btn secondary" id="liveReport">📄 Informe</button><button type="button" class="btn secondary" id="liveFinish">Finalizar</button>`;
    }
    html=`<div class="live-run">${clock}<div class="live-controls">${controls}</div></div>`;
  }
  bar.className='live-bar'+(L.started&&L.running?' running':'');
  bar.innerHTML=html;
  $$('#liveBar .live-len').forEach(b=>b.onclick=()=>setHalfLength(+b.dataset.len));
  const bind=(id,fn)=>{const el=$('#'+id);if(el)el.onclick=fn};
  bind('liveStart',liveStart);bind('livePause',livePause);bind('liveResume',liveResume);
  bind('liveEndHalf',liveEndHalf);bind('liveFinish',liveFinish);bind('liveReset',liveReset);bind('liveReport',openReport);
  // Si el partido sigue en marcha y este dispositivo es el cronometrador, mantener el tick tras cada re-render.
  if(L.started&&L.running&&isTimekeeper)liveStartTicking()
}

function logEvent(type,id,team){
  const L=state.live;if(!L.started||L.finished)return;
  L.events.push({id:'e'+Date.now()+Math.random().toString(36).slice(2,5),type,playerId:id,team,half:L.half,min:liveMinute()});
  persist();
  const p=(team==='rival'?state.rivals:state.players).find(x=>x.id===id);
  showToast(`${EVENT_IC[type]||''} ${EVENT_LABEL[type]||type} · ${p?p.name.split(' ')[0]:''} ${liveMinute()}′`,1400)
}

/* ===== Informe del partido ===== */
function buildReport(){
  const g=state.match.goals||[],L=state.live;
  const own=g.filter(x=>x.team==='own').length,riv=g.filter(x=>x.team==='rival').length;
  const nameOf=(team,pid)=>{const p=(team==='rival'?state.rivals:state.players).find(x=>x.id===pid);return p?p.name:'—'};
  const goals=g.slice().sort((a,b)=>(a.min||999)-(b.min||999));
  const ids=new Set(Object.keys(L.minutes).filter(id=>(L.minutes[id]||0)>0));
  tactic().placed.forEach(pp=>ids.add(pp.playerId));
  const minutes=[...ids].map(id=>({id,name:nameOf('own',id),secs:L.minutes[id]||0})).filter(x=>x.name!=='—').sort((a,b)=>b.secs-a.secs);
  const evBy={};
  L.events.filter(e=>e.type!=='sub'&&e.team==='own').forEach(e=>{const m=evBy[e.playerId]||(evBy[e.playerId]={});m[e.type]=(m[e.type]||0)+1});
  const subs=L.events.filter(e=>e.type==='sub').sort((a,b)=>(a.min||0)-(b.min||0));
  return {own,riv,goals,nameOf,minutes,evBy,subs}
}
function reportHTML(r){
  const L=state.live;
  const status=L.finished?'Final del partido':(L.started?halfName(L.half)+' · '+fmtClock(L.elapsed):'Partido sin iniciar');
  const goalLines=r.goals.length?r.goals.map(x=>{
    const s=esc(r.nameOf(x.team,x.scorerId)),a=x.assistId?` <i>(asist. ${esc(r.nameOf(x.team,x.assistId))})</i>`:'';
    return `<li><span class="r-min">${x.min?x.min+'′':'–'}</span><span class="r-side ${x.team}"></span>⚽ <strong>${s}</strong>${a}</li>`
  }).join(''):'<li class="tr-empty">Sin goles registrados.</li>';
  const minLines=r.minutes.length?r.minutes.map(m=>`<li><strong>${esc(m.name)}</strong><span class="r-min-val">${Math.floor(m.secs/60)}′</span></li>`).join(''):'<li class="tr-empty">Sin minutos registrados.</li>';
  const evTypes=LIVE_EVENTS.map(e=>e.t);
  const evRows=Object.keys(r.evBy).map(id=>{
    const c=r.evBy[id],chips=evTypes.filter(t=>c[t]).map(t=>`<span class="r-ev">${EVENT_IC[t]} ${c[t]}</span>`).join('');
    return `<li><strong>${esc(r.nameOf('own',id))}</strong><div class="r-evs">${chips}</div></li>`
  }).join('')||'<li class="tr-empty">Sin acciones registradas.</li>';
  const subLines=r.subs.length?`<div class="r-block"><h4>Cambios</h4><ul class="r-list">${r.subs.map(s=>`<li><span class="r-min">${s.min?s.min+'′':'–'}</span>▶ <strong>${esc(r.nameOf('own',s.inId))}</strong> ◀ ${esc(r.nameOf('own',s.outId))}</li>`).join('')}</ul></div>`:'';
  return `<div class="r-score"><span>${esc(state.club||'Equipo')}</span><b>${r.own} – ${r.riv}</b><span>${esc(state.match.opponent||'Rival')}</span></div>
    <div class="r-status">${status}</div>
    <div class="r-block"><h4>Goles</h4><ul class="r-list r-goals">${goalLines}</ul></div>
    <div class="r-block"><h4>Minutos jugados</h4><ul class="r-list r-minutes">${minLines}</ul></div>
    <div class="r-block"><h4>Acciones por jugador</h4><ul class="r-list r-events">${evRows}</ul></div>
    ${subLines}`
}
function reportText(r){
  const L=state.live,lin=[];
  lin.push(`*${(state.club||'Equipo').toUpperCase()}* ${r.own}-${r.riv} *${(state.match.opponent||'RIVAL').toUpperCase()}*`);
  const st=L.finished?'Final del partido':(L.started?halfName(L.half)+' · '+fmtClock(L.elapsed):'');
  if(st)lin.push(st);
  if(r.goals.length){lin.push('','*GOLES*');r.goals.forEach(x=>{const a=x.assistId?` (asist. ${r.nameOf(x.team,x.assistId)})`:'';lin.push(`${x.min?x.min+"' ":''}${x.team==='rival'?'[R] ':''}${r.nameOf(x.team,x.scorerId)}${a}`)})}
  if(r.minutes.length){lin.push('','*MINUTOS*');r.minutes.forEach(m=>lin.push(`${Math.floor(m.secs/60)}' · ${m.name}`))}
  const evIds=Object.keys(r.evBy);
  if(evIds.length){lin.push('','*ACCIONES*');evIds.forEach(id=>{const c=r.evBy[id],parts=LIVE_EVENTS.filter(e=>c[e.t]).map(e=>`${e.label} ${c[e.t]}`);lin.push(`${r.nameOf('own',id)}: ${parts.join(', ')}`)})}
  if(r.subs.length){lin.push('','*CAMBIOS*');r.subs.forEach(s=>lin.push(`${s.min?s.min+"' ":''}Entra ${r.nameOf('own',s.inId)}, sale ${r.nameOf('own',s.outId)}`))}
  return lin.join('\n')
}
function openReport(){
  const r=buildReport();
  $('#reportBody').innerHTML=reportHTML(r);
  $('#reportDialog').dataset.text=reportText(r);
  $('#reportDialog').showModal()
}
$$('.close-report').forEach(b=>b.onclick=()=>$('#reportDialog').close());
$('#reportCopy').onclick=async()=>{try{await navigator.clipboard.writeText($('#reportDialog').dataset.text||'');showToast('Informe copiado')}catch(e){showToast('No se pudo copiar el informe',2500)}};
$('#reportSend').onclick=()=>{const t=$('#reportDialog').dataset.text||'';if(!t)return;window.open('https://wa.me/?text='+encodeURIComponent(t),'_blank','noopener')};
// Al cerrar la pestaña, guardar en local el último estado del cronómetro.
window.addEventListener('beforeunload',()=>{try{localStorage.setItem(storageKey(),JSON.stringify(state))}catch(e){}});

// Primera pintada: aquí ya están definidas todas las constantes (incluidas las del
// modo live), así que es seguro aunque se recupere un partido guardado a medias.
renderAll();

/* ===== Sincronización en la nube (Firebase Firestore) ===== */
const FIREBASE_CONFIG={apiKey:'AIzaSyBrysK7UDFDW_XpY1tSFnrQSX9rD8mbrrQ',authDomain:'pizarra-tamara-2026.firebaseapp.com',projectId:'pizarra-tamara-2026',storageBucket:'pizarra-tamara-2026.firebasestorage.app',messagingSenderId:'886197824457',appId:'1:886197824457:web:4beab9509451daac1c9618'};
const CLIENT_ID='c'+Math.random().toString(36).slice(2)+Date.now().toString(36);
let db=null,boardRef=null,keyHash='',saveTimer=null,unsubscribe=null;
try{
  if(typeof firebase!=='undefined'&&FIREBASE_CONFIG.projectId!=='__PROJECT'+'_ID__'){
    firebase.initializeApp(FIREBASE_CONFIG);
    db=firebase.firestore();
    db.enablePersistence({synchronizeTabs:true}).catch(()=>{});
  }
}catch(e){console.warn('Firebase no disponible:',e)}
async function sha256hex(text){
  if(crypto&&crypto.subtle){
    const buf=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text));
    return [...new Uint8Array(buf)].map(b=>b.toString(16).padStart(2,'0')).join('')
  }
  // Fallback determinista (solo para abrir el archivo en local sin HTTPS)
  let out='';for(let s=0;s<4;s++){let h=0x811c9dc5^s;for(let i=0;i<text.length;i++){h^=text.charCodeAt(i);h=Math.imul(h,0x01000193)}out+=(h>>>0).toString(16).padStart(8,'0')}
  return out
}
function setSync(ok,label){const dot=$('#syncDot'),lab=$('#syncLabel');if(!dot)return;dot.style.background=ok?'var(--green)':'var(--amber)';lab.textContent=label||(ok?'Sincronizado':'Sin conexión');$('.saved-status').classList.toggle('warn',!ok)}
// Firestore rechaza documentos de más de 1 MB y las reglas cortan en 950.000.
// Las fotos van incrustadas en el JSON, así que el aviso tiene que ser visible:
// si no, los cambios dejarían de subir a la nube en silencio.
const CLOUD_LIMIT=900000;
// Cerrojo: no se escribe nada en la nube hasta que el servidor confirma qué hay
// en ella. Sin esto, abrir la app en un dispositivo nuevo y sin cobertura
// cargaba la plantilla de ejemplo y el primer cambio la subía ENCIMA de la
// plantilla real del usuario, borrándola para todos sus dispositivos.
let cloudReady=false,        // el servidor ya nos ha dicho qué hay en la nube
    localIsThisBoard=false,  // lo que se ve sale de la copia local de esta clave
    offlineWrite=false,      // hemos encolado cambios sin confirmación del servidor
    pendingSave=false;
function scheduleCloudSave(){
  if(!boardRef)return;
  // Sin confirmación del servidor solo se escribe si lo que hay en pantalla es
  // la copia local de ESTA pizarra. Si son los datos de ejemplo, subirlos
  // borraría la plantilla real, así que se espera. Con copia local sí se
  // escribe: es lo que permite seguir trabajando en el campo sin cobertura.
  if(!cloudReady&&!localIsThisBoard){pendingSave=true;return}
  if(!cloudReady)offlineWrite=true;
  clearTimeout(saveTimer);
  saveTimer=setTimeout(pushToCloud,600)
}
function pushToCloud(){
  const json=JSON.stringify(state);
  if(json.length>CLOUD_LIMIT){
    setSync(false,'Sin espacio en la nube');
    showToast('Los datos superan el límite de la nube y ya no se sincronizan. Elimina alguna foto de jugador.',6000);
    return
  }
  boardRef.set({data:json,writer:CLIENT_ID,updatedAt:firebase.firestore.FieldValue.serverTimestamp()})
    .then(()=>setSync(true))
    .catch(e=>{console.warn('Error al guardar en la nube:',e);setSync(false,'No se pudo guardar');showToast('No se han podido guardar los cambios en la nube. Revisa la conexión.',4000)})
}
function applyRemote(json){
  try{state=normalizeState(JSON.parse(json))}catch(e){return}
  localStorage.setItem(storageKey(),json);
  refreshMatchInputs();renderAll();setSync(true)
}
async function connectBoard(key){
  keyHash=await sha256hex('udt·pizarra·'+key);
  localStorage.setItem('udt-key',key);
  // Copia local de esta clave exactamente: la de STORAGE es la heredada de la
  // versión sin claves y puede ser de otra pizarra, así que no cuenta como tal.
  localIsThisBoard=!!localStorage.getItem(storageKey());
  const cached=localStorage.getItem(storageKey())||localStorage.getItem(STORAGE);
  state=normalizeState(cached?JSON.parse(cached):defaultState());
  refreshMatchInputs();renderAll();
  $('#authOverlay').classList.add('hidden');
  cloudReady=false;pendingSave=false;offlineWrite=false;clearTimeout(saveTimer);
  if(!db){setSync(false,'Solo local');return}
  if(unsubscribe)unsubscribe();
  boardRef=db.collection('pizarras').doc(keyHash);
  setSync(false,'Conectando…');
  unsubscribe=boardRef.onSnapshot(s=>{
    // fromCache = Firestore contesta de su memoria local, sin haber hablado con
    // el servidor. Mientras sea true no sabemos si la nube tiene datos, así que
    // no se toca: es justo el caso en el que antes se perdía la plantilla.
    if(s.metadata.fromCache)return;
    if(!cloudReady){
      cloudReady=true;
      const remoto=s.exists&&s.data().data;
      // Manda la nube, que es lo que ven los demás dispositivos, salvo que ya
      // hayamos escrito sin conexión: esos cambios van en camino y aplicar lo
      // remoto los desharía. Si la pizarra no existe todavía, subimos lo local.
      if(remoto&&!offlineWrite){applyRemote(remoto);pendingSave=false}
      else if(!remoto)pendingSave=true;
      offlineWrite=false;
      setSync(true);
      if(pendingSave){pendingSave=false;pushToCloud()}
      return
    }
    if(s.metadata.hasPendingWrites)return;
    // Si este dispositivo lleva el cronómetro en marcha, no se deja sobrescribir
    // por lo que llegue de otro: sus datos en directo mandan hasta pausar/finalizar.
    if(isTimekeeper&&state.live.running)return;
    const d=s.data();
    if(d.writer===CLIENT_ID||!d.data)return;
    applyRemote(d.data)
  },e=>{console.warn('Error de sincronización:',e);cloudReady=false;setSync(false,'Sin sincronizar')})
}
$('#authForm').onsubmit=async e=>{
  e.preventDefault();
  const k=$('#accessKey').value.trim();
  if(k.length<6){$('#authError').textContent='La clave debe tener al menos 6 caracteres.';return}
  $('#authError').textContent='';
  const btn=$('#enterBtn');btn.disabled=true;btn.textContent='Conectando…';
  await connectBoard(k);
  btn.disabled=false;btn.textContent='Entrar'
};
/* ===== Copia de seguridad manual ===== */
$('#exportBackup').onclick=()=>{
  const sello=new Date().toISOString().slice(0,16).replace(/[:T]/g,'-');
  const a=document.createElement('a'),url=URL.createObjectURL(new Blob([JSON.stringify(state)],{type:'application/json'}));
  a.href=url;a.download=`pizarra-${sello}.json`;a.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
  showToast('Copia descargada')
};
$('#importBackup').onclick=()=>$('#importFile').click();
$('#importFile').onchange=e=>{
  const f=e.target.files[0];if(!f)return;
  e.target.value='';
  const reader=new FileReader();
  reader.onload=ev=>{
    let copia;
    // normalizeState rellena huecos, así que un {} pasaría como copia válida:
    // hay que comprobar antes que el archivo tiene forma de pizarra.
    try{
      const bruto=JSON.parse(ev.target.result);
      if(!bruto||typeof bruto!=='object'||!Array.isArray(bruto.players))throw new Error('formato');
      copia=normalizeState(bruto)
    }catch(err){showToast('El archivo no es una copia de pizarra válida.',4000);return}
    if(!confirm(`Se sustituirá la pizarra actual por la copia:\n\n· ${copia.players.length} jugadores\n· ${copia.rivals.length} rivales\n· ${copia.tactics.length} variantes tácticas\n\nEsto también reemplazará los datos en la nube. ¿Continuar?`))return;
    state=copia;refreshMatchInputs();renderAll();persist(true)
  };
  reader.readAsText(f)
};
$('#changeKey').onclick=()=>{
  if(confirm('¿Cambiar de clave? Tus datos seguirán guardados en la nube bajo la clave actual.')){
    localStorage.removeItem('udt-key');location.reload()
  }
};
(function boot(){
  const k=localStorage.getItem('udt-key');
  if(k){$('#authOverlay').classList.add('hidden');connectBoard(k)}
})();
