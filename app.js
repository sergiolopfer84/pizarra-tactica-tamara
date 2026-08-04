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
/* ===== Zonas del campo: rejilla 3×3 =====
   Siempre relativa al equipo propio: def_* junto a la portería propia, ata_*
   junto a la rival, e izquierda/derecha desde la perspectiva del equipo propio
   atacando. El cambio de campo del descanso NO afecta al dato: el entrenador ve
   siempre el mismo campo. Los ids internos son estables y no deben cambiarse;
   las etiquetas cortas sí son configurables aquí. */
const ZONAS=['ata_izq','ata_cen','ata_der','med_izq','med_cen','med_der','def_izq','def_cen','def_der']; // orden de pintado: ataque arriba
const ZONA_ETI={def_izq:'DFI',def_cen:'DFC',def_der:'DFD',med_izq:'MCI',med_cen:'MCC',med_der:'MCD',ata_izq:'DLI',ata_cen:'DLC',ata_der:'DLD'};
const ZONA_NOM={def_izq:'Defensa · izquierda',def_cen:'Defensa · centro',def_der:'Defensa · derecha',med_izq:'Medio · izquierda',med_cen:'Medio · centro',med_der:'Medio · derecha',ata_izq:'Ataque · izquierda',ata_cen:'Ataque · centro',ata_der:'Ataque · derecha'};
const FRANJA_NOM={def:'inicio de juego',med:'zona media',ata:'campo rival'};
const zonaFranja=z=>z?z.slice(0,3):null;

/* ===== Catálogo de eventos =====
   Los cuatro primeros de cada pestaña son los originales (los más frecuentes),
   por eso encabezan la lista. `zona:false` guarda directamente, sin preguntar.
   Los tipos en inglés son los de la versión anterior y se traducen al cargar. */
const EVENTOS=[
  {t:'regate_ok',     n:'Regate exitoso',              ic:'💫', g:'of',  zona:true},
  {t:'regate_fallo',  n:'Regate fallido',              ic:'⛔', g:'of',  zona:true},
  {t:'gol',           n:'Gol',                         ic:'⚽', g:'of',  zona:true},
  {t:'asistencia',    n:'Asistencia',                  ic:'🤝', g:'of',  zona:true},
  {t:'tiro_puerta',   n:'Tiro a puerta',               ic:'🎯', g:'of',  zona:true, ayuda:'Solo ocasión clara de gol'},
  {t:'centro_remate', n:'Centro que acaba en remate',  ic:'📤', g:'of',  zona:true, ayuda:'Carril de origen'},
  {t:'profundidad',   n:'Ataque a la profundidad',     ic:'🏃', g:'of',  zona:true},
  {t:'foul_won',      n:'Falta recibida',              ic:'🟢', g:'of',  zona:false},
  {t:'recuperacion',  n:'Recuperación de balón',       ic:'🔵', g:'def', zona:true},
  {t:'perdida',       n:'Pérdida de balón',            ic:'🔴', g:'def', zona:true},
  {t:'pase_fallido',  n:'Pase fallido',                ic:'❌', g:'def', zona:true},
  {t:'error_despeje', n:'Error en despeje',            ic:'🧱', g:'def', zona:true},
  {t:'foul_made',     n:'Falta cometida',              ic:'🟠', g:'def', zona:false},
  {t:'save',          n:'Parada',                      ic:'🧤', g:'def', zona:false},
  {t:'yellow',        n:'Tarjeta amarilla',            ic:'🟨', g:'def', zona:false},
  {t:'red',           n:'Tarjeta roja',                ic:'🟥', g:'def', zona:false}
];
// Eventos de equipo: no cuelgan de ningún jugador y tienen su propio botón.
const EVENTOS_EQUIPO=[
  {t:'llegada_area',  n:'Llegada al área',             ic:'🥅', zona:true, ayuda:'Carril de origen de la jugada'},
  {t:'llegada_rival', n:'Llegada del rival',           ic:'⚠️', zona:true, ayuda:'Zona por la que llega: los 9 cuadrantes'},
  {t:'dos_por_uno',   n:'2x1 con centro al área',      ic:'👥', zona:true, ayuda:'Carril de origen'}
];
const TIPO_LEGADO={recovery:'recuperacion',loss:'perdida',dribble_ok:'regate_ok',dribble_ko:'regate_fallo',shot:'tiro_puerta'};
const TODOS_EVENTOS=EVENTOS.concat(EVENTOS_EQUIPO);
const EVENTO_NOM=Object.fromEntries(TODOS_EVENTOS.map(e=>[e.t,e.n]));
const EVENTO_IC=Object.fromEntries(TODOS_EVENTOS.map(e=>[e.t,e.ic]));
const EVENTO_DEF=Object.fromEntries(TODOS_EVENTOS.map(e=>[e.t,e]));
const esEquipo=t=>EVENTOS_EQUIPO.some(e=>e.t===t);
/* Retrocompatibilidad: los eventos guardados antes de esta versión no tienen
   zona, ámbito ni origen. undefined se trata como null y se asume ámbito de
   jugador. No se borra ni se reescribe nada de lo antiguo. */
function normalizeEvent(e){
  if(!e||typeof e!=='object')return null;
  e.tipo=e.tipo||TIPO_LEGADO[e.type]||e.type||'perdida';
  e.ambito=e.ambito||(e.tipo==='sub'?'sistema':(esEquipo(e.tipo)?'equipo':'jugador'));
  if(e.jugadorId===undefined)e.jugadorId=e.playerId??null;
  e.zona=ZONA_ETI[e.zona]?e.zona:null;   // undefined, '' o una zona desconocida cuentan como "sin zona"
  if(e.minuto===undefined)e.minuto=e.min??null;
  if(e.parte===undefined)e.parte=e.half||1;
  e.origen=e.origen||'legado';
  e.ts=e.ts||0;
  e.team=e.team||'own';
  e.id=e.id||('e'+Date.now().toString(36)+Math.random().toString(36).slice(2,6));
  return e
}
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
  L.events=(Array.isArray(L.events)?L.events:[]).map(normalizeEvent).filter(Boolean);
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
// Escritura local primero: en el campo, sin cobertura, esto es lo único que hay.
function saveLocal(){
  try{localStorage.setItem(storageKey(),JSON.stringify(state))}
  catch(e){console.warn('No se pudo guardar en el navegador:',e);showToast('Aviso: el navegador se ha quedado sin espacio. Usa fotos más ligeras.',4500)}
}
function persist(show=false){
  saveLocal();
  scheduleCloudSave();
  if(show)showToast('Cambios guardados')
}
function avatarStyle(p){return p.photo?`style="background-image:url('${p.photo}')"`:''}
const VIEW_TITLES={board:'Pizarra táctica',squad:'Gestión de plantilla',training:'Entrenamientos',rival:'Análisis del rival',report:'Informe del partido'};
const VIEW_EYEBROWS={board:'PARTIDO · PLANIFICACIÓN',squad:'EQUIPO · TEMPORADA 2026/27',training:'SESIONES · PREPARACIÓN',rival:'SCOUTING · PRÓXIMO PARTIDO',report:'ESTADÍSTICAS · ZONAS DEL CAMPO'};
function switchView(v){$$('.view,.nav-item').forEach(x=>x.classList.remove('active'));$(`#${v}View`).classList.add('active');$(`.nav-item[data-view="${v}"]`).classList.add('active');$('#pageTitle').textContent=VIEW_TITLES[v]||'';$('#sectionEyebrow').textContent=VIEW_EYEBROWS[v]||'';$('.sidebar').classList.remove('open');renderAll()}
$$('.nav-item').forEach(b=>b.onclick=()=>switchView(b.dataset.view));$$('[data-go-squad]').forEach(b=>b.onclick=()=>switchView('squad'));$$('[data-go-rival]').forEach(b=>b.onclick=()=>switchView('rival'));$('.mobile-menu').onclick=()=>$('.sidebar').classList.toggle('open');
function renderTabs(){$('#tacticTabs').innerHTML=state.tactics.map((t,i)=>`<button class="tactic-tab ${t.id===state.activeTactic?'active':''}" data-id="${t.id}">${esc(t.name)}${state.tactics.length>1?`<span class="remove" data-remove="${t.id}">×</span>`:''}</button>`).join('');$$('.tactic-tab').forEach(b=>b.onclick=e=>{if(e.target.dataset.remove){e.stopPropagation();state.tactics=state.tactics.filter(t=>t.id!==e.target.dataset.remove);if(state.activeTactic===e.target.dataset.remove)state.activeTactic=state.tactics[0].id}else state.activeTactic=b.dataset.id;persist();renderAll()})}
$('#addTactic').onclick=()=>{const n=state.tactics.length+1,id='t'+Date.now();state.tactics.push({id,name:`Táctica ${n}`,formation:'4-3-3',placed:[],arrows:[]});state.activeTactic=id;persist();renderAll()};
function renderBench(){const placed=new Set(tactic().placed.map(x=>x.playerId));const available=state.players.filter(p=>!placed.has(p.id));$('#availableCount').textContent=available.length;$('#benchList').innerHTML=available.map(p=>`<button class="bench-player own-choice" data-id="${p.id}"><span class="bench-avatar" ${avatarStyle(p)}>${p.photo?'':esc(initials(p.name))}</span><p><strong>${esc(p.name)}</strong><small>${esc(p.position)} · ${esc(p.number)}</small></p><i class="status-dot ${p.status}"></i></button>`).join('')||'<p class="helper">Toda la plantilla está en el campo.</p>';$$('.own-choice').forEach(b=>b.onclick=()=>benchAction(b.dataset.id,'own'));}
function renderRivalBench(){const placed=new Set(tactic().opponentPlaced.map(x=>x.playerId)),available=state.rivals.filter(p=>!placed.has(p.id));$('#rivalAvailableCount').textContent=available.length;$('#rivalBenchList').innerHTML=available.map(p=>`<button class="bench-player rival-choice" data-id="${p.id}"><span class="bench-avatar" ${avatarStyle(p)}>${p.photo?'':esc(initials(p.name))}</span><p><strong>${esc(p.name)}</strong><small>${esc(p.position)} · ${esc(p.number)}</small></p></button>`).join('')||'<p class="helper">Todo el rival está en el campo.</p>';$$('.rival-choice').forEach(b=>b.onclick=()=>benchAction(b.dataset.id,'rival'))}
function benchAction(id,team){if(tool==='sub'){if(!substitutionPending){showToast('Primero selecciona quién sale del campo');return}if(substitutionPending.team!==team){showToast('Elige un jugador del mismo equipo');return}completeSubstitution(id);return}placePlayer(id,team)}
function placePlayer(id,team='own'){pushUndo();const t=tactic(),list=team==='rival'?t.opponentPlaced:t.placed,spots=formations[t.formation]||[];let pos=team==='rival'?[15+list.length%4*23,15+Math.floor(list.length/4)*12]:(spots[list.length]||[50,50]);list.push({playerId:id,x:pos[0],y:pos[1]});persist();renderBoard()}
function renderPitch(){const t=tactic();$('#formation').value=t.formation;const own=t.placed.map(pp=>playerHTML(pp,state.players,'own')).join(''),rival=t.opponentPlaced.map(pp=>playerHTML(pp,state.rivals,'rival')).join('');$('#pitchPlayers').innerHTML=own+rival;$('#pitchHint').style.display=(t.placed.length+t.opponentPlaced.length)?'none':'block';$$('.pitch-player').forEach(el=>{el.onpointerdown=startPlayerDrag;el.oncontextmenu=e=>{e.preventDefault();e.stopPropagation();openContextMenu(e.clientX,e.clientY,el.dataset.id,el.dataset.team)}});renderArrows()}
function playerHTML(pp,roster,team){const p=roster.find(x=>x.id===pp.playerId);if(!p)return'';const marked=tactic().highlighted.includes(team+':'+p.id),selected=substitutionPending&&substitutionPending.team===team&&substitutionPending.id===p.id;const rivalStyle=team==='rival'?`--rival-primary:${state.rivalColors.primary};--rival-secondary:${state.rivalColors.secondary}`:'';const liveMin=(team==='own'&&state.live&&state.live.started&&!state.live.finished)?`<u class="live-min" data-min="${p.id}">${Math.floor((state.live.minutes[p.id]||0)/60)}′</u>`:'';return `<div class="pitch-player ${team==='rival'?'rival':''} ${marked?'highlighted':''} ${selected?'sub-selected':''}" data-id="${p.id}" data-team="${team}" style="left:${pp.x}%;top:${pp.y}%;${rivalStyle}"><div class="player-token" ${avatarStyle(p)}>${p.photo?'':esc(initials(p.name))}<b>${esc(p.number||'-')}</b>${liveMin}</div><small>${esc(p.name.split(' ')[0])}</small></div>`}
function startPlayerDrag(e){const el=e.currentTarget,id=el.dataset.id,team=el.dataset.team,key=team+':'+id;if(tool==='highlight'){e.preventDefault();pushUndo();const h=tactic().highlighted,i=h.indexOf(key);i>=0?h.splice(i,1):h.push(key);persist();renderPitch();afterAction();return}if(tool==='sub'){e.preventDefault();substitutionPending={id,team};renderPitch();showToast('Ahora selecciona quién entra desde el banquillo',2000);return}if(tool==='remove'){e.preventDefault();removePlayerFromPitch(id,team);return}if(tool!=='move')return;if(e.pointerType==='mouse'&&e.button!==0)return;e.preventDefault();const pitch=$('#pitch'),list=team==='rival'?tactic().opponentPlaced:tactic().placed,pp=list.find(x=>x.playerId===id);el.setPointerCapture(e.pointerId);
  // Pulsación larga (táctil) abre el menú contextual; en ratón lo hace el clic
  // derecho vía oncontextmenu. Si el dedo se mueve, es un arrastre y se cancela.
  let lpTimer=null,sx=e.clientX,sy=e.clientY,movido=false;
  if(e.pointerType!=='mouse')lpTimer=setTimeout(()=>{lpTimer=null;el.onpointermove=null;el.onpointerup=null;try{el.releasePointerCapture(e.pointerId)}catch(_){}openContextMenu(sx,sy,id,team)},480);
  // La foto para deshacer se toma en el primer movimiento real, antes de tocar
  // pp: así un toque suelto sobre el jugador no llena la pila de pasos vacíos.
  el.onpointermove=ev=>{if(lpTimer&&Math.hypot(ev.clientX-sx,ev.clientY-sy)>8){clearTimeout(lpTimer);lpTimer=null}if(!movido){movido=true;pushUndo()}const r=pitch.getBoundingClientRect();pp.x=Math.max(3,Math.min(97,(ev.clientX-r.left)/r.width*100));pp.y=Math.max(3,Math.min(97,(ev.clientY-r.top)/r.height*100));el.style.left=pp.x+'%';el.style.top=pp.y+'%'};el.onpointerup=()=>{if(lpTimer){clearTimeout(lpTimer);lpTimer=null}el.onpointermove=null;persist();renderBench();renderRivalBench()}}
