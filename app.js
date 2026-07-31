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
  s.match.time ??= '';s.match.meet ??= '';s.match.notice ??= '';
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
function switchView(v){$$('.view,.nav-item').forEach(x=>x.classList.remove('active'));$(`#${v}View`).classList.add('active');$(`.nav-item[data-view="${v}"]`).classList.add('active');$('#pageTitle').textContent=v==='board'?'Pizarra táctica':v==='squad'?'Gestión de plantilla':'Análisis del rival';$('#sectionEyebrow').textContent=v==='board'?'PARTIDO · PLANIFICACIÓN':v==='squad'?'EQUIPO · TEMPORADA 2026/27':'SCOUTING · PRÓXIMO PARTIDO';$('.sidebar').classList.remove('open');renderAll()}
$$('.nav-item').forEach(b=>b.onclick=()=>switchView(b.dataset.view));$$('[data-go-squad]').forEach(b=>b.onclick=()=>switchView('squad'));$$('[data-go-rival]').forEach(b=>b.onclick=()=>switchView('rival'));$('.mobile-menu').onclick=()=>$('.sidebar').classList.toggle('open');
function renderTabs(){$('#tacticTabs').innerHTML=state.tactics.map((t,i)=>`<button class="tactic-tab ${t.id===state.activeTactic?'active':''}" data-id="${t.id}">${esc(t.name)}${state.tactics.length>1?`<span class="remove" data-remove="${t.id}">×</span>`:''}</button>`).join('');$$('.tactic-tab').forEach(b=>b.onclick=e=>{if(e.target.dataset.remove){e.stopPropagation();state.tactics=state.tactics.filter(t=>t.id!==e.target.dataset.remove);if(state.activeTactic===e.target.dataset.remove)state.activeTactic=state.tactics[0].id}else state.activeTactic=b.dataset.id;persist();renderAll()})}
$('#addTactic').onclick=()=>{const n=state.tactics.length+1,id='t'+Date.now();state.tactics.push({id,name:`Táctica ${n}`,formation:'4-3-3',placed:[],arrows:[]});state.activeTactic=id;persist();renderAll()};
function renderBench(){const placed=new Set(tactic().placed.map(x=>x.playerId));const available=state.players.filter(p=>!placed.has(p.id));$('#availableCount').textContent=available.length;$('#benchList').innerHTML=available.map(p=>`<button class="bench-player own-choice" data-id="${p.id}"><span class="bench-avatar" ${avatarStyle(p)}>${p.photo?'':esc(initials(p.name))}</span><p><strong>${esc(p.name)}</strong><small>${esc(p.position)} · ${esc(p.number)}</small></p><i class="status-dot ${p.status}"></i></button>`).join('')||'<p class="helper">Toda la plantilla está en el campo.</p>';$$('.own-choice').forEach(b=>b.onclick=()=>benchAction(b.dataset.id,'own'));}
function renderRivalBench(){const placed=new Set(tactic().opponentPlaced.map(x=>x.playerId)),available=state.rivals.filter(p=>!placed.has(p.id));$('#rivalAvailableCount').textContent=available.length;$('#rivalBenchList').innerHTML=available.map(p=>`<button class="bench-player rival-choice" data-id="${p.id}"><span class="bench-avatar" ${avatarStyle(p)}>${p.photo?'':esc(initials(p.name))}</span><p><strong>${esc(p.name)}</strong><small>${esc(p.position)} · ${esc(p.number)}</small></p></button>`).join('')||'<p class="helper">Todo el rival está en el campo.</p>';$$('.rival-choice').forEach(b=>b.onclick=()=>benchAction(b.dataset.id,'rival'))}
function benchAction(id,team){if(tool==='sub'){if(!substitutionPending){showToast('Primero selecciona quién sale del campo');return}if(substitutionPending.team!==team){showToast('Elige un jugador del mismo equipo');return}completeSubstitution(id);return}placePlayer(id,team)}
function placePlayer(id,team='own'){const t=tactic(),list=team==='rival'?t.opponentPlaced:t.placed,spots=formations[t.formation]||[];let pos=team==='rival'?[15+list.length%4*23,15+Math.floor(list.length/4)*12]:(spots[list.length]||[50,50]);list.push({playerId:id,x:pos[0],y:pos[1]});persist();renderBoard()}
function renderPitch(){const t=tactic();$('#formation').value=t.formation;const own=t.placed.map(pp=>playerHTML(pp,state.players,'own')).join(''),rival=t.opponentPlaced.map(pp=>playerHTML(pp,state.rivals,'rival')).join('');$('#pitchPlayers').innerHTML=own+rival;$('#pitchHint').style.display=(t.placed.length+t.opponentPlaced.length)?'none':'block';$$('.pitch-player').forEach(el=>el.onpointerdown=startPlayerDrag);renderArrows()}
function playerHTML(pp,roster,team){const p=roster.find(x=>x.id===pp.playerId);if(!p)return'';const marked=tactic().highlighted.includes(team+':'+p.id),selected=substitutionPending&&substitutionPending.team===team&&substitutionPending.id===p.id;const rivalStyle=team==='rival'?`--rival-primary:${state.rivalColors.primary};--rival-secondary:${state.rivalColors.secondary}`:'';return `<div class="pitch-player ${team==='rival'?'rival':''} ${marked?'highlighted':''} ${selected?'sub-selected':''}" data-id="${p.id}" data-team="${team}" style="left:${pp.x}%;top:${pp.y}%;${rivalStyle}"><div class="player-token" ${avatarStyle(p)}>${p.photo?'':esc(initials(p.name))}<b>${esc(p.number||'-')}</b></div><small>${esc(p.name.split(' ')[0])}</small></div>`}
function startPlayerDrag(e){const el=e.currentTarget,id=el.dataset.id,team=el.dataset.team,key=team+':'+id;if(tool==='highlight'){e.preventDefault();const h=tactic().highlighted,i=h.indexOf(key);i>=0?h.splice(i,1):h.push(key);persist();renderPitch();return}if(tool==='sub'){e.preventDefault();substitutionPending={id,team};renderPitch();showToast('Ahora selecciona quién entra desde el banquillo',2000);return}if(tool==='remove'){e.preventDefault();removePlayerFromPitch(id,team);return}if(tool!=='move')return;e.preventDefault();const pitch=$('#pitch'),list=team==='rival'?tactic().opponentPlaced:tactic().placed,pp=list.find(x=>x.playerId===id);el.setPointerCapture(e.pointerId);el.onpointermove=ev=>{const r=pitch.getBoundingClientRect();pp.x=Math.max(3,Math.min(97,(ev.clientX-r.left)/r.width*100));pp.y=Math.max(3,Math.min(97,(ev.clientY-r.top)/r.height*100));el.style.left=pp.x+'%';el.style.top=pp.y+'%'};el.onpointerup=()=>{el.onpointermove=null;persist();renderBench();renderRivalBench()}}
function completeSubstitution(inId){const t=tactic(),list=substitutionPending.team==='rival'?t.opponentPlaced:t.placed,spot=list.find(x=>x.playerId===substitutionPending.id);if(!spot)return;const outId=spot.playerId;spot.playerId=inId;t.substitutions.push({x:spot.x,y:spot.y,team:substitutionPending.team,outId,inId});substitutionPending=null;persist();renderBoard();showToast('Cambio realizado')}
function removePlayerFromPitch(id,team){const t=tactic(),key=team+':'+id;if(team==='rival')t.opponentPlaced=t.opponentPlaced.filter(x=>x.playerId!==id);else t.placed=t.placed.filter(x=>x.playerId!==id);t.highlighted=t.highlighted.filter(x=>x!==key);persist();renderBoard()}
function renderArrows(){const t=tactic();$('#arrows').innerHTML=t.arrows.map(a=>a.curve?`<path d="M ${a.x1} ${a.y1} Q ${a.cx} ${a.cy} ${a.x2} ${a.y2}"/>`:`<path d="M ${a.x1} ${a.y1} L ${a.x2} ${a.y2}"/>`).join('');$('#graphics').innerHTML=t.graphics.map(g=>g.type==='circle'?`<circle cx="${g.cx}" cy="${g.cy}" r="${g.r}"/>`:`<path d="${g.d}"/>`).join('');$('#textLayer').innerHTML=t.labels.map((l,i)=>`<span class="pitch-text" data-label="${i}" style="left:${l.x}%;top:${l.y}%">${esc(l.text)}</span>`).join('');$('#substitutionLayer').innerHTML=t.substitutions.map((s,i)=>`<span class="sub-badge" data-sub="${i}" style="left:${s.x}%;top:${s.y}%"><i class="in">↗</i><i class="out">↙</i></span>`).join('');$$('[data-label]').forEach(x=>x.onclick=()=>{if(tool==='remove'){t.labels.splice(+x.dataset.label,1);persist();renderArrows()}});$$('[data-sub]').forEach(x=>x.onclick=()=>{if(tool==='remove'){t.substitutions.splice(+x.dataset.sub,1);persist();renderArrows()}})}
$('#pitch').onpointerdown=e=>{if(!['arrow','curve','circle','pen','text','remove'].includes(tool)||e.target.closest('.pitch-player,.pitch-text,.sub-badge'))return;const r=$('#pitch').getBoundingClientRect(),x=(e.clientX-r.left)/r.width*1000,y=(e.clientY-r.top)/r.height*1400;if(tool==='remove'){removeNearestAnnotation(x,y);return}if(tool==='text'){const value=prompt('Escribe la indicación:');if(value){tactic().labels.push({text:value.slice(0,60),x:x/10,y:y/14});persist();renderArrows()}return}drawing={x1:x,y1:y,x2:x,y2:y,points:[[x,y]]};$('#pitch').setPointerCapture(e.pointerId)};
function removeNearestAnnotation(x,y){const t=tactic(),candidates=[];t.arrows.forEach((a,i)=>candidates.push({kind:'arrows',i,d:Math.hypot(x-(a.x1+a.x2)/2,y-(a.y1+a.y2)/2)}));t.graphics.forEach((g,i)=>{let gx=g.cx,gy=g.cy;if(g.type==='pen'){const nums=(g.d.match(/[\d.]+/g)||[]).map(Number);gx=nums[nums.length-2];gy=nums[nums.length-1]}candidates.push({kind:'graphics',i,d:Math.hypot(x-gx,y-gy)})});t.labels.forEach((l,i)=>candidates.push({kind:'labels',i,d:Math.hypot(x-l.x*10,y-l.y*14)}));t.substitutions.forEach((s,i)=>candidates.push({kind:'substitutions',i,d:Math.hypot(x-s.x*10,y-s.y*14)}));const nearest=candidates.sort((a,b)=>a.d-b.d)[0];if(nearest&&nearest.d<180){t[nearest.kind].splice(nearest.i,1);persist();renderArrows()}}
$('#pitch').onpointermove=e=>{if(!drawing)return;const r=$('#pitch').getBoundingClientRect();drawing.x2=(e.clientX-r.left)/r.width*1000;drawing.y2=(e.clientY-r.top)/r.height*1400;if(tool==='pen')drawing.points.push([drawing.x2,drawing.y2]);let d;if(tool==='circle'){const radius=Math.hypot(drawing.x2-drawing.x1,drawing.y2-drawing.y1);d=`M ${drawing.x1-radius} ${drawing.y1} a ${radius} ${radius} 0 1 0 ${radius*2} 0 a ${radius} ${radius} 0 1 0 ${-radius*2} 0`}else if(tool==='pen')d='M '+drawing.points.map(p=>p.join(' ')).join(' L ');else d=tool==='curve'?`M ${drawing.x1} ${drawing.y1} Q ${drawing.x1+(drawing.x2-drawing.x1)*.65} ${drawing.y1-(Math.abs(drawing.x2-drawing.x1)*.45+70)} ${drawing.x2} ${drawing.y2}`:`M ${drawing.x1} ${drawing.y1} L ${drawing.x2} ${drawing.y2}`;$('#draftArrow').setAttribute('d',d)};
$('#pitch').onpointerup=()=>{if(!drawing)return;const distance=Math.hypot(drawing.x2-drawing.x1,drawing.y2-drawing.y1);if(distance>20){if(tool==='circle')tactic().graphics.push({type:'circle',cx:drawing.x1,cy:drawing.y1,r:distance});else if(tool==='pen')tactic().graphics.push({type:'pen',d:'M '+drawing.points.map(p=>p.join(' ')).join(' L ')});else{if(tool==='curve'){drawing.curve=true;drawing.cx=drawing.x1+(drawing.x2-drawing.x1)*.65;drawing.cy=drawing.y1-(Math.abs(drawing.x2-drawing.x1)*.45+70)}tactic().arrows.push(drawing)}}drawing=null;$('#draftArrow').setAttribute('d','');persist();renderArrows()};
$$('.tool[data-tool]').forEach(b=>b.onclick=()=>{tool=b.dataset.tool;if(tool!=='sub')substitutionPending=null;$$('.tool[data-tool]').forEach(x=>x.classList.toggle('active',x===b));renderPitch()});$('#clearArrows').onclick=()=>{const t=tactic();t.arrows=[];t.graphics=[];t.labels=[];t.highlighted=[];t.substitutions=[];persist();renderBoard()};$('#clearPitch').onclick=()=>{tactic().placed=[];tactic().opponentPlaced=[];substitutionPending=null;persist();renderBoard()};
$('#formation').onchange=e=>{const t=tactic();t.formation=e.target.value;const spots=formations[t.formation];if(spots)t.placed.forEach((p,i)=>{if(spots[i]){p.x=spots[i][0];p.y=spots[i][1]}});persist();renderPitch()};
function renderBoard(){renderTabs();renderBench();renderRivalBench();renderPitch()}
function renderSquad(){const q=$('#playerSearch').value.toLowerCase(),filter=$('#statusFilter').value;const list=state.players.filter(p=>(filter==='all'||p.status===filter)&&(p.name+' '+p.position).toLowerCase().includes(q));$('#playerGrid').innerHTML=list.map(p=>`<article class="player-card"><div class="player-card-top"><div class="card-avatar" ${avatarStyle(p)}>${p.photo?'':esc(initials(p.name))}</div><div><h3>${esc(p.name)}</h3><span class="role">${esc(p.position)}</span><br><span class="status-tag"><i class="${p.status}"></i>${statusText[p.status]}</span></div><span class="number">${esc(p.number||'—')}</span></div><p class="notes">${esc(p.notes)||'Sin notas añadidas.'}</p><div class="card-actions"><button data-edit="${p.id}">Editar ficha</button><button class="delete" data-delete="${p.id}">×</button></div></article>`).join('')||'<p>No se encontraron jugadores.</p>';$('#totalPlayers').textContent=state.players.length;$('#fitPlayers').textContent=state.players.filter(p=>p.status==='available').length;$('#doubtPlayers').textContent=state.players.filter(p=>p.status==='doubt').length;$('#outPlayers').textContent=state.players.filter(p=>['injured','suspended'].includes(p.status)).length;$('#squadCount').textContent=state.players.length;$$('[data-edit]').forEach(b=>b.onclick=()=>openPlayer(b.dataset.edit));$$('[data-delete]').forEach(b=>b.onclick=()=>{if(confirm('¿Eliminar este jugador de la plantilla?')){state.players=state.players.filter(p=>p.id!==b.dataset.delete);state.tactics.forEach(t=>t.placed=t.placed.filter(x=>x.playerId!==b.dataset.delete));persist();renderAll()}})}
$('#playerSearch').oninput=renderSquad;$('#statusFilter').onchange=renderSquad;$('#newPlayer').onclick=()=>openPlayer();
function renderRivals(){const q=$('#rivalSearch').value.toLowerCase();$('#rivalTeamName').textContent=state.match.opponent||'Equipo rival';const list=state.rivals.filter(p=>(p.name+' '+p.position).toLowerCase().includes(q));$('#rivalGrid').innerHTML=list.map(p=>`<article class="player-card"><div class="player-card-top"><div class="card-avatar" ${avatarStyle(p)}>${p.photo?'':esc(initials(p.name))}</div><div><h3>${esc(p.name)}</h3><span class="role">${esc(p.position)}</span></div><span class="number">${esc(p.number||'—')}</span></div><p class="notes">${esc(p.notes)||'Sin notas de scouting.'}</p><div class="card-actions"><button data-rival-edit="${p.id}">Editar ficha</button><button class="delete" data-rival-delete="${p.id}">×</button></div></article>`).join('')||'<p>No se encontraron jugadores rivales.</p>';$('#rivalCount').textContent=state.rivals.length;$$('[data-rival-edit]').forEach(b=>b.onclick=()=>openPlayer(b.dataset.rivalEdit,'rival'));$$('[data-rival-delete]').forEach(b=>b.onclick=()=>{if(confirm('¿Eliminar este jugador rival?')){state.rivals=state.rivals.filter(p=>p.id!==b.dataset.rivalDelete);state.tactics.forEach(t=>t.opponentPlaced=t.opponentPlaced.filter(x=>x.playerId!==b.dataset.rivalDelete));persist();renderAll()}})}
$('#rivalSearch').oninput=renderRivals;$('#newRival').onclick=()=>openPlayer(null,'rival');
function openPlayer(id=null,type='own'){editingId=id;$('#rosterType').value=type;const roster=type==='rival'?state.rivals:state.players;const p=roster.find(x=>x.id===id)||{name:'',number:'',position:'Portero',status:'available',notes:'',photo:''};$('#modalTitle').textContent=id?(type==='rival'?'Editar rival':'Editar jugador'):(type==='rival'?'Nuevo jugador rival':'Nuevo jugador');$('#playerName').value=p.name;$('#playerNumber').value=p.number;$('#playerPosition').value=p.position;$('#playerStatus').value=p.status;$('#playerNotes').value=p.notes;photoData=p.photo||'';updatePhoto(p.name);$('#playerDialog').showModal()}
function updatePhoto(name=''){$('#photoPreview').src=photoData;$('#photoPreview').style.display=photoData?'block':'none';$('#photoInitials').style.display=photoData?'none':'block';$('#photoInitials').textContent=name?initials(name):'+'}
$('#playerName').oninput=e=>updatePhoto(e.target.value);$('#photoInput').onchange=e=>{const f=e.target.files[0];if(!f)return;const reader=new FileReader();reader.onload=ev=>{const img=new Image();img.onload=()=>{const max=300,ratio=Math.min(1,max/Math.max(img.width,img.height)),c=document.createElement('canvas');c.width=Math.max(1,Math.round(img.width*ratio));c.height=Math.max(1,Math.round(img.height*ratio));const ctx=c.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,c.width,c.height);ctx.drawImage(img,0,0,c.width,c.height);photoData=c.toDataURL('image/jpeg',.78);updatePhoto($('#playerName').value)};img.src=ev.target.result};reader.readAsDataURL(f)};$$('.close').forEach(b=>b.onclick=()=>$('#playerDialog').close());
$('#playerForm').onsubmit=e=>{e.preventDefault();const type=$('#rosterType').value,roster=type==='rival'?state.rivals:state.players;const obj={id:editingId||(type==='rival'?'r':'p')+Date.now(),name:$('#playerName').value.trim(),number:Number($('#playerNumber').value)||'',position:$('#playerPosition').value,status:$('#playerStatus').value,notes:$('#playerNotes').value.trim(),photo:photoData};if(!obj.name)return;if(editingId)Object.assign(roster.find(p=>p.id===editingId),obj);else roster.push(obj);$('#playerDialog').close();persist(true);renderAll()};
const MATCH_FIELDS={opponent:'opponent',competition:'competition',matchDate:'date',matchTime:'time',venue:'venue'};
function refreshMatchInputs(){Object.entries(MATCH_FIELDS).forEach(([id,k])=>{$('#'+id).value=state.match[k]||''});$('#rivalPrimary').value=state.rivalColors.primary;$('#rivalSecondary').value=state.rivalColors.secondary}
Object.entries(MATCH_FIELDS).forEach(([id,k])=>{$('#'+id).onchange=e=>{state.match[k]=e.target.value;persist()}});
['rivalPrimary','rivalSecondary'].forEach(id=>$('#'+id).oninput=e=>{state.rivalColors[id==='rivalPrimary'?'primary':'secondary']=e.target.value;persist();renderPitch()});
refreshMatchInputs();
$('#saveBtn').onclick=()=>persist(true);$('#printBtn').onclick=()=>{document.body.classList.add('export-all');window.print();setTimeout(()=>document.body.classList.remove('export-all'),500)};window.onafterprint=()=>document.body.classList.remove('export-all');
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
  persist();refreshCallPreview()
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
function renderAll(){renderBoard();renderSquad();renderRivals()}renderAll();

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