function completeSubstitution(inId){const t=tactic(),team=substitutionPending.team,list=team==='rival'?t.opponentPlaced:t.placed,spot=list.find(x=>x.playerId===substitutionPending.id);if(!spot)return;pushUndo();const outId=spot.playerId;spot.playerId=inId;t.substitutions.push({x:spot.x,y:spot.y,team,outId,inId});if(state.live.started&&!state.live.finished&&team==='own')crearEvento({tipo:'sub',ambito:'sistema',team,outId,inId});substitutionPending=null;persist();renderBoard();afterAction();showToast('Cambio realizado')}
function removePlayerFromPitch(id,team){pushUndo();const t=tactic(),key=team+':'+id;if(team==='rival')t.opponentPlaced=t.opponentPlaced.filter(x=>x.playerId!==id);else t.placed=t.placed.filter(x=>x.playerId!==id);t.highlighted=t.highlighted.filter(x=>x!==key);persist();renderBoard();afterAction()}
function renderArrows(){const t=tactic();$('#arrows').innerHTML=t.arrows.map(a=>a.curve?`<path d="M ${a.x1} ${a.y1} Q ${a.cx} ${a.cy} ${a.x2} ${a.y2}"/>`:`<path d="M ${a.x1} ${a.y1} L ${a.x2} ${a.y2}"/>`).join('');$('#graphics').innerHTML=t.graphics.map(g=>g.type==='circle'?`<circle cx="${g.cx}" cy="${g.cy}" r="${g.r}"/>`:g.type==='rect'?`<rect x="${g.x}" y="${g.y}" width="${g.w}" height="${g.h}" rx="10"/>`:`<path d="${g.d}"/>`).join('');$('#textLayer').innerHTML=t.labels.map((l,i)=>`<span class="pitch-text" data-label="${i}" style="left:${l.x}%;top:${l.y}%">${esc(l.text)}</span>`).join('');$('#substitutionLayer').innerHTML=t.substitutions.map((s,i)=>`<span class="sub-badge" data-sub="${i}" style="left:${s.x}%;top:${s.y}%"><i class="in">↗</i><i class="out">↙</i></span>`).join('');$$('[data-label]').forEach(x=>x.onclick=()=>{if(tool==='remove'){pushUndo();t.labels.splice(+x.dataset.label,1);persist();renderArrows();afterAction()}});$$('[data-sub]').forEach(x=>x.onclick=()=>{if(tool==='remove'){pushUndo();t.substitutions.splice(+x.dataset.sub,1);persist();renderArrows();afterAction()}})}
$('#pitch').onpointerdown=e=>{if(e.pointerType==='mouse'&&e.button!==0)return;if(!['arrow','curve','circle','rect','pen','text','remove'].includes(tool)||e.target.closest('.pitch-player,.pitch-text,.sub-badge'))return;const r=$('#pitch').getBoundingClientRect(),x=(e.clientX-r.left)/r.width*1000,y=(e.clientY-r.top)/r.height*1400;if(tool==='remove'){removeNearestAnnotation(x,y);return}if(tool==='text'){const value=prompt('Escribe la indicación:');if(value){pushUndo();tactic().labels.push({text:value.slice(0,60),x:x/10,y:y/14});persist();renderArrows();afterAction()}return}drawing={x1:x,y1:y,x2:x,y2:y,points:[[x,y]]};$('#pitch').setPointerCapture(e.pointerId)};
function removeNearestAnnotation(x,y){const t=tactic(),candidates=[];t.arrows.forEach((a,i)=>candidates.push({kind:'arrows',i,d:Math.hypot(x-(a.x1+a.x2)/2,y-(a.y1+a.y2)/2)}));t.graphics.forEach((g,i)=>{let gx=g.cx,gy=g.cy;if(g.type==='pen'){const nums=(g.d.match(/[\d.]+/g)||[]).map(Number);gx=nums[nums.length-2];gy=nums[nums.length-1]}else if(g.type==='rect'){gx=g.x+g.w/2;gy=g.y+g.h/2}candidates.push({kind:'graphics',i,d:Math.hypot(x-gx,y-gy)})});t.labels.forEach((l,i)=>candidates.push({kind:'labels',i,d:Math.hypot(x-l.x*10,y-l.y*14)}));t.substitutions.forEach((s,i)=>candidates.push({kind:'substitutions',i,d:Math.hypot(x-s.x*10,y-s.y*14)}));const nearest=candidates.sort((a,b)=>a.d-b.d)[0];if(nearest&&nearest.d<180){pushUndo();t[nearest.kind].splice(nearest.i,1);persist();renderArrows();afterAction()}}
$('#pitch').onpointermove=e=>{if(!drawing)return;const r=$('#pitch').getBoundingClientRect();drawing.x2=(e.clientX-r.left)/r.width*1000;drawing.y2=(e.clientY-r.top)/r.height*1400;if(tool==='pen')drawing.points.push([drawing.x2,drawing.y2]);let d;if(tool==='circle'){const radius=Math.hypot(drawing.x2-drawing.x1,drawing.y2-drawing.y1);d=`M ${drawing.x1-radius} ${drawing.y1} a ${radius} ${radius} 0 1 0 ${radius*2} 0 a ${radius} ${radius} 0 1 0 ${-radius*2} 0`}else if(tool==='rect'){const b=rectBounds(drawing);d=`M ${b.x} ${b.y} h ${b.w} v ${b.h} h ${-b.w} Z`}else if(tool==='pen')d='M '+drawing.points.map(p=>p.join(' ')).join(' L ');else d=tool==='curve'?`M ${drawing.x1} ${drawing.y1} Q ${drawing.x1+(drawing.x2-drawing.x1)*.65} ${drawing.y1-(Math.abs(drawing.x2-drawing.x1)*.45+70)} ${drawing.x2} ${drawing.y2}`:`M ${drawing.x1} ${drawing.y1} L ${drawing.x2} ${drawing.y2}`;$('#draftArrow').setAttribute('d',d)};
// El rectángulo se guarda normalizado (esquina superior-izquierda + tamaño
// positivo): así arrastrar en cualquiera de las cuatro direcciones da la misma
// figura y el borrado por cercanía puede calcular su centro sin casos raros.
function rectBounds(d){return {x:Math.min(d.x1,d.x2),y:Math.min(d.y1,d.y2),w:Math.abs(d.x2-d.x1),h:Math.abs(d.y2-d.y1)}}
/* Mínimo de arrastre para dar la figura por buena. Antes era uno solo (20
   unidades entre el punto de salida y el de llegada) y descartaba en silencio:
   en el círculo esas 20 unidades son el RADIO, así que los círculos pequeños no
   se pintaban, y un trazo de bolígrafo cerrado —que acaba donde empezó— también
   se perdía por mucho que se hubiese dibujado. */
function trazoValido(d){
  if(tool==='pen')return d.points.length>3;
  if(tool==='rect')return Math.abs(d.x2-d.x1)>10||Math.abs(d.y2-d.y1)>10;
  return Math.hypot(d.x2-d.x1,d.y2-d.y1)>(tool==='circle'?10:14)
}
// Si el navegador se lleva el gesto (una interrupción del sistema, un segundo
// dedo), no queda ni el borrador en pantalla ni un arrastre a medias colgado.
$('#pitch').onpointercancel=()=>{drawing=null;$('#draftArrow').setAttribute('d','')};
$('#pitch').onpointerup=()=>{if(!drawing)return;const distance=Math.hypot(drawing.x2-drawing.x1,drawing.y2-drawing.y1);if(trazoValido(drawing)){pushUndo();if(tool==='circle')tactic().graphics.push({type:'circle',cx:drawing.x1,cy:drawing.y1,r:distance});else if(tool==='rect')tactic().graphics.push(Object.assign({type:'rect'},rectBounds(drawing)));else if(tool==='pen')tactic().graphics.push({type:'pen',d:'M '+drawing.points.map(p=>p.join(' ')).join(' L ')});else{if(tool==='curve'){drawing.curve=true;drawing.cx=drawing.x1+(drawing.x2-drawing.x1)*.65;drawing.cy=drawing.y1-(Math.abs(drawing.x2-drawing.x1)*.45+70)}tactic().arrows.push(drawing)}
  // Solo se vuelve a "Mover" si de verdad se ha dibujado algo: un toque suelto
  // sobre el campo no debe hacer perder la herramienta elegida.
  afterAction()}drawing=null;$('#draftArrow').setAttribute('d','');persist();renderArrows()};

/* ===== Herramientas: agrupación, fijado y vuelta automática a "Mover" =====
   Cada herramienta se usa para una acción y la barra vuelve sola a "Mover": en
   la banda, con el dedo, lo más fácil es tocar el campo otra vez sin querer y
   acabar con tres flechas. Quien necesite repetir (varios trazos de bolígrafo,
   marcar a media alineación) mantiene pulsada la herramienta o le da dos toques
   y queda FIJA hasta que la suelte. */
const TOOL_META={
  move:{ico:'↖',name:'Mover'},arrow:{ico:'➜',name:'Flecha'},curve:{ico:'↝',name:'Flecha curva'},
  circle:{ico:'◯',name:'Círculo'},rect:{ico:'▭',name:'Rectángulo'},text:{ico:'T',name:'Texto'},
  pen:{ico:'✎',name:'Bolígrafo'},highlight:{ico:'◉',name:'Marcar jugador'},sub:{ico:'⇄',name:'Cambio'},
  remove:{ico:'⌫',name:'Borrar'}
};
const TOOL_MENUS={marks:['arrow','curve','circle','rect'],annot:['text','pen','highlight','sub']};
const menuShown={marks:'arrow',annot:'text'};   // herramienta visible en cada desplegable
let toolPinned=false;
function setTool(t){
  tool=t;if(tool!=='sub')substitutionPending=null;
  Object.keys(TOOL_MENUS).forEach(k=>{if(TOOL_MENUS[k].includes(t))menuShown[k]=t});
  renderToolbar();renderPitch()
}
function afterAction(){if(!toolPinned&&tool!=='move')setTool('move')}
function renderToolbar(){
  $$('.pitch-toolbar .tool[data-tool]').forEach(b=>{
    const on=b.dataset.tool===tool;
    b.classList.toggle('active',on);b.classList.toggle('pinned',on&&toolPinned)
  });
  Object.keys(TOOL_MENUS).forEach(k=>{
    const menu=$(`.tool-menu[data-menu="${k}"]`);if(!menu)return;
    const meta=TOOL_META[menuShown[k]],trg=menu.querySelector('.tool-trigger'),activo=TOOL_MENUS[k].includes(tool);
    trg.querySelector('.t-ico').textContent=meta.ico;
    trg.querySelector('.t-name').textContent=meta.name;
    trg.classList.toggle('active',activo);trg.classList.toggle('pinned',activo&&toolPinned);
    menu.querySelectorAll('.tool-option').forEach(o=>{
      const on=o.dataset.tool===tool;
      o.classList.toggle('on',on);o.classList.toggle('pinned',on&&toolPinned)
    })
  });
  const u=$('#undoBtn');if(u)u.disabled=!undoStack.length
}
function pinTool(t){
  if(toolPinned&&tool===t){toolPinned=false;setTool('move');showToast('Herramienta suelta');return}
  toolPinned=true;setTool(t);showToast(`${TOOL_META[t].name} fijada. Vuelve a mantener pulsado para soltarla.`,2600)
}
/* Un toque elige la herramienta; pulsación larga (550 ms) o doble toque la fija.
   El doble toque se detecta a mano porque dblclick no llega con el dedo. */
function bindTool(el,t){
  let lpTimer=null,lpFired=false,lastTap=0;
  const cancel=()=>{if(lpTimer){clearTimeout(lpTimer);lpTimer=null}};
  el.addEventListener('pointerdown',()=>{lpFired=false;cancel();lpTimer=setTimeout(()=>{lpTimer=null;lpFired=true;pinTool(t);closeToolMenus()},550)});
  ['pointerup','pointercancel','pointerleave'].forEach(ev=>el.addEventListener(ev,cancel));
  el.addEventListener('contextmenu',ev=>ev.preventDefault());
  el.addEventListener('click',()=>{
    if(lpFired){lpFired=false;return}
    const ahora=Date.now();
    if(ahora-lastTap<350){lastTap=0;pinTool(t);closeToolMenus();return}
    lastTap=ahora;toolPinned=false;setTool(t);closeToolMenus()
  })
}
/* Los desplegables se pintan en position:fixed y se colocan aquí: dentro del
   panel del campo (overflow:hidden) quedarían recortados igual que antes. */
function placeDropdown(menu){
  const trg=menu.querySelector('.tool-trigger'),dd=menu.querySelector('.tool-dropdown'),r=trg.getBoundingClientRect();
  dd.hidden=false;
  const w=dd.offsetWidth,h=dd.offsetHeight;
  dd.style.left=Math.max(8,Math.min(r.left,innerWidth-w-8))+'px';
  dd.style.top=(r.bottom+6+h>innerHeight-8?Math.max(8,r.top-h-6):r.bottom+6)+'px'
}
function closeToolMenus(){$$('.tool-menu.open').forEach(m=>{m.classList.remove('open');m.querySelector('.tool-dropdown').hidden=true;m.querySelector('.tool-trigger').setAttribute('aria-expanded','false')})}
/* En el botón principal del desplegable un toque abre la lista, pero la
   pulsación larga y el doble toque fijan la herramienta que muestra. Dentro de
   la lista el doble toque no serviría: el primer toque ya cierra el menú y el
   segundo caería sobre el campo. */
$$('.tool-menu').forEach(menu=>{
  const trg=menu.querySelector('.tool-trigger'),grupo=menu.dataset.menu;
  let lpTimer=null,lpFired=false,lastTap=0;
  const cancel=()=>{if(lpTimer){clearTimeout(lpTimer);lpTimer=null}};
  trg.addEventListener('pointerdown',e=>{e.stopPropagation();lpFired=false;cancel();lpTimer=setTimeout(()=>{lpTimer=null;lpFired=true;closeToolMenus();pinTool(menuShown[grupo])},550)});
  ['pointerup','pointercancel','pointerleave'].forEach(ev=>trg.addEventListener(ev,cancel));
  trg.addEventListener('contextmenu',e=>e.preventDefault());
  trg.addEventListener('click',e=>{
    e.stopPropagation();
    if(lpFired){lpFired=false;return}
    const ahora=Date.now(),herr=menuShown[grupo];
    if(ahora-lastTap<350){lastTap=0;closeToolMenus();pinTool(herr);return}
    lastTap=ahora;
    const abierto=menu.classList.contains('open');closeToolMenus();
    if(abierto)return;
    /* Si la herramienta que muestra el botón no está activa, el toque la activa
       sin abrir nada: como la barra vuelve sola a "Mover" después de cada
       figura, repetir un círculo es UN toque y no tres. Era justo esto lo que
       hacía que el segundo arrastre pareciese que "no pinta": no había
       herramienta activa. Si ya está activa, el toque abre la lista para
       cambiar de forma. */
    if(tool!==herr){toolPinned=false;setTool(herr);return}
    menu.classList.add('open');trg.setAttribute('aria-expanded','true');placeDropdown(menu)
  });
  menu.querySelectorAll('.tool-option').forEach(o=>bindTool(o,o.dataset.tool))
});
$$('.pitch-toolbar .tool[data-tool]').forEach(b=>bindTool(b,b.dataset.tool));
// Tocar fuera, mover la página o Escape cierran el desplegable.
document.addEventListener('pointerdown',e=>{if(!e.target.closest('.tool-menu'))closeToolMenus()},true);
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeToolMenus()});
addEventListener('resize',()=>$$('.tool-menu.open').forEach(placeDropdown));
addEventListener('scroll',()=>$$('.tool-menu.open').forEach(placeDropdown),true);

/* ===== Deshacer =====
   Fotos completas de los elementos del campo en vez de operaciones inversas:
   dibujar, borrar con la goma, mover un jugador o limpiar el campo se deshacen
   con el mismo código, y lo copiado son solo coordenadas (unos pocos KB). Vive
   en memoria: es de este dispositivo, no se guarda ni se sincroniza. */
const CAMPO_KEYS=['placed','opponentPlaced','arrows','graphics','labels','highlighted','substitutions'];
const UNDO_MAX=30;
let undoStack=[];
function pushUndo(){
  const t=tactic();if(!t)return;
  const snap={};CAMPO_KEYS.forEach(k=>snap[k]=JSON.parse(JSON.stringify(t[k]||[])));
  undoStack.push({tacticId:t.id,snap});
  if(undoStack.length>UNDO_MAX)undoStack.shift();
  const u=$('#undoBtn');if(u)u.disabled=false
}
function undoLast(){
  while(undoStack.length){
    const paso=undoStack.pop(),t=state.tactics.find(x=>x.id===paso.tacticId);
    if(!t)continue;                       // la táctica se borró: ese paso ya no aplica
    CAMPO_KEYS.forEach(k=>t[k]=paso.snap[k]);
    state.activeTactic=t.id;substitutionPending=null;
    persist();renderBoard();showToast('Acción deshecha');return
  }
  renderToolbar();showToast('No hay nada que deshacer')
}
$('#undoBtn').onclick=undoLast;
$('#clearAll').onclick=()=>{
  if(!confirm('Se borrarán todos los elementos del campo, incluidos jugadores y marcas. ¿Continuar?'))return;
  pushUndo();const t=tactic();CAMPO_KEYS.forEach(k=>t[k]=[]);
  substitutionPending=null;persist();renderBoard();showToast('Campo vacío')
};
$('#formation').onchange=e=>{pushUndo();const t=tactic();t.formation=e.target.value;const spots=formations[t.formation];if(spots)t.placed.forEach((p,i)=>{if(spots[i]){p.x=spots[i][0];p.y=spots[i][1]}});persist();renderPitch()};
function renderBoard(){renderTabs();renderBench();renderRivalBench();renderToolbar();renderPitch();renderScoreboard();renderLive()}
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
function renderAll(){applyBrand();renderBoard();renderSquad();renderRivals();renderTrainings();$('#reportCount').textContent=eventosDelPartido().length;renderReportIfActive()}

/* ===== Menú contextual del jugador (clic derecho en PC / pulsación larga en móvil) =====
   Sustituir reutiliza el flujo de la herramienta de cambio; Editar abre la ficha
   ya existente; Asignar gol registra goleador y asistencia. El menú aparece sobre
   la foto del jugador en la pizarra, en modo Mover (la herramienta por defecto). */
function rosterOf(team){return team==='rival'?state.rivals:state.players}
function nombreDe(team,id){const p=rosterOf(team).find(x=>x.id===id);return p?p.name:'—'}

/* ===== Selector de zona: un único componente =====
   Lo usan los eventos de jugador, los de equipo y la corrección de zona desde el
   informe o desde la ficha. Se pinta DENTRO del popup que ya está abierto, así
   que registrar cuesta tres toques: jugador → evento → cuadrante. Sin zona por
   defecto y sin caducidad: si no se toca, no se inventa nada. */
function zonaGridHTML(titulo,ayuda,zonaActual){
  const celda=z=>`<button type="button" class="zg-cell${zonaActual===z?' now':''}" data-zona="${z}"><b>${ZONA_ETI[z]}</b><i>${esc(ZONA_NOM[z].split(' · ')[1])}</i></button>`;
  return `<div class="zone-pick">
    <div class="zp-head"><span class="zp-title">${esc(titulo)}</span>${ayuda?`<small>${esc(ayuda)}</small>`:''}</div>
    <div class="zp-field"><div class="zp-grid">${ZONAS.map(celda).join('')}</div><span class="zp-goal">▼ NUESTRA PORTERÍA</span></div>
    <div class="zp-actions"><button type="button" class="zp-skip" data-zona="">Sin zona</button><button type="button" class="zp-cancel">Volver</button></div>
  </div>`
}
function bindZonaGrid(box,onPick,onCancel){
  box.querySelectorAll('[data-zona]').forEach(b=>b.onclick=ev=>{
    ev.stopPropagation();
    const z=b.dataset.zona||null;
    if(z){b.classList.add('flash');try{navigator.vibrate&&navigator.vibrate(20)}catch(_){}}
    setTimeout(()=>onPick(z),z?120:0)
  });
  const c=box.querySelector('.zp-cancel');
  if(c)c.onclick=ev=>{ev.stopPropagation();onCancel&&onCancel()}
}

/* ===== Menú de pulsación larga sobre el jugador =====
   Once eventos no caben en una lista usable, así que van en dos pestañas
   (Ofensivo / Defensivo) con los cuatro originales al principio de cada una. */
let menuTarget=null,menuPos={x:0,y:0},menuTab='of';
function openContextMenu(x,y,id,team){
  if(!rosterOf(team).find(p=>p.id===id))return;
  menuTarget={id,team};menuPos={x,y};menuTab='of';
  $('#playerMenu').classList.remove('hidden');
  renderPlayerMenu()
}
function placeMenu(m){
  const mw=m.offsetWidth||210,mh=m.offsetHeight||200;
  m.style.left=Math.max(8,Math.min(menuPos.x,innerWidth-mw-8))+'px';
  m.style.top=Math.max(8,Math.min(menuPos.y,innerHeight-mh-8))+'px'
}
function renderPlayerMenu(){
  const m=$('#playerMenu');if(!menuTarget)return;
  const {id,team}=menuTarget,vivo=state.live.started&&!state.live.finished;
  const acciones=`<div class="ctx-name">${esc(nombreDe(team,id))}</div>
    <button type="button" data-act="sub"><span class="ic">⇄</span>Sustituir</button>
    <button type="button" data-act="edit"><span class="ic">✎</span>Editar ficha</button>
    <button type="button" data-act="goal"><span class="ic">⚽</span>Asignar gol</button>
    <button type="button" data-act="stats"><span class="ic">▤</span>Sus estadísticas</button>`;
  let ev='';
  if(vivo){
    const lista=EVENTOS.filter(e=>e.g===menuTab);
    ev=`<div class="ctx-events">
      <div class="ctx-sep">REGISTRAR ACCIÓN</div>
      <div class="ctx-tabs"><button type="button" class="ctx-tab${menuTab==='of'?' on':''}" data-tab="of">Ofensivo</button><button type="button" class="ctx-tab${menuTab==='def'?' on':''}" data-tab="def">Defensivo</button></div>
      <div class="ctx-ev-grid">${lista.map(e=>`<button type="button" class="ctx-ev" data-ev="${e.t}"><i>${e.ic}</i><span>${esc(e.n)}${e.ayuda?`<small>${esc(e.ayuda)}</small>`:''}</span></button>`).join('')}</div></div>`
  }
  m.innerHTML=acciones+ev;
  m.querySelectorAll('[data-tab]').forEach(b=>b.onclick=e=>{e.stopPropagation();menuTab=b.dataset.tab;renderPlayerMenu()});
  m.querySelectorAll('[data-ev]').forEach(b=>b.onclick=e=>{
    e.stopPropagation();
    const def=EVENTO_DEF[b.dataset.ev];
    if(def&&def.zona)pedirZonaEnMenu(def);
    else{registrarEventoJugador(b.dataset.ev,id,team,null);closeContextMenu()}
  });
  m.querySelectorAll('[data-act]').forEach(b=>b.onclick=e=>{
    e.stopPropagation();
    const act=b.dataset.act;closeContextMenu();
    if(act==='sub')startSubstitution(id,team);
    else if(act==='edit')openPlayer(id,team);
    else if(act==='goal')openGoalDialog(id,team);
    else if(act==='stats')openStats(id,team)
  });
  placeMenu(m)
}
// El mismo popup se transforma en el selector: ni se cierra ni abre otro modal.
function pedirZonaEnMenu(def){
  const m=$('#playerMenu'),{id,team}=menuTarget;
  m.innerHTML=zonaGridHTML(def.n,def.ayuda||'¿En qué zona?',null);
  bindZonaGrid(m,z=>{registrarEventoJugador(def.t,id,team,z);closeContextMenu()},renderPlayerMenu);
  placeMenu(m)
}
function closeContextMenu(){$('#playerMenu').classList.add('hidden');menuTarget=null}
// Cerrar al tocar fuera, al hacer scroll, al redimensionar o con Escape.
function cerrarPopups(){closeContextMenu();closeTeamMenu()}
document.addEventListener('pointerdown',e=>{
  if(!e.target.closest('#playerMenu'))closeContextMenu();
  if(!e.target.closest('#teamMenu')&&!e.target.closest('#teamFab'))closeTeamMenu()
});
document.addEventListener('scroll',cerrarPopups,true);
window.addEventListener('resize',cerrarPopups);
document.addEventListener('keydown',e=>{if(e.key==='Escape')cerrarPopups()});
// Sin menú nativo del navegador al usar el botón derecho sobre el campo.
$('#pitch').addEventListener('contextmenu',e=>e.preventDefault());

function startSubstitution(id,team){
  setTool('sub');
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
  const assistId=$('#goalAssist').value||null,vivo=state.live.started&&!state.live.finished;
  const gol={id:'g'+Date.now(),team:goalTeam,scorerId,assistId,min:vivo?liveMinute():null};
  state.match.goals.push(gol);
  // Con el partido en directo el gol también entra como evento (sin zona, porque
  // aquí no se ha preguntado) para que el informe por zonas cuadre con el marcador.
  if(vivo){
    const ev=crearEvento({tipo:'gol',ambito:'jugador',jugadorId:scorerId,team:goalTeam,zona:null});
    ev.golId=gol.id;gol.evId=ev.id;cloudSaveEvent(ev);
    if(assistId)crearEvento({tipo:'asistencia',ambito:'jugador',jugadorId:assistId,team:goalTeam,zona:null})
  }
  $('#goalDialog').close();persist(true);renderScoreboard();refrescarPaneles();showToast('Gol registrado')
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
  $$('[data-goal]').forEach(b=>b.onclick=()=>{
    const gid=b.dataset.goal,gol=state.match.goals.find(x=>x.id===gid);
    state.match.goals=state.match.goals.filter(x=>x.id!==gid);
    // El evento de gol enlazado se va con él: si no, el mapa seguiría contándolo.
    const ev=state.live.events.find(e=>e.golId===gid||(gol&&gol.evId&&e.id===gol.evId));
    if(ev){state.live.events=state.live.events.filter(e=>e.id!==ev.id);cloudDeleteEvent(ev.id)}
    persist();renderScoreboard();refrescarPaneles()
  })
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
  L.started=true;L.finished=false;L.running=true;L.half=1;L.elapsed=0;L.minutes={};limpiarEventos();
  liveSaveCount=0;persist();renderBoard();liveStartTicking();showToast('¡Partido en marcha!')
}
function livePause(){state.live.running=false;liveStopTicking();persist();renderLive()}
function liveResume(){state.live.running=true;persist();renderLive();liveStartTicking()}
function liveEndHalf(){const L=state.live;L.running=false;liveStopTicking();const fin=halfName(L.half);L.half++;L.elapsed=0;liveSaveCount=0;persist();renderBoard();showToast('Fin de la '+fin)}
function liveFinish(){const L=state.live;L.running=false;L.finished=true;liveStopTicking();persist();renderBoard();openReport()}
function liveReset(){
  if(!confirm('¿Reiniciar el partido? Se ponen a cero el marcador, el cronómetro, los minutos y los eventos. No se puede deshacer.'))return;
  limpiarEventos();
  state.live={started:false,finished:false,running:false,half:1,halfLength:state.live.halfLength||45,elapsed:0,minutes:{},events:[]};
  // Los goles viven en state.match.goals, dentro del JSON de la pizarra: al
  // vaciarlos aquí, el persist() de abajo sube el documento ya a cero. Los
  // eventos de gol enlazados están en la subcolección y se los ha llevado
  // limpiarEventos(), así que no queda ningún gol residual en la nube.
  state.match.goals=[];
  liveStopTicking();persist();renderBoard();refrescarPaneles();showToast('Partido reiniciado: marcador 0 – 0')
}
function setHalfLength(m){state.live.halfLength=m;persist();renderLive()}

function renderLive(){
  const bar=$('#liveBar');if(!bar)return;
  const L=state.live;
  const lengths=[45,40,35,30,25];
  const lenChips=`<div class="live-lens">${lengths.map(m=>`<button type="button" class="live-len ${L.halfLength===m?'on':''}" data-len="${m}">${m}′</button>`).join('')}</div>`;
  // El rol de registro (individual / equipo) vive en el panel ⚑ Equipo, no aquí:
  // antes del pitido lo único que hay que decidir es la duración de las partes.
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
      controls=`<button type="button" class="btn secondary" id="teamEvBtn">⚑ Equipo</button><button type="button" class="btn secondary" id="livePause">⏸ Pausa</button><button type="button" class="btn secondary" id="liveEndHalf">⏹ Fin de parte</button><button type="button" class="btn secondary" id="liveReport">📄 Informe</button><button type="button" class="btn primary" id="liveFinish">Finalizar</button>`;
    }else{
      const resumeLabel=L.elapsed===0?('▶ Iniciar '+halfName(L.half)):'▶ Reanudar';
      controls=`${L.elapsed===0?lenChips:''}<button type="button" class="btn secondary" id="teamEvBtn">⚑ Equipo</button><button type="button" class="btn primary" id="liveResume">${resumeLabel}</button><button type="button" class="btn secondary" id="liveReport">📄 Informe</button><button type="button" class="btn secondary" id="liveFinish">Finalizar</button>`;
    }
    html=`<div class="live-run">${clock}<div class="live-controls">${controls}</div></div>`;
  }
  bar.className='live-bar'+(L.started&&L.running?' running':'');
  bar.innerHTML=html;
  $$('#liveBar .live-len[data-len]').forEach(b=>b.onclick=()=>setHalfLength(+b.dataset.len));
  const bind=(id,fn)=>{const el=$('#'+id);if(el)el.onclick=fn};
  bind('liveStart',liveStart);bind('livePause',livePause);bind('liveResume',liveResume);
  bind('liveEndHalf',liveEndHalf);bind('liveFinish',liveFinish);bind('liveReset',liveReset);bind('liveReport',openReport);
  bind('teamEvBtn',e=>{e.stopPropagation();openTeamMenu()});
  renderTeamFab();
  // Si el partido sigue en marcha y este dispositivo es el cronometrador, mantener el tick tras cada re-render.
  if(L.started&&L.running&&isTimekeeper)liveStartTicking()
}

/* ===== Registro de eventos =====
   Un evento se escribe primero en memoria y en el navegador (para que el modo
   avión no pierda nada) y después se replica a su documento propio en la nube.
   Al ser un documento por evento, dos dispositivos con la misma clave pueden
   registrar a la vez sin pisarse: no hay un array común que sobrescribir. */
let rolRegistro=localStorage.getItem('udt-rol')||'individual';
function setRol(r){rolRegistro=r;localStorage.setItem('udt-rol',r);renderLive();renderTeamFab();if($('#teamMenu')&&!$('#teamMenu').classList.contains('hidden'))renderTeamMenu()}
function nuevoId(){return 'e'+Date.now().toString(36)+Math.random().toString(36).slice(2,6)}
function crearEvento(base){
  const L=state.live;
  const ev=normalizeEvent(Object.assign({
    id:nuevoId(),ambito:'jugador',jugadorId:null,zona:null,
    minuto:liveMinute(),parte:L.half,origen:'rol_'+rolRegistro,ts:Date.now(),team:'own'
  },base));
  L.events.push(ev);cloudSaveEvent(ev);persist();
  return ev
}
function borrarEvento(id){
  const L=state.live,i=L.events.findIndex(e=>e.id===id);
  if(i<0)return;
  const ev=L.events[i];
  // Un gol registrado desde el menú también está en el marcador: se quitan los dos.
  if(ev.golId)state.match.goals=state.match.goals.filter(g=>g.id!==ev.golId);
  L.events.splice(i,1);cloudDeleteEvent(id);persist();
  renderBoard();refrescarPaneles()
}
function cambiarZonaEvento(id,zona){
  const ev=state.live.events.find(e=>e.id===id);if(!ev)return;
  ev.zona=zona;ev.ts=ev.ts||Date.now();cloudSaveEvent(ev);persist();refrescarPaneles()
}
function refrescarPaneles(){
  if($('#reportView').classList.contains('active'))renderReport();
  if($('#statsDialog').open&&statsTarget)renderStats()
}
function registrarEventoJugador(tipo,id,team,zona){
  const L=state.live;if(!L.started||L.finished)return;
  const ev=crearEvento({tipo,ambito:'jugador',jugadorId:id,team,zona});
  // El gol también entra en el marcador para que no haya dos cuentas distintas.
  if(tipo==='gol'){
    const gol={id:'g'+Date.now(),team,scorerId:id,assistId:null,min:ev.minuto,evId:ev.id};
    state.match.goals.push(gol);ev.golId=gol.id;cloudSaveEvent(ev);persist();renderScoreboard()
  }
  const nombre=nombreDe(team,id).split(' ')[0];
  ofrecerDeshacer(ev,`${EVENTO_IC[tipo]||''} ${EVENTO_NOM[tipo]||tipo} · ${nombre}${zona?' · '+ZONA_ETI[zona]:' · sin zona'}`);
  refrescarPaneles()
}
function registrarEventoEquipo(tipo,zona){
  const L=state.live;if(!L.started||L.finished)return;
  const ev=crearEvento({tipo,ambito:'equipo',jugadorId:null,zona});
  ofrecerDeshacer(ev,`${EVENTO_IC[tipo]||''} ${EVENTO_NOM[tipo]||tipo}${zona?' · '+ZONA_ETI[zona]:' · sin zona'}`);
  refrescarPaneles()
}

/* Deshacer: 6,5 s con botón. Corregir en caliente es más rápido que buscar el
   evento en el informe, y a pie de campo el fallo se ve al instante. */
let undoTimer=null,undoId=null;
function ofrecerDeshacer(ev,texto){
  undoId=ev.id;
  const t=$('#undoToast');
  t.innerHTML=`<span>${esc(texto)}</span><button type="button" id="undoBtn">Deshacer</button>`;
  t.classList.add('show');
  $('#undoBtn').onclick=()=>{if(undoId)borrarEvento(undoId);undoId=null;t.classList.remove('show');clearTimeout(undoTimer);showToast('Evento deshecho')};
  clearTimeout(undoTimer);
  undoTimer=setTimeout(()=>{t.classList.remove('show');undoId=null},6500)
}

/* ===== Eventos de equipo: botón propio, fuera del flujo del jugador ===== */
function renderTeamFab(){
  const fab=$('#teamFab'),vivo=state.live.started&&!state.live.finished;
  fab.classList.toggle('hidden',!vivo);
  fab.classList.toggle('wide',rolRegistro==='equipo');
  document.body.classList.toggle('live-on',vivo)
}
function openTeamMenu(){
  const m=$('#teamMenu');
  if(!(state.live.started&&!state.live.finished)){showToast('Inicia el partido en directo para registrar eventos.',2400);return}
  m.classList.remove('hidden');renderTeamMenu()
}
function closeTeamMenu(){const m=$('#teamMenu');if(m)m.classList.add('hidden')}
function contarTipo(t){return state.live.events.filter(e=>e.tipo===t).length}
function renderTeamMenu(){
  const m=$('#teamMenu');
  m.innerHTML=`<div class="tm-head"><span class="eyebrow">EVENTOS DE EQUIPO</span><button type="button" class="tm-close">×</button></div>
    <p class="tm-help">Pulsación larga sobre el contador para restar uno.</p>
    ${EVENTOS_EQUIPO.map(e=>`<button type="button" class="tm-ev" data-ev="${e.t}"><i>${e.ic}</i><span><strong>${esc(e.n)}</strong><small>${esc(e.ayuda||'')}</small></span><b class="tm-count" data-count="${e.t}">${contarTipo(e.t)}</b></button>`).join('')}
    <div class="tm-rol"><span>Rol de este dispositivo</span><span class="tm-rol-chips"><button type="button" class="tm-rol-chip${rolRegistro==='individual'?' on':''}" data-rol="individual">Individual</button><button type="button" class="tm-rol-chip${rolRegistro==='equipo'?' on':''}" data-rol="equipo">Equipo</button></span></div>`;
  m.querySelector('.tm-close').onclick=closeTeamMenu;
  m.querySelectorAll('[data-rol]').forEach(b=>b.onclick=e=>{e.stopPropagation();setRol(b.dataset.rol)});
  m.querySelectorAll('.tm-ev').forEach(b=>b.onclick=e=>{
    if(e.target.closest('.tm-count'))return;
    e.stopPropagation();
    const def=EVENTOS_EQUIPO.find(x=>x.t===b.dataset.ev);
    pedirZonaEnEquipo(def)
  });
  // Pulsación larga sobre el contador: quita el último evento de ese tipo.
  m.querySelectorAll('.tm-count').forEach(c=>{
    let t=null;
    const arranca=e=>{e.stopPropagation();t=setTimeout(()=>{t=null;restarEventoEquipo(c.dataset.count)},550)};
    const para=()=>{if(t){clearTimeout(t);t=null}};
    c.onpointerdown=arranca;c.onpointerup=para;c.onpointerleave=para;c.onpointercancel=para;
    c.oncontextmenu=e=>e.preventDefault()
  })
}
function restarEventoEquipo(tipo){
  const lista=state.live.events.filter(e=>e.tipo===tipo);
  if(!lista.length){showToast('No hay ninguno que quitar.');return}
  borrarEvento(lista[lista.length-1].id);
  try{navigator.vibrate&&navigator.vibrate(20)}catch(_){}
  renderTeamMenu();showToast('Quitado un '+(EVENTO_NOM[tipo]||tipo).toLowerCase())
}
function pedirZonaEnEquipo(def){
  const m=$('#teamMenu');
  m.innerHTML=zonaGridHTML(def.n,def.ayuda||'¿En qué zona?',null);
  bindZonaGrid(m,z=>{registrarEventoEquipo(def.t,z);renderTeamMenu()},renderTeamMenu)
}
$('#teamFab').onclick=e=>{e.stopPropagation();$('#teamMenu').classList.contains('hidden')?openTeamMenu():closeTeamMenu()};

/* ===== Informe del partido: campo, mapa de calor y tablas =====
   Vista propia, no pop-up: el campo con la rejilla 3×3 es lo primero que se ve.
   Las métricas derivadas (pérdidas en inicio de juego, en zona media o en campo
   rival) se calculan aquí a partir de los eventos `perdida`; no tienen botón
   propio para que no haya dos cuentas distintas del mismo dato. */
const METRICAS=[
  {id:'llegada_area', g:'Ataque',    n:'Llegadas al área',            c:'verde', f:e=>e.tipo==='llegada_area'},
  {id:'tiro_puerta',  g:'Ataque',    n:'Tiros a puerta',              c:'verde', f:e=>e.tipo==='tiro_puerta'},
  {id:'centro_remate',g:'Ataque',    n:'Centros con remate',          c:'verde', f:e=>e.tipo==='centro_remate'},
  {id:'dos_por_uno',  g:'Ataque',    n:'2x1 con centro al área',      c:'verde', f:e=>e.tipo==='dos_por_uno'},
  {id:'profundidad',  g:'Ataque',    n:'Ataques a la profundidad',    c:'verde', f:e=>e.tipo==='profundidad'},
  {id:'gol',          g:'Ataque',    n:'Goles',                       c:'verde', f:e=>e.tipo==='gol'},
  {id:'asistencia',   g:'Ataque',    n:'Asistencias',                 c:'verde', f:e=>e.tipo==='asistencia'},
  {id:'regate_ok',    g:'Ataque',    n:'Regates exitosos',            c:'verde', f:e=>e.tipo==='regate_ok'},
  {id:'regate_fallo', g:'Ataque',    n:'Regates fallidos',            c:'rojo',  f:e=>e.tipo==='regate_fallo'},
  {id:'perdida',      g:'Defensa',   n:'Pérdidas (todas)',            c:'rojo',  f:e=>e.tipo==='perdida'},
  {id:'perdida_def',  g:'Defensa',   n:'Pérdidas en inicio de juego', c:'rojo',  f:e=>e.tipo==='perdida'&&zonaFranja(e.zona)==='def'},
  {id:'perdida_med',  g:'Defensa',   n:'Pérdidas en zona media',      c:'rojo',  f:e=>e.tipo==='perdida'&&zonaFranja(e.zona)==='med'},
  {id:'perdida_ata',  g:'Defensa',   n:'Pérdidas en campo rival',     c:'rojo',  f:e=>e.tipo==='perdida'&&zonaFranja(e.zona)==='ata'},
  {id:'recuperacion', g:'Defensa',   n:'Recuperaciones',              c:'verde', f:e=>e.tipo==='recuperacion'},
  {id:'pase_fallido', g:'Defensa',   n:'Pases fallidos',              c:'rojo',  f:e=>e.tipo==='pase_fallido'},
  {id:'error_despeje',g:'Defensa',   n:'Errores en despeje',          c:'rojo',  f:e=>e.tipo==='error_despeje'},
  {id:'llegada_rival',g:'Defensa',   n:'Llegadas del rival',          c:'rojo',  f:e=>e.tipo==='llegada_rival'},
  {id:'balance',      g:'Combinada', n:'Balance defensivo (rec. − pérd.)', c:'div'},
  {id:'regate_pct',   g:'Combinada', n:'% de acierto en regate',      c:'pct'}
];
const metricaDe=id=>METRICAS.find(m=>m.id===id)||METRICAS[9];
// 6 escalones discretos en vez de degradado: se lee mejor en el móvil y con sol.
const RAMPA={rojo:['#eef3f0','#ffe1de','#ffb8b0','#f6867d','#e04e57','#a61f2b'],verde:['#eef3f0','#daf1e3','#a5e0bd','#59c78f','#199f68','#0c6742']};
const pasoDe=(v,max)=>!v||max<=0?0:Math.max(1,Math.min(5,Math.ceil(Math.abs(v)/max*5)));
const CAMPO_W=300,CAMPO_H=452;

let repMetrica='perdida',repJugador='',repParte='',repMinDe=0,repMinA=130,repZona=null,repFiltrosAbiertos=false;

function eventosDelPartido(){return state.live.events.filter(e=>e.tipo!=='sub')}
function eventosFiltrados(){
  return eventosDelPartido().filter(e=>{
    if(e.team==='rival')return false;                       // acciones de jugadores rivales: fuera del mapa propio
    if(repJugador&&e.jugadorId!==repJugador)return false;
    if(repParte&&String(e.parte)!==repParte)return false;
    const m=e.minuto==null?0:e.minuto;
    return m>=repMinDe&&m<=repMinA
  })
}
function datosMapa(m){
  const base=eventosFiltrados();
  const z={},extra={};ZONAS.forEach(k=>{z[k]=0;extra[k]=''});
  let sin=0,total=0,max=0;
  if(m.id==='balance'){
    const rec={},per={};ZONAS.forEach(k=>{rec[k]=0;per[k]=0});
    base.forEach(e=>{
      if(e.tipo!=='recuperacion'&&e.tipo!=='perdida')return;
      total++;if(!e.zona){sin++;return}
      e.tipo==='recuperacion'?rec[e.zona]++:per[e.zona]++
    });
    // En los cuadrantes donde no ha pasado nada se deja el número solo: repetir
    // "0R · 0P" nueve veces solo ensucia el campo.
    ZONAS.forEach(k=>{z[k]=rec[k]-per[k];extra[k]=(rec[k]||per[k])?`${rec[k]}R · ${per[k]}P`:'';max=Math.max(max,Math.abs(z[k]))});
    return {z,extra,sin,total,conZona:total-sin,max,modo:'balance',color:'div'}
  }
  if(m.id==='regate_pct'){
    const ok={},ko={};ZONAS.forEach(k=>{ok[k]=0;ko[k]=0});
    base.forEach(e=>{
      if(e.tipo!=='regate_ok'&&e.tipo!=='regate_fallo')return;
      total++;if(!e.zona){sin++;return}
      e.tipo==='regate_ok'?ok[e.zona]++:ko[e.zona]++
    });
    ZONAS.forEach(k=>{const n=ok[k]+ko[k];z[k]=n?Math.round(ok[k]/n*100):null;extra[k]=n?`${ok[k]} de ${n}`:''});
    return {z,extra,sin,total,conZona:total-sin,max:100,modo:'pct',color:'verde'}
  }
  base.forEach(e=>{if(!m.f(e))return;total++;if(!e.zona){sin++;return}z[e.zona]++});
  ZONAS.forEach(k=>max=Math.max(max,z[k]));
  const conZona=total-sin;
  ZONAS.forEach(k=>extra[k]=conZona>0?Math.round(z[k]/conZona*100)+'%':'0%');
  return {z,extra,sin,total,conZona,max,modo:'conteo',color:m.c}
}
/* SVG generado por código y con los estilos en atributos: así el mismo nodo sirve
   para la pantalla y para exportarlo a PNG sin arrastrar la hoja de estilos. */
function campoSVG(m,d,sel){
  // El campo ocupa la franja central; arriba y abajo quedan 16 px libres para
  // rotular las porterías sin pisar el área ni los números.
  const W=300,BAND=16,PH=420,H=PH+BAND*2,cw=100,ch=140,linea='#93b3a2';
  const cel=(i)=>({x:(i%3)*cw,y:BAND+Math.floor(i/3)*ch});
  const T=BAND+4,B=BAND+PH-4,MED=BAND+PH/2;
  let s=`<svg id="repField" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="100%" font-family="Manrope, 'DM Sans', Arial, sans-serif" style="display:block;width:100%;height:auto">`;
  s+=`<rect x="0" y="0" width="${W}" height="${H}" fill="#ffffff"/><rect x="0" y="${BAND}" width="${W}" height="${PH}" fill="#f2f7f4"/>`;
  ZONAS.forEach((zk,i)=>{
    const {x,y}=cel(i),v=d.z[zk];let fill='#f2f7f4';
    if(d.modo==='balance')fill=(v>=0?RAMPA.verde:RAMPA.rojo)[pasoDe(v,d.max||1)];
    else if(d.modo==='pct')fill=v===null?'#f2f7f4':RAMPA.verde[pasoDe(v,100)];
    else fill=RAMPA[d.color==='rojo'?'rojo':'verde'][pasoDe(v,d.max||1)];
    s+=`<rect data-zona="${zk}" x="${x}" y="${y}" width="${cw}" height="${ch}" fill="${fill}" style="cursor:pointer"/>`
  });
  // Marcas del campo por encima del sombreado: portería propia abajo.
  s+=`<rect x="4" y="${T}" width="${W-8}" height="${PH-8}" fill="none" stroke="${linea}" stroke-width="1.6"/>`;
  s+=`<line x1="4" y1="${MED}" x2="${W-4}" y2="${MED}" stroke="${linea}" stroke-width="1.6"/>`;
  s+=`<circle cx="${W/2}" cy="${MED}" r="40" fill="none" stroke="${linea}" stroke-width="1.6"/><circle cx="${W/2}" cy="${MED}" r="2.5" fill="${linea}"/>`;
  s+=`<rect x="72" y="${T}" width="156" height="52" fill="none" stroke="${linea}" stroke-width="1.6"/><rect x="112" y="${T}" width="76" height="22" fill="none" stroke="${linea}" stroke-width="1.6"/>`;
  s+=`<rect x="72" y="${B-52}" width="156" height="52" fill="none" stroke="${linea}" stroke-width="1.6"/><rect x="112" y="${B-22}" width="76" height="22" fill="none" stroke="${linea}" stroke-width="1.6"/>`;
  s+=`<rect x="126" y="${B-3}" width="48" height="6" rx="2" fill="#31098c"/>`;
  // Rejilla y etiquetas
  [1,2].forEach(i=>{s+=`<line x1="${i*cw}" y1="${T}" x2="${i*cw}" y2="${B}" stroke="#7f9d8d" stroke-width="1" stroke-dasharray="4 4"/>`;s+=`<line x1="4" y1="${BAND+i*ch}" x2="${W-4}" y2="${BAND+i*ch}" stroke="#7f9d8d" stroke-width="1" stroke-dasharray="4 4"/>`});
  ZONAS.forEach((zk,i)=>{
    const {x,y}=cel(i),v=d.z[zk],cx=x+cw/2,cy=y+ch/2;
    let paso=0;
    if(d.modo==='balance')paso=pasoDe(v,d.max||1);
    else if(d.modo==='pct')paso=v===null?0:pasoDe(v,100);
    else paso=pasoDe(v,d.max||1);
    const claro=paso>=4,cero=(d.modo==='pct'?v===null:!v);
    const colNum=claro?'#ffffff':(cero?'#9fada6':'#22303a');
    const colPct=claro?'#eaf7f0':'#6d7d75';
    const grande=d.modo==='balance'?(v>0?'+'+v:String(v)):(d.modo==='pct'?(v===null?'–':v+'%'):String(v));
    s+=`<text x="${cx}" y="${cy+2}" text-anchor="middle" font-size="30" font-weight="800" fill="${colNum}">${grande}</text>`;
    if(d.extra[zk])s+=`<text x="${cx}" y="${cy+21}" text-anchor="middle" font-size="12" font-weight="700" fill="${colPct}">${esc(d.extra[zk])}</text>`;
    s+=`<text x="${x+7}" y="${y+16}" font-size="10" font-weight="800" fill="${claro?'#ffffffcc':'#8b9a92'}">${ZONA_ETI[zk]}</text>`;
    if(sel===zk)s+=`<rect x="${x+2}" y="${y+2}" width="${cw-4}" height="${ch-4}" fill="none" stroke="#31098c" stroke-width="3"/>`
  });
  s+=`<text x="${W/2}" y="${H-4}" text-anchor="middle" font-size="9" font-weight="800" fill="#31098c" letter-spacing="1">NUESTRA PORTERÍA</text>`;
  s+=`<text x="${W/2}" y="11" text-anchor="middle" font-size="9" font-weight="800" fill="#8b9a92" letter-spacing="1">PORTERÍA RIVAL</text>`;
  return s+'</svg>'
}
function renderReportIfActive(){if($('#reportView')&&$('#reportView').classList.contains('active'))renderReport()}

function renderReport(){
  const m=metricaDe(repMetrica),d=datosMapa(m),L=state.live;
  const g=state.match.goals||[],own=g.filter(x=>x.team==='own').length,riv=g.filter(x=>x.team==='rival').length;
  const estado=L.finished?'Final del partido':(L.started?halfName(L.half)+' · '+fmtClock(L.elapsed):'Partido sin iniciar');
  $('#repScore').innerHTML=`<div class="rep-score-row"><img class="rep-crest" src="${crestSrc()}" alt="" /><span>${esc(state.club||'Equipo')}</span><b>${own} – ${riv}</b><span>${esc(state.match.opponent||'Rival')}</span></div><small>${esc(estado)}</small>`;
  $('#repMetricName').textContent=m.n+' · '+m.g.toLowerCase();

  // Selector de métrica agrupado
  const grupos=['Ataque','Defensa','Combinada'];
  $('#repMetric').innerHTML=grupos.map(gr=>`<optgroup label="${gr}">${METRICAS.filter(x=>x.g===gr).map(x=>`<option value="${x.id}"${x.id===repMetrica?' selected':''}>${esc(x.n)}</option>`).join('')}</optgroup>`).join('');

  // Filtros
  const jugadoresConDatos=state.players.filter(p=>eventosDelPartido().some(e=>e.jugadorId===p.id));
  $('#repFilterToggle').setAttribute('aria-expanded',String(repFiltrosAbiertos));
  $('#repFilterToggle').textContent=(repFiltrosAbiertos?'▴':'▾')+' Filtros'+(repJugador||repParte||repMinDe>0||repMinA<130?' · activos':'');
  $('#repFilters').hidden=!repFiltrosAbiertos;
  $('#repFilters').innerHTML=`
    <label>Jugador<select id="repF_jug"><option value="">Todos</option>${jugadoresConDatos.map(p=>`<option value="${p.id}"${repJugador===p.id?' selected':''}>${esc(p.name)}</option>`).join('')}</select></label>
    <label>Parte<select id="repF_parte"><option value="">Partido completo</option>${[1,2,3,4].filter(h=>h<=Math.max(2,L.half)).map(h=>`<option value="${h}"${repParte===String(h)?' selected':''}>${halfName(h)}</option>`).join('')}</select></label>
    <label>Desde el minuto<input id="repF_de" type="number" min="0" max="130" value="${repMinDe}" /></label>
    <label>Hasta el minuto<input id="repF_a" type="number" min="0" max="130" value="${repMinA}" /></label>
    <button type="button" class="text-btn" id="repF_reset">Quitar filtros</button>
    <p class="rep-note">Los filtros afectan al mapa y al resumen por zonas. Las tablas de equipo y de jugadores muestran el partido completo.</p>`;
  $('#repF_jug').onchange=e=>{repJugador=e.target.value;repZona=null;renderReport()};
  $('#repF_parte').onchange=e=>{repParte=e.target.value;repZona=null;renderReport()};
  $('#repF_de').onchange=e=>{repMinDe=Math.max(0,Math.min(130,+e.target.value||0));renderReport()};
  $('#repF_a').onchange=e=>{repMinA=Math.max(repMinDe,Math.min(130,+e.target.value||130));renderReport()};
  $('#repF_reset').onclick=()=>{repJugador='';repParte='';repMinDe=0;repMinA=130;repZona=null;renderReport()};

  // Campo
  if(d.total===0){
    $('#repFieldWrap').innerHTML=campoSVG(m,d,null)+'<p class="rep-empty">Sin datos para esta métrica.</p>';
  }else{
    $('#repFieldWrap').innerHTML=campoSVG(m,d,repZona);
  }
  $('#repFieldWrap').querySelectorAll('[data-zona]').forEach(r=>r.onclick=()=>{repZona=repZona===r.dataset.zona?null:r.dataset.zona;renderReport()});

  // Leyenda y escala
  const rampa=d.modo==='balance'?null:RAMPA[d.color==='rojo'?'rojo':'verde'];
  const escala=rampa
    ?rampa.map((c,i)=>`<i style="background:${c}"></i>`).join('')
    :RAMPA.rojo.slice(1).reverse().map(c=>`<i style="background:${c}"></i>`).join('')+RAMPA.verde.slice(1).map(c=>`<i style="background:${c}"></i>`).join('');
  $('#repLegend').innerHTML=`<div class="rep-scale">${escala}</div>
    <span class="rep-scale-tag">${d.modo==='balance'?'Regalamos el balón ← 0 → Lo robamos':'Menos ← → Más'}</span>
    <span class="rep-tot">${d.total} ${d.total===1?'evento':'eventos'}${d.sin?` · <b>${d.sin} sin zona asignada</b>`:''}</span>`;

  renderZoneDetail(m);
  renderTeamPanel();
  renderPlayersPanel();
  renderSummaryPanel(m,d);
  renderClassicPanel();
  $('#reportCount').textContent=eventosDelPartido().length
}

function renderZoneDetail(m){
  const box=$('#repZoneDetail');
  if(!repZona){box.innerHTML='<p class="rep-hint">Toca un cuadrante para ver sus eventos y corregirlos.</p>';return}
  const lista=eventosFiltrados().filter(e=>e.zona===repZona).sort((a,b)=>(a.minuto||0)-(b.minuto||0));
  box.innerHTML=`<div class="rz-head"><strong>${ZONA_ETI[repZona]} · ${esc(ZONA_NOM[repZona])}</strong><span>${lista.length} ${lista.length===1?'evento':'eventos'}</span></div>`
    +(lista.length?`<ul class="rz-list">${lista.map(e=>eventoFilaHTML(e)).join('')}</ul>`:'<p class="rep-hint">Sin eventos en esta zona con el filtro actual.</p>');
  bindEventoFilas(box)
}
function eventoFilaHTML(e){
  const quien=e.ambito==='equipo'?'Equipo':(e.jugadorId?nombreDe(e.team,e.jugadorId):'—');
  return `<li data-ev-row="${e.id}"><span class="rz-min">${e.minuto?e.minuto+'′':'–'}</span><span class="rz-tipo">${EVENTO_IC[e.tipo]||''} ${esc(EVENTO_NOM[e.tipo]||e.tipo)}</span><span class="rz-quien">${esc(quien)}</span><span class="rz-zona">${e.zona?ZONA_ETI[e.zona]:'sin zona'}</span><button type="button" class="rz-btn" data-ev-zone="${e.id}" title="Cambiar zona">✎</button><button type="button" class="rz-btn del" data-ev-del="${e.id}" title="Borrar evento">×</button></li>`
}
function bindEventoFilas(box){
  box.querySelectorAll('[data-ev-del]').forEach(b=>b.onclick=()=>{
    if(confirm('¿Borrar este evento del partido?'))borrarEvento(b.dataset.evDel)
  });
  box.querySelectorAll('[data-ev-zone]').forEach(b=>b.onclick=()=>{
    const id=b.dataset.evZone,ev=state.live.events.find(x=>x.id===id);if(!ev)return;
    const fila=box.querySelector(`[data-ev-row="${id}"]`);
    const cont=document.createElement('div');cont.className='rz-edit';
    cont.innerHTML=zonaGridHTML('Cambiar zona',EVENTO_NOM[ev.tipo]||'',ev.zona);
    fila.replaceWith(cont);
    bindZonaGrid(cont,z=>{cambiarZonaEvento(id,z);showToast(z?('Zona cambiada a '+ZONA_ETI[z]):'Evento sin zona')},()=>refrescarPaneles())
  })
}

/* 4.2 Panel de equipo: totales del partido con el nombre completo de cada métrica
   y los dos ratios que el entrenador mira solos. */
function renderTeamPanel(){
  const ev=eventosDelPartido().filter(e=>e.team!=='rival');
  const n=t=>ev.filter(e=>e.tipo===t).length;
  const perdFranja=f=>ev.filter(e=>e.tipo==='perdida'&&zonaFranja(e.zona)===f).length;
  const ataque=[['Llegadas al área',n('llegada_area')],['Tiros a puerta',n('tiro_puerta')],['Centros con remate',n('centro_remate')],['2x1 con centro al área',n('dos_por_uno')],['Ataques a la profundidad',n('profundidad')]];
  const defensa=[['Pérdidas en inicio de juego',perdFranja('def')],['Pérdidas en zona media',perdFranja('med')],['Errores en despeje',n('error_despeje')],['Llegadas del rival',n('llegada_rival')],['Pases fallidos',n('pase_fallido')]];
  const llegadas=n('llegada_area'),llegadasR=n('llegada_rival'),tiros=n('tiro_puerta');
  const dominio=llegadasR?(llegadas/llegadasR).toFixed(2).replace('.',','):(llegadas?'—':'0');
  const eficacia=llegadas?(tiros/llegadas*10).toFixed(1).replace('.',','):'—';
  const col=(t,filas)=>`<div class="rt-col"><h4>${t}</h4><ul>${filas.map(([k,v])=>`<li><span>${k}</span><b>${v}</b></li>`).join('')}</ul></div>`;
  $('#repTeam').innerHTML=`<div class="rep-card-head"><span class="eyebrow">EQUIPO</span><h3>Totales del partido</h3></div>
    <div class="rt-cols">${col('Ataque',ataque)}${col('Defensa',defensa)}</div>
    <div class="rt-ratios">
      <div><span>Dominio del partido</span><b>${llegadas} – ${llegadasR}</b><small>llegadas al área propias vs. del rival${llegadasR?` · ${dominio}×`:''}</small></div>
      <div><span>Eficacia en finalización</span><b>${eficacia}</b><small>tiros a puerta por cada 10 llegadas al área</small></div>
    </div>`
}

/* 4.3 Panel individual: nombres escritos, nunca iconos sueltos. En móvil hay
   scroll horizontal con la columna del jugador fija y se ocultan las columnas
   que no tienen ningún dato en este partido. */
const COLS_JUG=[
  {t:'gol',n:'Goles'},{t:'asistencia',n:'Asistencias'},{t:'tiro_puerta',n:'Tiros a puerta'},
  {t:'regate_ok',n:'Regates exitosos'},{t:'regate_fallo',n:'Regates fallidos'},{t:'pct',n:'% acierto en regate'},
  {t:'recuperacion',n:'Recuperaciones'},{t:'perdida',n:'Pérdidas'},{t:'pase_fallido',n:'Pases fallidos'},
  {t:'centro_remate',n:'Centros con remate'},{t:'error_despeje',n:'Errores en despeje'},{t:'profundidad',n:'Ataques a la profundidad'},
  {t:'foul_won',n:'Faltas recibidas'},{t:'foul_made',n:'Faltas cometidas'},{t:'save',n:'Paradas'},
  {t:'yellow',n:'Tarjetas amarillas'},{t:'red',n:'Tarjetas rojas'}
];
function conteoJugador(id){
  const c={};eventosDelPartido().filter(e=>e.jugadorId===id&&e.team!=='rival').forEach(e=>c[e.tipo]=(c[e.tipo]||0)+1);
  const int=(c.regate_ok||0)+(c.regate_fallo||0);
  c.pct=int?Math.round((c.regate_ok||0)/int*100):null;
  return c
}
function renderPlayersPanel(){
  const conDatos=state.players.filter(p=>eventosDelPartido().some(e=>e.jugadorId===p.id&&e.team!=='rival'));
  if(!conDatos.length){$('#repPlayers').innerHTML='<div class="rep-card-head"><span class="eyebrow">JUGADORES</span><h3>Estadísticas individuales</h3></div><p class="rep-hint">Todavía no hay acciones registradas de ningún jugador.</p>';return}
  const cont=conDatos.map(p=>({p,c:conteoJugador(p.id)}));
  const cols=COLS_JUG.filter(col=>cont.some(x=>col.t==='pct'?x.c.pct!==null:(x.c[col.t]||0)>0));
  const cab=cols.map(c=>`<th>${c.n}</th>`).join('');
  const filas=cont.map(({p,c})=>`<tr data-jug="${p.id}"><th scope="row">${esc(p.name)}<small>${esc(p.position)}</small></th>${cols.map(col=>{
    const v=col.t==='pct'?(c.pct===null?'—':c.pct+'%'):(c[col.t]||0);
    return `<td class="${(col.t!=='pct'&&!c[col.t])?'cero':''}">${v}</td>`
  }).join('')}</tr>`).join('');
  $('#repPlayers').innerHTML=`<div class="rep-card-head"><span class="eyebrow">JUGADORES</span><h3>Estadísticas individuales</h3></div>
    <p class="rep-hint">Toca un jugador para ver su desglose por zonas y su listado de eventos.</p>
    <div class="rep-table-wrap"><table class="rep-table"><thead><tr><th scope="col">Jugador</th>${cab}</tr></thead><tbody>${filas}</tbody></table></div>`;
  $('#repPlayers').querySelectorAll('[data-jug]').forEach(tr=>tr.onclick=()=>openStats(tr.dataset.jug,'own'))
}

/* 4.4 Resumen en texto: lo que el entrenador diría en el vestuario. */
function topZonas(tipo,base){
  const c={};ZONAS.forEach(z=>c[z]=0);let tot=0;
  base.filter(e=>e.tipo===tipo&&e.zona).forEach(e=>{c[e.zona]++;tot++});
  return {lista:ZONAS.filter(z=>c[z]>0).sort((a,b)=>c[b]-c[a]).slice(0,3).map(z=>({z,v:c[z],pct:tot?Math.round(c[z]/tot*100):0})),tot}
}
function frasesResumen(){
  const base=eventosFiltrados(),lin=[];
  const per=topZonas('perdida',base),rec=topZonas('recuperacion',base),riv=topZonas('llegada_rival',base);
  const frase=(t,d)=>d.lista.length?`${t} ${d.lista.map(x=>`${ZONA_ETI[x.z]} (${ZONA_NOM[x.z].toLowerCase()}): ${x.v}, ${x.pct}%`).join(' · ')}`:null;
  const f1=frase('Se pierde sobre todo en',per);if(f1)lin.push(f1);
  const f2=frase('Se recupera sobre todo en',rec);if(f2)lin.push(f2);
  if(riv.lista.length)lin.push(`El rival llega sobre todo por ${ZONA_ETI[riv.lista[0].z]} (${ZONA_NOM[riv.lista[0].z].toLowerCase()}): ${riv.lista[0].v} llegadas, ${riv.lista[0].pct}%`);
  const franjas=['def','med','ata'].map(f=>({f,v:base.filter(e=>e.tipo==='perdida'&&zonaFranja(e.zona)===f).length}));
  const totF=franjas.reduce((a,b)=>a+b.v,0);
  if(totF)lin.push('Reparto de pérdidas: '+franjas.map(x=>`${FRANJA_NOM[x.f]} ${x.v} (${Math.round(x.v/totF*100)}%)`).join(' · '));
  const sinZona=base.filter(e=>!e.zona).length;
  lin.push(sinZona?`${sinZona} ${sinZona===1?'evento registrado sin zona asignada':'eventos registrados sin zona asignada'}`:'Todos los eventos tienen zona asignada');
  return lin
}
function renderSummaryPanel(){
  const lin=frasesResumen();
  $('#repSummary').innerHTML=`<div class="rep-card-head"><span class="eyebrow">LECTURA DEL PARTIDO</span><h3>Resumen</h3></div>
    <ul class="rs-list">${lin.map(t=>`<li>${esc(t)}</li>`).join('')}</ul>`
}

/* Bloque clásico: goles, minutos y cambios, tal como estaban. */
function datosClasicos(){
  const g=state.match.goals||[],L=state.live;
  const goals=g.slice().sort((a,b)=>(a.min||999)-(b.min||999));
  const ids=new Set(Object.keys(L.minutes).filter(id=>(L.minutes[id]||0)>0));
  tactic().placed.forEach(pp=>ids.add(pp.playerId));
  const minutes=[...ids].map(id=>({id,name:nombreDe('own',id),secs:L.minutes[id]||0})).filter(x=>x.name!=='—').sort((a,b)=>b.secs-a.secs);
  const subs=L.events.filter(e=>e.tipo==='sub').sort((a,b)=>(a.minuto||0)-(b.minuto||0));
  return {goals,minutes,subs,own:g.filter(x=>x.team==='own').length,riv:g.filter(x=>x.team==='rival').length}
}
function renderClassicPanel(){
  const r=datosClasicos();
  const goles=r.goals.length?r.goals.map(x=>{
    const a=x.assistId?` <i>(asist. ${esc(nombreDe(x.team,x.assistId))})</i>`:'';
    return `<li><span class="r-min">${x.min?x.min+'′':'–'}</span><span class="r-side ${x.team}"></span>⚽ <strong>${esc(nombreDe(x.team,x.scorerId))}</strong>${a}</li>`
  }).join(''):'<li class="tr-empty">Sin goles registrados.</li>';
  const mins=r.minutes.length?r.minutes.map(m=>`<li><strong>${esc(m.name)}</strong><span class="r-min-val">${Math.floor(m.secs/60)}′</span></li>`).join(''):'<li class="tr-empty">Sin minutos registrados.</li>';
  const cambios=r.subs.length?`<div class="r-block"><h4>Cambios</h4><ul class="r-list">${r.subs.map(s=>`<li><span class="r-min">${s.minuto?s.minuto+'′':'–'}</span>▶ <strong>${esc(nombreDe('own',s.inId))}</strong> ◀ ${esc(nombreDe('own',s.outId))}</li>`).join('')}</ul></div>`:'';
  $('#repClassic').innerHTML=`<div class="rep-card-head"><span class="eyebrow">PARTIDO</span><h3>Goles, minutos y cambios</h3></div>
    <div class="r-block"><h4>Goles</h4><ul class="r-list r-goals">${goles}</ul></div>
    <div class="r-block"><h4>Minutos jugados</h4><ul class="r-list r-minutes">${mins}</ul></div>${cambios}`
}

/* Ficha del jugador: desglose por zonas y listado cronológico, con corrección. */
let statsTarget=null;
function openStats(id,team='own'){statsTarget={id,team};renderStats();$('#statsDialog').showModal()}
function renderStats(){
  if(!statsTarget)return;
  const {id,team}=statsTarget;
  $('#statsTitle').textContent=nombreDe(team,id);
  const lista=eventosDelPartido().filter(e=>e.jugadorId===id&&e.team===team).sort((a,b)=>(a.minuto||0)-(b.minuto||0));
  const c=conteoJugador(id);
  const resumen=COLS_JUG.filter(col=>col.t==='pct'?c.pct!==null:(c[col.t]||0)>0)
    .map(col=>`<li><span>${col.n}</span><b>${col.t==='pct'?c.pct+'%':c[col.t]}</b></li>`).join('')||'<li class="tr-empty">Sin acciones registradas.</li>';
  const porZona=ZONAS.map(z=>({z,v:lista.filter(e=>e.zona===z).length}));
  const sin=lista.filter(e=>!e.zona).length,maxZ=Math.max(1,...porZona.map(x=>x.v));
  const zonas=`<div class="st-zonas">${porZona.map(x=>`<div class="st-z" style="background:${RAMPA.verde[pasoDe(x.v,maxZ)]}"><b>${x.v}</b><i>${ZONA_ETI[x.z]}</i></div>`).join('')}</div>`
    +(sin?`<p class="rep-hint">${sin} sin zona asignada.</p>`:'');
  $('#statsBody').innerHTML=`<div class="st-block"><h4>Totales</h4><ul class="rs-tot">${resumen}</ul></div>
    <div class="st-block"><h4>Reparto por zonas</h4>${zonas}</div>
    <div class="st-block"><h4>Eventos del partido</h4>${lista.length?`<ul class="rz-list">${lista.map(e=>eventoFilaHTML(e)).join('')}</ul>`:'<p class="rep-hint">Sin eventos registrados.</p>'}</div>`;
  bindEventoFilas($('#statsBody'))
}
$$('.close-stats').forEach(b=>b.onclick=()=>{$('#statsDialog').close();statsTarget=null});

/* 4.5 Exportación: el campo como PNG para pegarlo en el grupo del cuerpo técnico. */
function svgAImagen(svgTexto,w,h){
  return new Promise((ok,ko)=>{
    const url=URL.createObjectURL(new Blob([svgTexto],{type:'image/svg+xml;charset=utf-8'})),img=new Image();
    img.onload=()=>{URL.revokeObjectURL(url);ok(img)};
    img.onerror=()=>{URL.revokeObjectURL(url);ko(new Error('svg'))};
    img.width=w;img.height=h;img.src=url
  })
}
function descargarCanvas(c,nombre){
  c.toBlob(async b=>{
    if(!b){showToast('No se ha podido generar la imagen',3000);return}
    // En el móvil se comparte directamente al grupo del cuerpo técnico; en el PC
    // se descarga, que es lo que el navegador de escritorio sabe hacer.
    const f=typeof File!=='undefined'?new File([b],nombre,{type:'image/png'}):null;
    if(f&&navigator.canShare&&navigator.canShare({files:[f]})){
      try{await navigator.share({files:[f],title:'Informe del partido'});return}catch(e){if(e&&e.name==='AbortError')return}
    }
    const a=document.createElement('a'),u=URL.createObjectURL(b);
    a.href=u;a.download=nombre;a.click();
    setTimeout(()=>URL.revokeObjectURL(u),1500);showToast('Imagen descargada')
  },'image/png')
}
function svgActual(){
  const m=metricaDe(repMetrica),d=datosMapa(m);
  // Sin cuadrante seleccionado (la imagen se comparte sin contexto) y con medidas
  // fijas: un SVG al 100% no tiene tamaño propio y no todos los navegadores lo
  // saben dibujar sobre un canvas.
  const svg=campoSVG(m,d,null).replace('width="100%"',`width="${CAMPO_W}" height="${CAMPO_H}"`).replace(' style="display:block;width:100%;height:auto"','');
  return {svg,m,d}
}
async function exportarCampoPNG(){
  const {svg,m,d}=svgActual(),W=640,HC=Math.round(W/CAMPO_W*CAMPO_H);
  try{
    const img=await svgAImagen(svg,CAMPO_W,CAMPO_H);
    const c=document.createElement('canvas');c.width=W;c.height=HC+96;
    const x=c.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,c.width,c.height);
    cabeceraPNG(x,W,m);
    x.drawImage(img,0,80,W,HC);
    pieePNG(x,W,HC+80,d);
    descargarCanvas(c,`mapa-${m.id}.png`)
  }catch(e){showToast('No se ha podido generar la imagen',3000)}
}
function cabeceraPNG(x,W,m){
  const g=state.match.goals||[];
  x.fillStyle='#31098c';x.font='800 22px Manrope, Arial, sans-serif';x.textAlign='center';
  x.fillText(`${state.club||'Equipo'} ${g.filter(v=>v.team==='own').length} – ${g.filter(v=>v.team==='rival').length} ${state.match.opponent||'Rival'}`,W/2,32);
  x.fillStyle='#4a4557';x.font='700 15px Arial, sans-serif';
  x.fillText(m.n+(repJugador?' · '+nombreDe('own',repJugador):'')+(repParte?' · '+halfName(+repParte):''),W/2,58)
}
function pieePNG(x,W,y,d){
  x.fillStyle='#6d7d75';x.font='600 13px Arial, sans-serif';x.textAlign='center';
  x.fillText(`${d.total} eventos${d.sin?` · ${d.sin} sin zona asignada`:''}`,W/2,y+22)
}
async function exportarResumenPNG(){
  const {svg,m,d}=svgActual(),W=640,HC=Math.round(560/CAMPO_W*CAMPO_H);
  const ev=eventosDelPartido().filter(e=>e.team!=='rival'),n=t=>ev.filter(e=>e.tipo===t).length;
  const perdF=f=>ev.filter(e=>e.tipo==='perdida'&&zonaFranja(e.zona)===f).length;
  const filas=[['Llegadas al área',n('llegada_area')],['Tiros a puerta',n('tiro_puerta')],['Centros con remate',n('centro_remate')],['2x1 con centro al área',n('dos_por_uno')],['Ataques a la profundidad',n('profundidad')],
    ['Pérdidas en inicio de juego',perdF('def')],['Pérdidas en zona media',perdF('med')],['Pérdidas en campo rival',perdF('ata')],['Errores en despeje',n('error_despeje')],['Llegadas del rival',n('llegada_rival')],['Pases fallidos',n('pase_fallido')]];
  try{
    const img=await svgAImagen(svg,CAMPO_W,CAMPO_H);
    const alto=100+HC+30+filas.length*28+40;
    const c=document.createElement('canvas');c.width=W;c.height=alto;
    const x=c.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,W,alto);
    cabeceraPNG(x,W,m);
    x.drawImage(img,40,80,560,HC);
    pieePNG(x,W,HC+72,d);
    let y=100+HC+30;
    x.textAlign='left';x.fillStyle='#31098c';x.font='800 14px Arial, sans-serif';
    x.fillText('TOTALES DEL EQUIPO',40,y);y+=22;
    filas.forEach(([k,v])=>{
      x.fillStyle='#f4f2f8';x.fillRect(40,y-14,560,24);
      x.fillStyle='#3a3550';x.font='600 14px Arial, sans-serif';x.fillText(k,50,y+3);
      x.fillStyle='#31098c';x.font='800 15px Arial, sans-serif';x.textAlign='right';x.fillText(String(v),590,y+3);x.textAlign='left';
      y+=28
    });
    descargarCanvas(c,`informe-${m.id}.png`)
  }catch(e){showToast('No se ha podido generar la imagen',3000)}
}
function reportText(){
  const r=datosClasicos(),ev=eventosDelPartido().filter(e=>e.team!=='rival'),n=t=>ev.filter(e=>e.tipo===t).length,lin=[];
  const perdF=f=>ev.filter(e=>e.tipo==='perdida'&&zonaFranja(e.zona)===f).length;
  lin.push(`*${(state.club||'Equipo').toUpperCase()}* ${r.own}-${r.riv} *${(state.match.opponent||'RIVAL').toUpperCase()}*`);
  const L=state.live,st=L.finished?'Final del partido':(L.started?halfName(L.half)+' · '+fmtClock(L.elapsed):'');
  if(st)lin.push(st);
  if(r.goals.length){lin.push('','*GOLES*');r.goals.forEach(x=>{const a=x.assistId?` (asist. ${nombreDe(x.team,x.assistId)})`:'';lin.push(`${x.min?x.min+"' ":''}${x.team==='rival'?'[R] ':''}${nombreDe(x.team,x.scorerId)}${a}`)})}
  lin.push('','*EQUIPO*');
  [['Llegadas al área','llegada_area'],['Tiros a puerta','tiro_puerta'],['Centros con remate','centro_remate'],['2x1 con centro al área','dos_por_uno'],['Ataques a la profundidad','profundidad'],['Errores en despeje','error_despeje'],['Llegadas del rival','llegada_rival'],['Pases fallidos','pase_fallido']]
    .forEach(([k,t])=>lin.push(`${k}: ${n(t)}`));
  lin.push(`Pérdidas en inicio de juego: ${perdF('def')}`,`Pérdidas en zona media: ${perdF('med')}`,`Pérdidas en campo rival: ${perdF('ata')}`);
  const conDatos=state.players.filter(p=>ev.some(e=>e.jugadorId===p.id));
  if(conDatos.length){
    lin.push('','*JUGADORES*');
    conDatos.forEach(p=>{
      const c=conteoJugador(p.id);
      const partes=COLS_JUG.filter(col=>col.t!=='pct'&&c[col.t]).map(col=>`${col.n} ${c[col.t]}`);
      if(c.pct!==null)partes.push(`% acierto en regate ${c.pct}%`);
      if(partes.length)lin.push(`${p.name}: ${partes.join(', ')}`)
    })
  }
  if(r.minutes.length){lin.push('','*MINUTOS*');r.minutes.forEach(m=>lin.push(`${Math.floor(m.secs/60)}' · ${m.name}`))}
  if(r.subs.length){lin.push('','*CAMBIOS*');r.subs.forEach(s=>lin.push(`${s.minuto?s.minuto+"' ":''}Entra ${nombreDe('own',s.inId)}, sale ${nombreDe('own',s.outId)}`))}
  lin.push('','*LECTURA DEL PARTIDO*');frasesResumen().forEach(t=>lin.push('· '+t));
  return lin.join('\n')
}
function openReport(){switchView('report')}
$('#repMetric').onchange=e=>{repMetrica=e.target.value;repZona=null;renderReport()};
$('#repFilterToggle').onclick=()=>{repFiltrosAbiertos=!repFiltrosAbiertos;renderReport()};
$('#repPng').onclick=exportarCampoPNG;
$('#repPngFull').onclick=exportarResumenPNG;
$('#repCopy').onclick=async()=>{try{await navigator.clipboard.writeText(reportText());showToast('Informe copiado')}catch(e){showToast('No se pudo copiar el informe',2500)}};
$('#repSend').onclick=()=>window.open('https://wa.me/?text='+encodeURIComponent(reportText()),'_blank','noopener');
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
/* ===== Eventos en subcolección =====
   Un documento por evento en `pizarras/{clave}/eventos`. Tres motivos:
   1) El documento de la pizarra no puede pasar de 1 MB y un partido largo suma
      cientos de eventos.
   2) Dos dispositivos con la misma clave pueden registrar a la vez: cada uno
      escribe SUS documentos y ninguno pisa el array del otro.
   3) La persistencia de Firestore encola las escrituras sin cobertura y las
      sube sola al recuperar red, que es como se trabaja a pie de campo.
   En el documento grande se sigue guardando todo lo demás; los eventos se
   quitan de ese JSON para no tener dos copias que se contradigan. */
function eventosRef(){return boardRef?boardRef.collection('eventos'):null}
function limpioParaNube(o){const d={};Object.keys(o).forEach(k=>{if(o[k]!==undefined)d[k]=o[k]});return d}
function cloudSaveEvent(ev){
  const r=eventosRef();if(!r)return;
  r.doc(ev.id).set(limpioParaNube(ev)).catch(e=>console.warn('Evento sin sincronizar:',e))
}
function cloudDeleteEvent(id){const r=eventosRef();if(!r)return;r.doc(id).delete().catch(()=>{})}
// Restaurar una copia de seguridad sustituye también los eventos de la nube: si
// no, los del partido anterior seguirían llegando desde la subcolección.
function reemplazarEventosEnNube(){
  const r=eventosRef();if(!r)return;
  const nuevos=state.live.events.slice(),vivos=new Set(nuevos.map(e=>e.id));
  r.get().then(s=>s.docs.forEach(d=>{if(!vivos.has(d.id))d.ref.delete().catch(()=>{})})).catch(()=>{});
  nuevos.forEach(cloudSaveEvent)
}
function limpiarEventos(){
  const ids=state.live.events.map(e=>e.id),r=eventosRef();
  state.live.events=[];
  // Firestore corta los lotes en 500 operaciones.
  if(r&&ids.length)for(let i=0;i<ids.length;i+=400){
    const b=db.batch();ids.slice(i,i+400).forEach(id=>b.delete(r.doc(id)));b.commit().catch(()=>{})
  }
}
let evUnsub=null,evPrimeraCarga=true;
function subscribeEvents(){
  if(evUnsub){evUnsub();evUnsub=null}
  const r=eventosRef();if(!r)return;
  evPrimeraCarga=true;
  evUnsub=r.onSnapshot(snap=>{
    const L=state.live;let cambio=false;
    snap.docChanges().forEach(ch=>{
      const i=L.events.findIndex(e=>e.id===ch.doc.id);
      if(ch.type==='removed'){if(i>=0){L.events.splice(i,1);cambio=true}return}
      const ev=normalizeEvent(Object.assign({},ch.doc.data(),{id:ch.doc.id}));
      if(i>=0)L.events[i]=ev;else L.events.push(ev);
      cambio=true
    });
    if(evPrimeraCarga){
      evPrimeraCarga=false;
      // Eventos que solo están aquí: partidos anteriores a esta versión o
      // registrados sin Firebase disponible. Se suben una única vez.
      const remotos=new Set(snap.docs.map(d=>d.id));
      L.events.filter(e=>!remotos.has(e.id)).forEach(cloudSaveEvent)
    }
    if(!cambio)return;
    L.events.sort((a,b)=>(a.ts||0)-(b.ts||0)||(a.minuto||0)-(b.minuto||0));
    saveLocal();renderScoreboard();refrescarPaneles();
    $('#reportCount').textContent=eventosDelPartido().length
  },e=>console.warn('Eventos sin sincronizar:',e))
}
function pushToCloud(){
  // Los eventos viajan por su subcolección, así que no van en este JSON.
  const json=JSON.stringify(eventosRef()?Object.assign({},state,{live:Object.assign({},state.live,{events:[]})}):state);
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
  let nuevo;
  try{nuevo=normalizeState(JSON.parse(json))}catch(e){return}
  // Los eventos los manda la subcolección, no este documento: si se aplicase el
  // array vacío que viaja en el JSON se perderían los del otro dispositivo.
  if(eventosRef())nuevo.live.events=state.live.events;
  state=nuevo;
  // La pila de deshacer es de este dispositivo y se queda obsoleta: aplicarla
  // encima de lo que acaba de mandar otro resucitaría lo que allí se borró.
  undoStack=[];
  saveLocal();refreshMatchInputs();renderAll();setSync(true)
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
  subscribeEvents();
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
    state=copia;refreshMatchInputs();renderAll();persist(true);reemplazarEventosEnNube()
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
