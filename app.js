const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const STORAGE = 'udt-coach-v1';
const formations={
  '4-3-3':[[50,88],[17,72],[38,75],[62,75],[83,72],[26,52],[50,58],[74,52],[19,27],[50,20],[81,27]],
  '4-2-3-1':[[50,89],[17,73],[38,76],[62,76],[83,73],[38,59],[62,59],[18,39],[50,42],[82,39],[50,20]],
  '4-4-2':[[50,89],[17,73],[38,76],[62,76],[83,73],[16,48],[39,53],[61,53],[84,48],[37,23],[63,23]],
  '3-5-2':[[50,89],[25,72],[50,76],[75,72],[12,50],[35,56],[50,47],[65,56],[88,50],[37,23],[63,23]],
  '3-4-3':[[50,89],[25,72],[50,76],[75,72],[18,50],[40,55],[60,55],[82,50],[18,25],[50,20],[82,25]]
};
/* Plantilla de ejemplo de una pizarra nueva.
   Antes eran los doce jugadores REALES de la UD Tamaraceite, con sus nombres y
   sus notas médicas ("Molestias leves", "Recuperación muscular"). Eso lo veía
   cualquiera que estrenase una clave: datos de personas reales en la pizarra de
   un desconocido. Ahora son once puestos genéricos, que además explican solos
   para qué sirve cada campo.
   Siguen siendo DOCE ids (p0…p11) aunque los puestos titulares sean once:
   seedTrainings() reparte jugadores por estación y llega hasta 'p11'. Con once
   fichas esas estaciones quedarían señalando a un jugador que no existe. */
const seedPlayers=[
  ['Portero',1,'Portero'],['Lateral derecho',2,'Lateral'],['Central diestro',4,'Defensa'],['Central zurdo',5,'Defensa'],['Lateral izquierdo',3,'Lateral'],['Pivote',6,'Mediocentro'],['Interior derecho',8,'Mediocentro'],['Interior izquierdo',10,'Mediocentro'],['Extremo derecho',7,'Extremo'],['Extremo izquierdo',11,'Extremo'],['Delantero centro',9,'Delantero'],['Portero suplente',13,'Portero']
].map((p,i)=>({id:'p'+i,name:p[0],number:p[1],position:p[2],status:'available',notes:'',photo:''}));
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
/* fila 1-3 (defensivo → ofensivo) y carril 1-3 (izquierda → derecha). El id de
   zona ya lo dice todo, pero se guardan también como número en cada evento
   nuevo: es lo que pide el informe y lo que se lee sin diccionario en el JSON
   de la copia de seguridad. Derivados, nunca la fuente: manda `zona`. */
const ZONA_FILA={def:1,med:2,ata:3},ZONA_CARRIL={izq:1,cen:2,der:3};
const filaDe=z=>z?ZONA_FILA[z.slice(0,3)]||null:null;
const carrilDe=z=>z?ZONA_CARRIL[z.slice(4)]||null:null;

/* ===== Catálogo de eventos =====
   Los cuatro primeros de cada pestaña son los originales (los más frecuentes),
   por eso encabezan la lista. `zona:false` guarda directamente, sin preguntar.
   Los tipos en inglés son los de la versión anterior y se traducen al cargar. */
const EVENTOS=[
  {t:'regate_ok',     n:'Regate exitoso',              ic:'💫', g:'of',  zona:true},
  {t:'regate_fallo',  n:'Regate fallido',              ic:'⛔', g:'of',  zona:true},
  /* Gol y asistencia siguen aquí porque el informe usa esta tabla para sus
     nombres, iconos y columnas, y los partidos ya guardados tienen eventos de
     estos tipos. Pero salen de la rejilla del menú (oculto): había dos formas
     de apuntar un gol, una con asistencia y otra con zona, y cada una dejaba
     el informe a medias. Ahora solo se apunta desde "Asignar gol", que pide
     las dos cosas de una vez. */
  {t:'gol',           n:'Gol',                         ic:'⚽', g:'of',  zona:true, oculto:true},
  {t:'asistencia',    n:'Asistencia',                  ic:'🤝', g:'of',  zona:true, oculto:true},
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
// `directo:true` = nacidos en el modo en directo. No salen en el panel ⚑ Equipo
// de la pizarra (allí seguirían los tres de siempre) porque su sitio es la
// rejilla de la pantalla completa, donde se registran en dos pulsaciones.
const EVENTOS_EQUIPO=[
  {t:'llegada_area',  n:'Llegada al área',             ic:'🥅', zona:true, ayuda:'Carril de origen de la jugada'},
  {t:'llegada_rival', n:'Llegada del rival',           ic:'⚠️', zona:true, ayuda:'Zona por la que llega: los 9 cuadrantes'},
  {t:'dos_por_uno',   n:'2x1 con centro al área',      ic:'👥', zona:true, ayuda:'Carril de origen'},
  {t:'llegada_banda', n:'Llegada por banda',           ic:'↗',  zona:true, directo:true},
  {t:'duelo_ganado',  n:'Duelo ganado',                ic:'💪', zona:true, directo:true},
  {t:'duelo_perdido', n:'Duelo perdido',               ic:'🥊', zona:true, directo:true},
  {t:'ocasion_conc',  n:'Ocasión concedida',           ic:'❗', zona:true, directo:true},
  {t:'corner_favor',  n:'Córner a favor',              ic:'⛳', zona:false, directo:true},
  {t:'corner_contra', n:'Córner en contra',            ic:'🚩', zona:false, directo:true}
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
  // Se recalculan siempre desde la zona: así un evento al que se le corrige el
  // cuadrante desde el informe no se queda con la fila y el carril antiguos.
  e.fila=filaDe(e.zona);e.carril=carrilDe(e.zona);
  e.partidoId=e.partidoId||null;
  if(e.minuto===undefined)e.minuto=e.min??null;
  if(e.parte===undefined)e.parte=e.half||1;
  e.origen=e.origen||'legado';
  e.ts=e.ts||0;
  e.team=e.team||'own';
  e.id=e.id||('e'+Date.now().toString(36)+Math.random().toString(36).slice(2,6));
  return e
}
/* El partido arranca en blanco. Antes venía relleno con el contexto de la UD
   Tamaraceite (rival "CD Mensajero", "Tercera Federación", campo "Juan Guedes"):
   en la pizarra de otro club eso no es un ejemplo útil, es un dato falso que hay
   que acordarse de borrar antes de mandar la convocatoria por WhatsApp. */
function defaultState(){return {players:seedPlayers.map(p=>({...p})),tactics:[{id:'t1',name:'Táctica 1',formation:'4-3-3',placed:[],arrows:[]}],activeTactic:'t1',match:{opponent:'',competition:'',date:'',venue:''}}}
function normalizeState(s){
  s.players||=[];s.match||={opponent:'',competition:'',date:'',venue:''};
  s.tactics||=[{id:'t1',name:'Táctica 1',formation:'4-3-3',placed:[],arrows:[]}];
  if(!s.tactics.find(t=>t.id===s.activeTactic))s.activeTactic=s.tactics[0].id;
  s.rivals ||= [['Portero rival',1,'Portero'],['Central rival',4,'Defensa'],['Lateral rival',2,'Lateral'],['Mediocentro rival',6,'Mediocentro'],['Delantero rival',9,'Delantero']].map((p,i)=>({id:'r'+i,name:p[0],number:p[1],position:p[2],status:'available',notes:'',photo:''}));
  s.rivalColors ||= {primary:'#20232b',secondary:'#ffbd35'};
  /* Vacío, no "UD Tamaraceite". Con ||= cualquier pizarra que no hubiese pasado
     por "Datos del club" se rotulaba sola con el nombre de un club real ajeno.
     Vacío además es la señal que usa el diálogo de bienvenida para saber que
     esta pizarra todavía no tiene identidad; applyBrand() ya pinta "Equipo"
     mientras tanto, así que la cabecera nunca se queda en blanco.
     Ojo: ??= y no ||=, para no pisar un nombre que el usuario haya guardado. */
  s.club ??= '';
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
  // Identificador del partido: se sella en cada evento para que el informe (que
  // es por partido) y el JSON de la copia sepan a cuál pertenece cada acción.
  L.matchId=L.matchId||'';
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
const VIEW_TITLES={board:'Pizarra táctica',squad:'Gestión de plantilla',training:'Entrenamientos',rival:'Análisis del rival',report:'Informe del partido',matches:'Partidos jugados'};
/* El rótulo pequeño de la cabecera ("PARTIDO · PLANIFICACIÓN" y sus hermanos) lo
   sustituye ahora el logo de la app. No se pierde nada: repetía en mayúsculas lo
   que el h1 de debajo ya dice, mientras que ese h1 sí hace falta —en móvil la
   barra lateral se esconde tras el ☰ y el título es la única pista de en qué
   sección estás—, así que el h1 se queda y el adorno deja su sitio a la marca. */
function switchView(v){$$('.view,.nav-item').forEach(x=>x.classList.remove('active'));$(`#${v}View`).classList.add('active');$(`.nav-item[data-view="${v}"]`).classList.add('active');$('#pageTitle').textContent=VIEW_TITLES[v]||'';$('.sidebar').classList.remove('open');renderAll()}
$$('.nav-item').forEach(b=>b.onclick=()=>switchView(b.dataset.view));$$('[data-go-squad]').forEach(b=>b.onclick=()=>switchView('squad'));$$('[data-go-rival]').forEach(b=>b.onclick=()=>switchView('rival'));$('.mobile-menu').onclick=()=>$('.sidebar').classList.toggle('open');
function renderTabs(){$('#tacticTabs').innerHTML=state.tactics.map((t,i)=>`<button class="tactic-tab ${t.id===state.activeTactic?'active':''}" data-id="${t.id}">${esc(t.name)}${state.tactics.length>1?`<span class="remove" data-remove="${t.id}">×</span>`:''}</button>`).join('');$$('.tactic-tab').forEach(b=>b.onclick=e=>{if(e.target.dataset.remove){e.stopPropagation();state.tactics=state.tactics.filter(t=>t.id!==e.target.dataset.remove);if(state.activeTactic===e.target.dataset.remove)state.activeTactic=state.tactics[0].id}else state.activeTactic=b.dataset.id;persist();renderAll()})}
$('#addTactic').onclick=()=>{const n=state.tactics.length+1,id='t'+Date.now();state.tactics.push({id,name:`Táctica ${n}`,formation:'4-3-3',placed:[],arrows:[]});state.activeTactic=id;persist();renderAll()};
function renderBench(){const placed=new Set(tactic().placed.map(x=>x.playerId));const available=state.players.filter(p=>!placed.has(p.id));$('#availableCount').textContent=available.length;$('#benchList').innerHTML=available.map(p=>`<button class="bench-player own-choice" data-id="${p.id}"><span class="bench-avatar" ${avatarStyle(p)}>${p.photo?'':esc(initials(p.name))}</span><p><strong>${esc(p.name)}</strong><small>${esc(p.position)} · ${esc(p.number)}</small></p><i class="status-dot ${p.status}"></i></button>`).join('')||'<p class="helper">Toda la plantilla está en el campo.</p>';$$('.own-choice').forEach(b=>b.onclick=()=>benchAction(b.dataset.id,'own'));}
function renderRivalBench(){const placed=new Set(tactic().opponentPlaced.map(x=>x.playerId)),available=state.rivals.filter(p=>!placed.has(p.id));$('#rivalAvailableCount').textContent=available.length;$('#rivalBenchList').innerHTML=available.map(p=>`<button class="bench-player rival-choice" data-id="${p.id}"><span class="bench-avatar" ${avatarStyle(p)}>${p.photo?'':esc(initials(p.name))}</span><p><strong>${esc(p.name)}</strong><small>${esc(p.position)} · ${esc(p.number)}</small></p></button>`).join('')||'<p class="helper">Todo el rival está en el campo.</p>';$$('.rival-choice').forEach(b=>b.onclick=()=>benchAction(b.dataset.id,'rival'))}
function benchAction(id,team){if(tool==='sub'){if(!substitutionPending){showToast('Primero selecciona quién sale del campo');return}if(substitutionPending.team!==team){showToast('Elige un jugador del mismo equipo');return}completeSubstitution(id);return}placePlayer(id,team)}
function placePlayer(id,team='own'){pushUndo();const t=tactic(),list=team==='rival'?t.opponentPlaced:t.placed,spots=formations[t.formation]||[];let pos=team==='rival'?[15+list.length%4*23,15+Math.floor(list.length/4)*12]:(spots[list.length]||[50,50]);list.push({playerId:id,x:pos[0],y:pos[1]});persist();renderBoard()}
function renderPitch(){const t=tactic();$('#formation').value=t.formation;const own=t.placed.map(pp=>playerHTML(pp,state.players,'own')).join(''),rival=t.opponentPlaced.map(pp=>playerHTML(pp,state.rivals,'rival')).join('');$('#pitchPlayers').innerHTML=own+rival;$('#pitchHint').style.display=(t.placed.length+t.opponentPlaced.length)?'none':'block';$$('.pitch-player').forEach(el=>{el.onpointerdown=startPlayerDrag;el.oncontextmenu=e=>{e.preventDefault();e.stopPropagation();openContextMenu(e.clientX,e.clientY,el.dataset.id,el.dataset.team)}});renderArrows();if(window.Vista3D)Vista3D.refrescar()}
function playerHTML(pp,roster,team){const p=roster.find(x=>x.id===pp.playerId);if(!p)return'';const marked=tactic().highlighted.includes(team+':'+p.id),selected=substitutionPending&&substitutionPending.team===team&&substitutionPending.id===p.id;const rivalStyle=team==='rival'?`--rival-primary:${state.rivalColors.primary};--rival-secondary:${state.rivalColors.secondary}`:'';const liveMin=(team==='own'&&state.live&&state.live.started&&!state.live.finished)?`<u class="live-min" data-min="${p.id}">${Math.floor((state.live.minutes[p.id]||0)/60)}′</u>`:'';const tj=tarjetaDe(team,p.id),carta=tj?`<em class="card-badge ${tj.clase}" title="${esc(tj.txt)}"></em>`:'';return `<div class="pitch-player ${team==='rival'?'rival':''} ${marked?'highlighted':''} ${selected?'sub-selected':''}" data-id="${p.id}" data-team="${team}" style="left:${pp.x}%;top:${pp.y}%;${rivalStyle}"><div class="player-token" ${avatarStyle(p)}>${p.photo?'':esc(initials(p.name))}<b>${esc(p.number||'-')}</b>${liveMin}${carta}</div><small>${esc(p.name.split(' ')[0])}</small></div>`}
/* Tarjeta visible sobre el jugador. Se pinta la sanción vigente, no el
   historial: dos amarillas son una expulsión, así que sale la roja. No se
   condiciona a que el partido esté en marcha para que al acabar siga viéndose
   quién terminó amonestado. */
function tarjetaDe(team,id){
  let am=0,ro=0;
  ((state.live&&state.live.events)||[]).forEach(e=>{
    if(e.ambito!=='jugador'||e.jugadorId!==id||(e.team||'own')!==team)return;
    if(e.tipo==='yellow')am++;else if(e.tipo==='red')ro++
  });
  if(ro)return {clase:'red',txt:'Tarjeta roja'};
  if(am>=2)return {clase:'red',txt:'Expulsado por doble amarilla'};
  if(am)return {clase:'yellow',txt:'Tarjeta amarilla'};
  return null
}
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
  const u=$('#undoBoard');if(u)u.disabled=!undoStack.length
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
  const u=$('#undoBoard');if(u)u.disabled=false
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
$('#undoBoard').onclick=undoLast;
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
   no haya subido ninguno, incluida la pantalla de acceso.
   Es un escudo NEUTRO a propósito. Cuando aquí estaba el de la UD Tamaraceite,
   toda pizarra sin escudo propio —es decir, toda pizarra recién creada— salía
   con el escudo de ese club. Las pizarras anteriores que dependían de este valor
   llevan ya su escudo grabado dentro de sus datos, así que cambiarlo no les
   afecta. */
const DEFAULT_CREST='escudos/escudo-generico.svg';
const crestSrc=()=>state.crest||DEFAULT_CREST;
/* ===== Identidad de la APLICACIÓN =====
   Ojo a la diferencia con el bloque de arriba: el club vive en state.club y
   state.crest, que se serializan en el campo `data` y viajan por la nube, así
   que cada pizarra tiene el suyo y el usuario lo cambia desde la interfaz. La
   marca del producto NO puede ir ahí: sería una copia por pizarra y applyRemote()
   la sobrescribiría con lo que mandase otro dispositivo. Por eso es una
   constante suelta, y por eso revender la app con otra marca es tocar solo
   estas dos líneas. */
const APP_BRAND={
  nombre:'Dirige Tu Club',
  logo:'logo/dtc-logo-horizontal-transparente.png'
};
function applyBrand(){
  const src=crestSrc(),nombre=state.club||'Equipo';
  // Solo se reasigna si cambia: renderAll() se llama a menudo y volver a poner
  // el mismo data URL hace parpadear la imagen.
  ['#brandCrest','#matchCrest'].forEach(sel=>{const el=$(sel);if(el.getAttribute('src')!==src)el.setAttribute('src',src)});
  if($('#brandName').textContent!==nombre.toUpperCase())$('#brandName').textContent=nombre.toUpperCase();
  if($('#matchClub').textContent!==nombre)$('#matchClub').textContent=nombre;
  // El pie de la barra lateral: antes decía "UD Tamaraceite" en todas las
  // pizarras porque era texto fijo del HTML y nadie lo reescribía.
  const pie=$('#coachClub');
  if(pie&&pie.textContent!==nombre)pie.textContent=nombre;
  // El logo de la app: mismo criterio de "solo si cambia" que el escudo. La ruta
  // no está en el HTML para que APP_BRAND siga siendo el único sitio que tocar.
  ['#authLogo','#topbarLogo'].forEach(sel=>{
    const el=$(sel);if(!el)return;
    if(el.getAttribute('src')!==APP_BRAND.logo)el.setAttribute('src',APP_BRAND.logo);
    if(el.getAttribute('alt')!==APP_BRAND.nombre)el.setAttribute('alt',APP_BRAND.nombre)
  });
  // Club a la izquierda, producto a la derecha: es lo que se ve en la pestaña y
  // en el marcador si alguien guarda la página.
  const titulo=`${nombre} | ${APP_BRAND.nombre}`;
  if(document.title!==titulo)document.title=titulo
}
/* El mismo diálogo sirve de "Datos del club" y de bienvenida de una pizarra
   recién creada: solo cambian el rótulo, el texto y qué botones se ven. */
function openClub(bienvenida){
  document.body.classList.toggle('welcome-club',!!bienvenida);
  $('#clubEyebrow').textContent=bienvenida?'BIENVENIDO':'IDENTIDAD';
  $('#clubTitle').textContent=bienvenida?'¿De qué equipo es esta pizarra?':'Datos del club';
  $('#clubDone').textContent=bienvenida?'Empezar':'Hecho';
  $('#clubName').value=state.club||'';
  $('#crestPreview').src=crestSrc();
  $('#crestReset').style.display=state.crest?'block':'none';
  if(!$('#clubDialog').open)$('#clubDialog').showModal()
}
// Con `onclick=openClub` el navegador pasa el MouseEvent como primer argumento,
// que es truthy: el diálogo se abriría SIEMPRE en modo bienvenida. De ahí la
// función envolvente.
$('#clubBtn').onclick=()=>openClub();
$('.brand').onclick=e=>{e.preventDefault();openClub()};
$$('.close-club').forEach(b=>b.onclick=()=>$('#clubDialog').close());
// En el evento 'close' y no en cada botón: así también se limpia al salir con
// la tecla Esc, que <dialog> gestiona por su cuenta.
$('#clubDialog').addEventListener('close',()=>document.body.classList.remove('welcome-club'));
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
// Un gol sin goleador viene del modo en directo, donde no se pregunta quién lo
// metió: se marca como pendiente en vez de dejar un guion que parece un error.
function goleadorDe(team,id){const p=rosterOf(team).find(x=>x.id===id);return p?p.name:(id?'—':'Sin asignar')}

/* ===== Selector de zona: un único componente =====
   Lo usan los eventos de jugador, los de equipo y la corrección de zona desde el
   informe o desde la ficha. Se pinta DENTRO del popup que ya está abierto, así
   que registrar cuesta tres toques: jugador → evento → cuadrante. Sin zona por
   defecto y sin caducidad: si no se toca, no se inventa nada. */
// acciones=false para incrustarlo en un formulario que ya tiene sus botones:
// allí la zona se elige y se queda marcada, no se envía al tocarla.
function zonaGridHTML(titulo,ayuda,zonaActual,acciones=true){
  const celda=z=>`<button type="button" class="zg-cell${zonaActual===z?' now':''}" data-zona="${z}"><b>${ZONA_ETI[z]}</b><i>${esc(ZONA_NOM[z].split(' · ')[1])}</i></button>`;
  return `<div class="zone-pick">
    <div class="zp-head"><span class="zp-title">${esc(titulo)}</span>${ayuda?`<small>${esc(ayuda)}</small>`:''}</div>
    <div class="zp-field"><div class="zp-grid">${ZONAS.map(celda).join('')}</div><span class="zp-goal">▼ NUESTRA PORTERÍA</span></div>
    ${acciones?`<div class="zp-actions"><button type="button" class="zp-skip" data-zona="">Sin zona</button><button type="button" class="zp-cancel">Volver</button></div>`:''}
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
    const lista=EVENTOS.filter(e=>e.g===menuTab&&!e.oculto);
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
/* Zona elegida en el diálogo. Es la única vía para apuntar un gol, así que aquí
   se recogen las tres cosas que necesita el informe —goleador, asistente y
   cuadrante— en una sola pasada. Sin zona por defecto: si no se toca, el gol
   entra igual y solo se queda fuera del mapa. */
let goalZone=null,goalEditId=null;
/* Un gol apuntado en el modo en directo entra sin goleador: allí no se pregunta
   nada más que la zona. Se le pone nombre después, desde el marcador, editando
   ESE gol; si se usara "Asignar gol" habría dos goles para el mismo remate. */
function openGoalAsignar(gid){
  const gol=(state.match.goals||[]).find(g=>g.id===gid);if(!gol)return;
  goalEditId=gid;goalTeam=gol.team;goalZone=null;
  const nombre=gol.team==='rival'?(state.match.opponent||'Rival'):(state.club||'Equipo');
  $('#goalEyebrow').textContent=nombre.toUpperCase()+' · GOL DEL MINUTO '+(gol.min||'—');
  $('#goalScorer').innerHTML=goalOptions(gol.team,null);
  $('#goalScorer').value=gol.scorerId||'';fillAssist();
  $('#goalAssist').value=gol.assistId||'';
  // La zona ya la tiene el evento del gol: no se vuelve a preguntar.
  $('#goalZone').hidden=true;$('#goalZone').innerHTML='';
  $('#goalDialog').showModal()
}
function openGoalDialog(id,team){
  goalTeam=team;goalZone=null;goalEditId=null;
  const nombre=team==='rival'?(state.match.opponent||'Rival'):(state.club||'Equipo');
  $('#goalEyebrow').textContent=nombre.toUpperCase()+' · GOL';
  $('#goalScorer').innerHTML=goalOptions(team,null);
  $('#goalScorer').value=id;fillAssist();
  const box=$('#goalZone'),vivo=state.live.started&&!state.live.finished;
  box.hidden=!vivo;
  if(vivo){
    box.innerHTML=zonaGridHTML('¿En qué zona?','Para el mapa del informe. Toca otra vez para quitarla.',null,false);
    box.querySelectorAll('[data-zona]').forEach(b=>b.onclick=ev=>{
      ev.preventDefault();ev.stopPropagation();
      goalZone=goalZone===b.dataset.zona?null:b.dataset.zona;
      box.querySelectorAll('[data-zona]').forEach(x=>x.classList.toggle('now',x.dataset.zona===goalZone))
    })
  }else box.innerHTML='';
  $('#goalDialog').showModal()
}
$('#goalScorer').onchange=fillAssist;
$$('.close-goal').forEach(b=>b.onclick=()=>$('#goalDialog').close());
$('#goalForm').onsubmit=e=>{
  e.preventDefault();
  const scorerId=$('#goalScorer').value;if(!scorerId)return;
  const assistId=$('#goalAssist').value||null,vivo=state.live.started&&!state.live.finished;
  if(goalEditId){asignarGoleador(goalEditId,scorerId,assistId);return}
  const gol={id:'g'+Date.now(),team:goalTeam,scorerId,assistId,min:vivo?liveMinute():null};
  state.match.goals.push(gol);
  /* Con el partido en directo, el gol entra a la vez en el marcador y en los
     eventos, con su zona y con la asistencia. La asistencia hereda el cuadrante
     del gol: es la misma jugada, y preguntar dos zonas seguidas a pie de campo
     no lo usaría nadie. Se guarda asisEvId para que quitar el gol del marcador
     se lleve también la asistencia y no queden asistencias huérfanas. */
  if(vivo){
    const ev=crearEvento({tipo:'gol',ambito:'jugador',jugadorId:scorerId,team:goalTeam,zona:goalZone});
    ev.golId=gol.id;gol.evId=ev.id;cloudSaveEvent(ev);
    if(assistId){
      // Sin golId en la asistencia: ese campo marca "este evento ES el gol" y
      // borrarEvento() lo usa para quitarlo del marcador. El enlace va solo en
      // sentido gol → asistencia.
      gol.asisEvId=crearEvento({tipo:'asistencia',ambito:'jugador',jugadorId:assistId,team:goalTeam,zona:goalZone}).id
    }
  }
  $('#goalDialog').close();persist(true);renderBoard();refrescarPaneles();showToast(assistId?'Gol y asistencia registrados':'Gol registrado')
};
/* Pone nombre a un gol que ya existe: no crea otro, reescribe el que hay y su
   evento. La asistencia hereda minuto y zona del gol, que es la misma jugada. */
function asignarGoleador(gid,scorerId,assistId){
  const gol=state.match.goals.find(g=>g.id===gid);
  goalEditId=null;
  if(!gol){$('#goalDialog').close();return}
  gol.scorerId=scorerId;gol.assistId=assistId;
  const ev=state.live.events.find(x=>x.id===gol.evId);
  if(ev){ev.jugadorId=scorerId;ev.ambito='jugador';ev.team=gol.team;cloudSaveEvent(ev)}
  const asis=gol.asisEvId?state.live.events.find(x=>x.id===gol.asisEvId):null;
  if(assistId){
    if(asis){asis.jugadorId=assistId;asis.ambito='jugador';cloudSaveEvent(asis)}
    else gol.asisEvId=crearEvento({tipo:'asistencia',ambito:'jugador',jugadorId:assistId,team:gol.team,
      zona:ev?ev.zona:null,minuto:gol.min,parte:ev?ev.parte:state.live.half,origen:'asignado'}).id
  }else if(gol.asisEvId){
    const id=gol.asisEvId;gol.asisEvId=null;
    state.live.events=state.live.events.filter(x=>x.id!==id);cloudDeleteEvent(id)
  }
  $('#goalDialog').close();persist(true);renderBoard();refrescarPaneles();
  showToast(assistId?'Goleador y asistencia asignados':'Goleador asignado')
}
function renderScoreboard(){
  const box=$('#scoreboard');if(!box)return;
  const g=state.match.goals||[];
  const own=g.filter(x=>x.team==='own').length,riv=g.filter(x=>x.team==='rival').length;
  const nameOf=goleadorDe;
  // Local a la izquierda (side 'home'), visitante a la derecha ('away'). El balón
  // se coloca hacia la línea central para que cada columna "mire" al marcador.
  const item=(x,side)=>{
    const scorer=esc(nameOf(x.team,x.scorerId));
    const assist=x.assistId?`<div class="g-assist">↳ ${esc(nameOf(x.team,x.assistId))}</div>`:'';
    const min=x.min?`<span class="g-min">${x.min}′</span>`:'';
    const main=side==='home'
      ?`<span class="g-name">${scorer}</span><span class="g-ball">⚽</span>${min}`
      :`${min}<span class="g-ball">⚽</span><span class="g-name">${scorer}</span>`;
    return `<li class="g-row${x.scorerId?'':' sin-asignar'}"><div class="g-main" data-assign="${x.id}" title="${x.scorerId?'Cambiar goleador':'Asignar goleador'}">${main}</div>${assist}<button class="g-del" data-goal="${x.id}" title="Quitar gol" aria-label="Quitar gol">×</button></li>`
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
  $$('#scoreboard [data-assign]').forEach(b=>b.onclick=()=>openGoalAsignar(b.dataset.assign));
  $$('[data-goal]').forEach(b=>b.onclick=()=>{
    const gid=b.dataset.goal,gol=state.match.goals.find(x=>x.id===gid);
    state.match.goals=state.match.goals.filter(x=>x.id!==gid);
    // Los eventos enlazados se van con él: si no, el mapa seguiría contando el
    // gol y el informe seguiría apuntándole la asistencia a quien la dio.
    const fuera=[];
    const ev=state.live.events.find(e=>e.golId===gid||(gol&&gol.evId&&e.id===gol.evId));
    if(ev)fuera.push(ev.id);
    if(gol&&gol.asisEvId)fuera.push(gol.asisEvId);
    if(fuera.length){state.live.events=state.live.events.filter(e=>!fuera.includes(e.id));fuera.forEach(cloudDeleteEvent)}
    persist();renderBoard();refrescarPaneles()
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
function updateLiveClockDOM(){
  const c=$('#liveClock');
  if(c){
    c.textContent=fmtClock(state.live.elapsed);
    const ov=$('#liveOver');if(ov){const reg=state.live.halfLength*60;ov.textContent=state.live.elapsed>reg?`+${Math.floor((state.live.elapsed-reg)/60)}′`:''}
  }
  lmPintarReloj()   // el reloj de la pantalla completa se refresca aparte, sin repintarla entera
}
function updateLiveMinutesDOM(){$$('#pitchPlayers .live-min').forEach(u=>{u.textContent=Math.floor((state.live.minutes[u.dataset.min]||0)/60)+'′'})}

function liveStart(){
  const L=state.live;
  if(!tactic().placed.length&&!confirm('No hay jugadores en el campo. Los minutos no contarán hasta que coloques a tu equipo. ¿Empezar igualmente?'))return;
  L.started=true;L.finished=false;L.running=true;L.half=1;L.elapsed=0;L.minutes={};limpiarEventos();
  L.matchId='m'+Date.now().toString(36);
  liveSaveCount=0;persist();renderBoard();liveStartTicking();
  // Los datos del partido (rival, competición, fecha, lugar) ya están en la
  // tarjeta "Próximo partido": no se vuelven a pedir, se abre y a registrar.
  abrirDirecto()
}
function livePause(){state.live.running=false;liveStopTicking();persist();renderLive()}
function liveResume(){state.live.running=true;persist();renderLive();liveStartTicking()}
function liveEndHalf(){const L=state.live;L.running=false;liveStopTicking();const fin=halfName(L.half);L.half++;L.elapsed=0;liveSaveCount=0;lmAutoOrientacion();persist();renderBoard();showToast('Fin de la '+fin)}
// Se archiva ANTES de nada: a partir de aquí el técnico puede pulsar "Iniciar
// partido", y eso vacía los minutos y borra los eventos de la nube.
function liveFinish(){const L=state.live;L.running=false;L.finished=true;liveStopTicking();cerrarDirecto();if(window.Partidos)Partidos.archivar();persist();renderBoard();openReport()}
function liveReset(){
  if(!confirm('¿Reiniciar el partido? Se ponen a cero el marcador, el cronómetro, los minutos y los eventos. No se puede deshacer.'))return;
  limpiarEventos();
  state.live={started:false,finished:false,running:false,half:1,halfLength:state.live.halfLength||45,elapsed:0,minutes:{},events:[],matchId:''};
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
      controls=`<button type="button" class="btn primary" id="liveFull">⛶ Registrar</button><button type="button" class="btn secondary" id="teamEvBtn">⚑ Equipo</button><button type="button" class="btn secondary" id="livePause">⏸ Pausa</button><button type="button" class="btn secondary" id="liveEndHalf">⏹ Fin de parte</button><button type="button" class="btn secondary" id="liveReport">📄 Informe</button><button type="button" class="btn secondary" id="liveFinish">Finalizar</button>`;
    }else{
      const resumeLabel=L.elapsed===0?('▶ Iniciar '+halfName(L.half)):'▶ Reanudar';
      controls=`${L.elapsed===0?lenChips:''}<button type="button" class="btn primary" id="liveResume">${resumeLabel}</button><button type="button" class="btn secondary" id="liveFull">⛶ Registrar</button><button type="button" class="btn secondary" id="teamEvBtn">⚑ Equipo</button><button type="button" class="btn secondary" id="liveReport">📄 Informe</button><button type="button" class="btn secondary" id="liveFinish">Finalizar</button>`;
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
  bind('liveFull',abrirDirecto);
  renderTeamFab();renderLiveScreen();
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
    minuto:liveMinute(),parte:L.half,origen:'rol_'+rolRegistro,ts:Date.now(),team:'own',
    partidoId:L.matchId||null
  },base));
  L.events.push(ev);cloudSaveEvent(ev);persist();
  return ev
}
function borrarEvento(id){
  const L=state.live,i=L.events.findIndex(e=>e.id===id);
  if(i<0)return;
  const ev=L.events[i];
  // Un gol está en tres sitios: evento, marcador y —si la hubo— asistencia.
  // Se van los tres juntos para que ninguna cuenta quede descuadrada.
  if(ev.golId){
    const gol=state.match.goals.find(g=>g.id===ev.golId);
    state.match.goals=state.match.goals.filter(g=>g.id!==ev.golId);
    if(gol&&gol.asisEvId){L.events=L.events.filter(e=>e.id!==gol.asisEvId);cloudDeleteEvent(gol.asisEvId)}
  }
  const j=L.events.findIndex(e=>e.id===id);
  if(j>=0)L.events.splice(j,1);
  cloudDeleteEvent(id);persist();
  renderBoard();refrescarPaneles()
}
function cambiarZonaEvento(id,zona){
  const ev=state.live.events.find(e=>e.id===id);if(!ev)return;
  ev.zona=zona;ev.fila=filaDe(zona);ev.carril=carrilDe(zona);
  ev.ts=ev.ts||Date.now();cloudSaveEvent(ev);persist();refrescarPaneles()
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
  // La tarjeta se ve sobre el jugador, así que hay que repintar el campo:
  // refrescarPaneles() solo toca el informe y la ficha.
  if(tipo==='yellow'||tipo==='red')renderPitch();
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
  // Se busca dentro del propio aviso, no por id global: el botón "Deshacer" de
  // la barra del campo es otro y con $('#…') se acababa cableando ese.
  t.innerHTML=`<span>${esc(texto)}</span><button type="button">Deshacer</button>`;
  t.classList.add('show');
  t.querySelector('button').onclick=()=>{if(undoId)borrarEvento(undoId);undoId=null;t.classList.remove('show');clearTimeout(undoTimer);showToast('Evento deshecho')};
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
    ${EVENTOS_EQUIPO.filter(e=>!e.directo).map(e=>`<button type="button" class="tm-ev" data-ev="${e.t}"><i>${e.ic}</i><span><strong>${esc(e.n)}</strong><small>${esc(e.ayuda||'')}</small></span><b class="tm-count" data-count="${e.t}">${contarTipo(e.t)}</b></button>`).join('')}
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

/* ===== Modo en directo: pantalla completa =====
   Dos pantallas y nada más. La 1 es la rejilla de once eventos; la 2, el campo
   en 3×3. Registrar cuesta dos pulsaciones —evento → cuadrante— y ninguna
   espera a la red: el evento ya está en memoria y en el navegador antes de
   salir hacia la nube (ver cloudSaveEvent), así que la confirmación se pinta al
   instante aunque no haya cobertura.
   Los córners no tienen cuadrante y se quedan en una sola pulsación, por eso
   viven en su propia fila, separados de los once de dos pasos: pulsar uno por
   error y que se guarde sin preguntar nada sería el fallo más caro de todos. */
/* Las dos columnas no separan ataque de defensa, sino lo bueno de lo malo: a la
   izquierda en verde lo que suma para nosotros, a la derecha en rojo lo que
   resta. Una recuperación o un duelo ganado son buenas noticias aunque nazcan
   de una acción defensiva, y pintarlas de rojo hacía dudar antes de pulsar.
   Las columnas ya no tienen la misma altura de lista: cada una reparte su hueco
   por su cuenta (ver lmPintarRejilla). */
const DIRECTO_BIEN=['foul_won','duelo_ganado','recuperacion','llegada_banda','llegada_area','tiro_puerta','gol'];
const DIRECTO_MAL=['foul_made','duelo_perdido','perdida','ocasion_conc'];
const DIRECTO_CORNERS=['corner_favor','corner_contra'];
/* Aquí todo se ubica en el campo menos los córners: el lado ya va dentro del
   propio tipo y no aporta nada preguntar por el cuadrante. Se decide por esta
   lista y no por `zona` del catálogo porque las faltas siguen guardándose sin
   cuadrante desde el menú del jugador, donde lo que importa es quién la hizo. */
const DIRECTO_SIN_ZONA=DIRECTO_CORNERS;
// Nombres cortos: en la rejilla mandan el tamaño de letra y la legibilidad al
// sol. El nombre largo del catálogo se sigue usando en el informe.
const DIRECTO_NOM={llegada_banda:'Llegada por banda',llegada_area:'Entrada al área',tiro_puerta:'Tiro',gol:'GOL',
  recuperacion:'Recuperación',perdida:'Pérdida',duelo_ganado:'Duelo ganado',duelo_perdido:'Duelo perdido',
  ocasion_conc:'Ocasión concedida',foul_won:'Falta recibida',foul_made:'Falta cometida',
  corner_favor:'Córner a favor',corner_contra:'Córner en contra'};
/* Los iconos del catálogo valen para una lista pequeña, pero los círculos de
   color de recuperación, pérdida y faltas se pierden encima de un botón ya
   coloreado. Aquí se cambian por signos monocromos que heredan el blanco del
   texto y se leen por parejas: ganamos el balón / lo perdemos, falta para
   nosotros / falta nuestra. En el informe siguen saliendo los del catálogo,
   que es donde el color sí ayuda. */
const DIRECTO_IC={recuperacion:'⊕',perdida:'⊖',ocasion_conc:'△',foul_won:'✚',foul_made:'✖'};
const DIRECTO_ZONA_MS=8000,   // sin tocar nada, la pantalla de zonas se cierra sola
      /* La de jugadores aguanta más: en el campo se busca un cuadrante entre
         nueve y ya se sabe cuál antes de mirar; aquí hay que leer once nombres
         y encontrar el dorsal. Con los mismos 8 s se caducaban acciones que el
         entrenador sí estaba a punto de registrar. */
      DIRECTO_JUG_MS=12000,
      DIRECTO_REBOTE=300;     // dos toques más juntos que esto son el mismo dedo

let lmAbierto=false,lmEquipo='own',lmInvertido=false,lmEvPend=null,lmJugPend=null,
    lmAutoCancel=null,lmUltimoToque=0,lmDeshacer=[],lmFlashTimer=null,lmWake=null;

/* La convención es fija: se ataca hacia arriba. En la 2ª parte se cambia de
   campo, así que el dibujo se da la vuelta solo al empezarla. El toggle manual
   manda a partir de ahí, por si quien registra se cambia de banda. */
function lmAutoOrientacion(){lmInvertido=state.live.half%2===0;lmPintarOrientacion()}
const lmZonaDe=i=>lmInvertido?ZONAS[8-i]:ZONAS[i];   // giro de 180°: también se cruzan los carriles

async function lmPedirWakeLock(){
  try{if('wakeLock' in navigator)lmWake=await navigator.wakeLock.request('screen')}catch(_){}
}
function lmSoltarWakeLock(){try{lmWake&&lmWake.release()}catch(_){}lmWake=null}
document.addEventListener('visibilitychange',()=>{if(lmAbierto&&document.visibilityState==='visible'&&!lmWake)lmPedirWakeLock()});

function abrirDirecto(){
  const L=state.live;
  if(!L.started||L.finished)return;
  lmAbierto=true;lmEvPend=null;lmEquipo='own';
  // Se conserva lo que aún exista: salir a asignar un goleador y volver no
  // debería vaciar el deshacer. Al empezar un partido nuevo la pila se queda
  // vacía sola, porque liveStart() se ha llevado por delante esos eventos.
  lmDeshacer=lmDeshacer.filter(p=>p.ids.some(id=>L.events.some(e=>e.id===id)));
  lmAutoOrientacion();
  $('#liveScreen').hidden=false;
  document.body.classList.add('lm-on');
  lmEvPend=null;lmJugPend=null;
  $('#lmP2').hidden=true;$('#lmPJ').hidden=true;$('#lmP1').hidden=false;lmCerrarHoja();
  renderLiveScreen();lmPedirWakeLock();
  if(L.running)liveStartTicking()
}
function cerrarDirecto(){
  if(!lmAbierto)return;
  lmAbierto=false;lmCancelarRegistro();lmCerrarHoja();
  $('#liveScreen').hidden=true;
  document.body.classList.remove('lm-on');
  lmSoltarWakeLock()
}

function renderLiveScreen(){
  if(!lmAbierto)return;
  const L=state.live;
  if(!L.started||L.finished){cerrarDirecto();return}
  if(!$('#lmGrid').childElementCount)lmPintarRejilla();
  lmPintarReloj();lmPintarContador();pintarSyncDirecto();lmPintarEquipo();lmPintarOrientacion();lmPintarDeshacer();
  const p=$('#lmPause');
  p.textContent=L.running?'⏸':'▶';
  p.classList.toggle('go',!L.running);
  p.title=L.running?'Pausa':(L.elapsed===0?'Iniciar '+halfName(L.half):'Reanudar');
  // Una parte que aún no ha empezado no se puede dar por terminada.
  const sinEmpezar=L.elapsed===0&&!L.running;
  $('#lmHalfBtn').disabled=sinEmpezar;
  const fila=$('#lmSheet [data-act="half"]');if(fila)fila.disabled=sinEmpezar
}
function lmPintarReloj(){
  if(!lmAbierto)return;
  const L=state.live,reg=L.halfLength*60,c=$('#lmClock');
  if(!c)return;
  c.textContent=fmtClock(L.elapsed)+(L.elapsed>reg?` +${Math.floor((L.elapsed-reg)/60)}′`:'');
  $('#lmMinute').textContent=(liveMinute()||0)+'′';
  $('#lmHalf').textContent=halfName(L.half)+(L.running?'':(L.elapsed===0?' · sin empezar':' · en pausa'));
  $('#liveScreen').classList.toggle('paused',!L.running)
}
function lmPintarContador(){const c=$('#lmCount');if(c)c.textContent=eventosDelPartido().length}
function lmPintarEquipo(){
  const b=$('#lmTeam');if(!b)return;
  const riv=lmEquipo==='rival';
  b.classList.toggle('rival',riv);b.setAttribute('aria-pressed',String(riv));
  $('#lmTeamTxt').textContent=riv?(state.match.opponent||'Rival').toUpperCase():'NOSOTROS';
  $('#liveScreen').classList.toggle('rival',riv)
}
function lmPintarOrientacion(){const t=$('#lmzFlipTxt');if(t)t.textContent=lmInvertido?'Atacamos ↓':'Atacamos ↑'}
function lmPintarDeshacer(){
  const b=$('#lmUndo');if(!b)return;
  b.disabled=!lmDeshacer.length;
  b.querySelector('span').textContent=lmDeshacer.length
    ?'Deshacer: '+lmDeshacer[lmDeshacer.length-1].texto
    :'Deshacer última acción'
}

function lmBotonHTML(t,clase){
  const d=EVENTO_DEF[t]||{};
  return `<button type="button" class="lm-ev ${clase}${t==='gol'?' gol':''}" data-ev="${t}"><i>${DIRECTO_IC[t]||d.ic||''}</i><span>${esc(DIRECTO_NOM[t]||d.n||t)}</span></button>`
}
function lmPintarRejilla(){
  /* Dos columnas independientes, no una rejilla de filas emparejadas: la verde
     tiene siete botones y la roja cuatro, así que cada una se reparte su altura
     por su cuenta. Emparejando filas quedarían tres huecos vacíos en la roja. */
  $('#lmGrid').innerHTML=
    `<div class="lm-col">${DIRECTO_BIEN.map(t=>lmBotonHTML(t,'bien')).join('')}</div>`+
    `<div class="lm-col">${DIRECTO_MAL.map(t=>lmBotonHTML(t,'mal')).join('')}</div>`;
  $('#lmCorners').innerHTML=DIRECTO_CORNERS.map(t=>{
    const d=EVENTO_DEF[t]||{};
    return `<button type="button" class="lm-corner" data-ev="${t}"><i>${d.ic||''}</i><span>${esc(DIRECTO_NOM[t])}</span></button>`
  }).join('')
}

/* Campo de la pantalla 2: el dibujo va en SVG estirado al hueco disponible (solo
   líneas, que aguantan el estirado) y encima los nueve botones en una rejilla
   CSS. Así el texto no se deforma y cada cuadrante mantiene su altura mínima. */
function lmCampoSVG(){
  const W=300,H=420,cw=100,ch=140,lin='rgba(255,255,255,.55)',tenue='rgba(255,255,255,.26)';
  const yRival=lmInvertido?H-13:0,yProp=lmInvertido?0:H-9;
  let s=`<svg class="lmz-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true">`;
  s+=`<rect x="3" y="3" width="${W-6}" height="${H-6}" fill="none" stroke="${lin}" stroke-width="2"/>`;
  s+=`<line x1="3" y1="${H/2}" x2="${W-3}" y2="${H/2}" stroke="${lin}" stroke-width="2"/>`;
  // El círculo central NO va aquí: el SVG se estira al hueco y saldría como una
  // elipse. Se dibuja en CSS (.lmz-circle), que sí puede mantenerse redondo.
  s+=`<rect x="70" y="3" width="160" height="60" fill="none" stroke="${lin}" stroke-width="2"/>`;
  s+=`<rect x="70" y="${H-63}" width="160" height="60" fill="none" stroke="${lin}" stroke-width="2"/>`;
  [1,2].forEach(i=>{
    s+=`<line x1="${i*cw}" y1="3" x2="${i*cw}" y2="${H-3}" stroke="${tenue}" stroke-width="1.5" stroke-dasharray="8 8"/>`;
    s+=`<line x1="3" y1="${i*ch}" x2="${W-3}" y2="${i*ch}" stroke="${tenue}" stroke-width="1.5" stroke-dasharray="8 8"/>`
  });
  // La portería a la que atacamos, en ámbar y más gruesa; la nuestra, apagada.
  // Es la única marca de orientación dentro del campo: los rótulos de texto se
  // quitaron porque se pisaban con el código de la zona de arriba, y la
  // dirección ya va escrita con todas las letras en el botón de invertir.
  s+=`<rect x="112" y="${yRival}" width="76" height="13" rx="2" fill="#ffd166"/>`;
  s+=`<rect x="118" y="${yProp}" width="64" height="9" fill="rgba(255,255,255,.42)"/>`;
  return s+'</svg>'
}
function lmCampoHTML(){
  const celdas=ZONAS.map((_,i)=>{
    const z=lmZonaDe(i);
    return `<button type="button" class="lmz-cell" data-zona="${z}"><b>${ZONA_ETI[z]}</b></button>`
  }).join('');
  return `<div class="lmz-pitch">${lmCampoSVG()}<span class="lmz-circle"></span><div class="lmz-grid">${celdas}</div></div>`
}

function lmPulsarEvento(t){
  const def=EVENTO_DEF[t];if(!def)return;
  if(DIRECTO_SIN_ZONA.includes(t)){lmRegistrar(t,null);return}   // córner: se guarda ya, con su minuto
  /* Con el RIVAL seleccionado el paso de jugador se salta y todo sigue costando
     dos toques: los "rivales" de la pizarra son cinco fichas genéricas de
     relleno para dibujar, no su once de verdad, así que preguntar quién ha sido
     solo serviría para ensuciar el informe con nombres inventados. */
  if(lmEquipo==='rival'){lmAbrirZonas(t);return}
  lmAbrirJugadores(t)
}

/* --- Pantalla de jugadores: quién ha hecho la acción ---
   Reparto en dos columnas para que los dos pulgares lleguen sin recolocar el
   móvil, y el portero solo abajo: es el único al que se busca por lo que hace y
   no por dónde está. */
const lmEsPortero=p=>p.position==='Portero';
function lmJugadoresEnCampo(){
  /* La fuente es la pizarra, la misma con la que se cuentan los minutos: así una
     sustitución ya hecha cambia esta lista sola y no hay una segunda cuenta de
     quién está dentro que pueda desajustarse. */
  const dentro=tactic().placed.map(pp=>state.players.find(p=>p.id===pp.playerId)).filter(Boolean);
  const portero=dentro.filter(lmEsPortero).sort(byNumber)[0]||null;
  const resto=dentro.filter(p=>p!==portero).sort(byNumber);
  /* Por mitades, no cinco fijos: con una expulsión hay diez en el campo, y con
     el once sin terminar de colocar puede haber menos. Partir por la mitad
     reparte siempre; cortar por el quinto dejaría una columna coja. */
  const mitad=Math.ceil(resto.length/2);
  return {portero,izq:resto.slice(0,mitad),der:resto.slice(mitad)};
}
function lmJugadorHTML(p,gk){
  // Nombre de pila, como en las fichas de la pizarra: el dorsal ya distingue, y
  // el apellido no cabe sin encoger la letra hasta hacerla inservible al sol.
  return `<button type="button" class="lmj-p${gk?' gk':''}" data-jug="${p.id}"><b>${gk?'🧤 ':''}${esc(String(p.number||'–'))}</b><span>${esc(p.name.split(' ')[0])}</span></button>`
}
function lmPintarJugadores(){
  const {portero,izq,der}=lmJugadoresEnCampo();
  const col=l=>`<div class="lmj-col">${l.map(p=>lmJugadorHTML(p)).join('')}</div>`;
  $('#lmjBody').innerHTML=`<div class="lmj-cols">${col(izq)}${col(der)}</div>`
    +(portero?`<div class="lmj-gk">${lmJugadorHTML(portero,true)}</div>`:'')
}
function lmAbrirJugadores(t){
  const def=EVENTO_DEF[t]||{},{portero,izq,der}=lmJugadoresEnCampo();
  // Sin nadie colocado en la pizarra no hay a quién señalar: se va derecho al
  // campo, en vez de enseñar una pantalla vacía que solo se puede saltar.
  if(!portero&&!izq.length&&!der.length){lmAbrirZonas(t);return}
  lmEvPend=t;lmJugPend=null;lmUltimoToque=0;
  $('#lmjTitle').textContent=DIRECTO_NOM[t]||def.n||t;
  lmPintarJugadores();
  $('#lmP1').hidden=true;$('#lmP2').hidden=true;$('#lmPJ').hidden=false;
  lmArmarAutoCancel(DIRECTO_JUG_MS)
}
function lmTocarJugador(id,btn){
  const ahora=Date.now();
  if(ahora-lmUltimoToque<DIRECTO_REBOTE)return;
  lmUltimoToque=ahora;
  const t=lmEvPend;if(!t)return;
  lmJugPend=id;
  btn.classList.add('hit');
  try{navigator.vibrate&&navigator.vibrate(15)}catch(_){}
  // El mismo respiro que usa la rejilla de zonas para que se vea el destello
  // antes de cambiar de pantalla.
  setTimeout(()=>{if(lmEvPend===t)lmAbrirZonas(t)},120)
}
/* Saltar: la acción se guarda igual, pero como del equipo. Es la salida para
   todo lo que no tiene autor claro —una ocasión concedida, un balón dividido—,
   y sin ella el temporizador se llevaría por delante la acción entera, que es
   bastante peor que perder solo el nombre. */
function lmSaltarJugador(){
  const t=lmEvPend;if(!t)return;
  lmJugPend=null;lmAbrirZonas(t)
}

function lmAbrirZonas(t){
  const def=EVENTO_DEF[t]||{};
  lmEvPend=t;lmUltimoToque=0;
  $('#lmzTitle').textContent=DIRECTO_NOM[t]||def.n||t;
  // Con jugador elegido, el subtítulo lo recuerda: entre pulsar el nombre y
  // pulsar el cuadrante es donde se cuela la duda de "¿a quién le he dado?".
  $('#lmzHint').textContent=lmEquipo==='rival'
    ?'Acción del rival · toca la zona'
    :(lmJugPend?playerTag(lmJugPend)+' · toca la zona':'Toca la zona donde ha pasado');
  $('#lmzField').innerHTML=lmCampoHTML();
  $('#lmP1').hidden=true;$('#lmPJ').hidden=true;$('#lmP2').hidden=false;
  lmArmarAutoCancel()
}
function lmArmarAutoCancel(ms){
  clearTimeout(lmAutoCancel);
  lmAutoCancel=setTimeout(()=>{lmCancelarRegistro();showToast('Sin registrar')},ms||DIRECTO_ZONA_MS)
}
function lmCancelarRegistro(){
  clearTimeout(lmAutoCancel);lmAutoCancel=null;lmEvPend=null;lmJugPend=null;
  const p2=$('#lmP2'),pj=$('#lmPJ');
  if(p2)p2.hidden=true;
  if(pj)pj.hidden=true;
  $('#lmP1').hidden=false
}
function lmTocarZona(z,btn){
  const ahora=Date.now();
  if(ahora-lmUltimoToque<DIRECTO_REBOTE)return;
  lmUltimoToque=ahora;
  const t=lmEvPend;if(!t)return;
  lmEvPend=null;clearTimeout(lmAutoCancel);
  btn.classList.add('hit');
  // Vuelta a la pantalla 1 sin esperar a nada: el flash dura menos de lo que
  // tarda el dedo en levantarse del cristal.
  setTimeout(()=>{const p2=$('#lmP2');if(p2&&!lmEvPend){p2.hidden=true;$('#lmP1').hidden=false}},180);
  lmRegistrar(t,z)
}
function lmRegistrar(tipo,zona){
  const L=state.live;if(!L.started||L.finished)return;
  /* Se consume aquí y se deja a null: el siguiente evento tiene que empezar sin
     jugador aunque venga por un camino que no pase por esa pantalla (un córner,
     o una acción del rival). */
  const jug=lmJugPend;lmJugPend=null;
  const ambito=jug?'jugador':'equipo';
  const ids=[],ev=crearEvento({tipo,ambito,jugadorId:jug,team:lmEquipo,zona,origen:'directo'});
  ids.push(ev.id);
  /* Un gol es también un remate. Si no se duplicase, la distribución de tiros
     dejaría fuera precisamente los que acabaron dentro. Mismo minuto, misma
     zona y mismo equipo; el origen los distingue por si hay que separarlos. */
  if(tipo==='gol'){
    ids.push(crearEvento({tipo:'tiro_puerta',ambito,jugadorId:jug,team:lmEquipo,zona,origen:'directo_gol'}).id);
    /* Con jugador elegido el goleador ya queda puesto y no hay que asignarlo
       después desde la pizarra. Sin jugador (saltado, o gol del rival) sigue
       entrando como "Sin asignar", exactamente igual que antes. */
    const gol={id:'g'+Date.now(),team:lmEquipo,scorerId:jug||null,assistId:null,min:ev.minuto,evId:ev.id};
    state.match.goals.push(gol);ev.golId=gol.id;cloudSaveEvent(ev);renderScoreboard()
  }
  const quien=jug?' · '+playerTag(jug):'';
  const texto=`${EVENTO_IC[tipo]||''} ${DIRECTO_NOM[tipo]||EVENTO_NOM[tipo]||tipo}${quien}${zona?' · '+ZONA_ETI[zona]:''}${lmEquipo==='rival'?' · rival':''}`;
  lmDeshacer.push({ids,texto});
  if(lmDeshacer.length>5)lmDeshacer.shift();
  try{navigator.vibrate&&navigator.vibrate(30)}catch(_){}
  lmConfirmar(texto);lmPintarContador();lmPintarDeshacer();persist();refrescarPaneles()
}
function lmConfirmar(texto){
  const f=$('#lmFlash');if(!f)return;
  f.textContent=texto;f.hidden=false;
  // Fuerza el reinicio de la animación cuando llegan dos registros seguidos.
  f.classList.remove('on');void f.offsetWidth;f.classList.add('on');
  clearTimeout(lmFlashTimer);
  lmFlashTimer=setTimeout(()=>{f.classList.remove('on');f.hidden=true},900)
}
function lmDeshacerUltima(){
  const paso=lmDeshacer.pop();
  if(!paso){showToast('No hay nada que deshacer');return}
  paso.ids.forEach(id=>borrarEvento(id));
  try{navigator.vibrate&&navigator.vibrate(20)}catch(_){}
  lmPintarContador();lmPintarDeshacer();lmConfirmar('Deshecho · '+paso.texto)
}
function lmToggleEquipo(){
  lmEquipo=lmEquipo==='rival'?'own':'rival';
  lmPintarEquipo();
  if(lmEvPend){
    /* Cambiar a RIVAL con la pantalla de jugadores abierta la deja sin sentido:
       lo que se está eligiendo es del once propio. Se pasa al campo y se suelta
       al jugador que hubiera marcado, que ya no es de quien se habla. */
    if(!$('#lmPJ').hidden&&lmEquipo==='rival'){lmJugPend=null;lmAbrirZonas(lmEvPend)}
    else if(!$('#lmP2').hidden){
      $('#lmzHint').textContent=lmEquipo==='rival'
        ?'Acción del rival · toca la zona'
        :(lmJugPend?playerTag(lmJugPend)+' · toca la zona':'Toca la zona donde ha pasado');
      lmArmarAutoCancel()
    }
    else lmArmarAutoCancel(DIRECTO_JUG_MS)
  }
  try{navigator.vibrate&&navigator.vibrate(15)}catch(_){}
}
function lmInvertir(){
  lmInvertido=!lmInvertido;lmPintarOrientacion();
  if(lmEvPend){$('#lmzField').innerHTML=lmCampoHTML();lmArmarAutoCancel()}
}
/* Cableado: los nodos de la pantalla completa son fijos y están en el HTML, así
   que se enlazan una sola vez. Los botones de evento van por delegación porque
   la rejilla se pinta desde JS. */
$('#lmP1').addEventListener('click',e=>{
  const b=e.target.closest('[data-ev]');
  if(b)lmPulsarEvento(b.dataset.ev)
});
$('#lmzField').addEventListener('click',e=>{
  const b=e.target.closest('[data-zona]');
  if(b)lmTocarZona(b.dataset.zona,b)
});
/* Hoja de controles: en móvil los tres botones del reloj no caben en la barra.
   Se abre y se cierra desde aquí, y cada acción es la misma que la del icono
   equivalente del escritorio, para no tener dos caminos que puedan divergir. */
function lmAbrirHoja(){
  $('#lmSheetHalf').textContent='Fin de la '+halfName(state.live.half);
  $('#lmSheet').hidden=false;$('#lmMore').setAttribute('aria-expanded','true')
}
function lmCerrarHoja(){$('#lmSheet').hidden=true;$('#lmMore').setAttribute('aria-expanded','false')}
$('#lmMore').onclick=()=>$('#lmSheet').hidden?lmAbrirHoja():lmCerrarHoja();
$('#lmSheet').addEventListener('click',e=>{
  const b=e.target.closest('[data-act]');
  if(!b){if(e.target===$('#lmSheet'))lmCerrarHoja();return}   // tocar fuera cierra
  lmCerrarHoja();
  if(b.dataset.act==='half')$('#lmHalfBtn').click();
  else if(b.dataset.act==='finish')$('#lmFinish').click();
  else if(b.dataset.act==='exit')$('#lmExit').click()
});
$('#lmzClose').onclick=lmCancelarRegistro;
$('#lmjClose').onclick=lmCancelarRegistro;
$('#lmjSkip').onclick=lmSaltarJugador;
$('#lmjBody').addEventListener('click',e=>{
  const b=e.target.closest('[data-jug]');
  if(b)lmTocarJugador(b.dataset.jug,b)
});
$('#lmzFlip').onclick=lmInvertir;
$('#lmUndo').onclick=lmDeshacerUltima;
$('#lmTeam').onclick=lmToggleEquipo;
$('#lmPause').onclick=()=>{state.live.running?livePause():liveResume()};
$('#lmHalfBtn').onclick=()=>{
  const L=state.live;
  if(confirm(`¿Dar por terminada la ${halfName(L.half)}?`))liveEndHalf()
};
$('#lmFinish').onclick=()=>{if(confirm('¿Finalizar el partido y abrir el informe?'))liveFinish()};
$('#lmExit').onclick=()=>{cerrarDirecto();renderBoard();showToast('El partido sigue en marcha')};
addEventListener('keydown',e=>{
  if(!lmAbierto||e.key!=='Escape')return;
  e.preventDefault();
  if(!$('#lmSheet').hidden)lmCerrarHoja();
  else if(lmEvPend)lmCancelarRegistro();
  else cerrarDirecto()
});

/* ===== Informe del partido: campo, mapa de calor y tablas =====
   Vista propia, no pop-up: el campo con la rejilla 3×3 es lo primero que se ve.
   Las métricas derivadas (pérdidas en inicio de juego, en zona media o en campo
   rival) se calculan aquí a partir de los eventos `perdida`; no tienen botón
   propio para que no haya dos cuentas distintas del mismo dato. */
const METRICAS=[
  {id:'llegada_area', g:'Ataque',    n:'Entradas al área',            c:'verde', f:e=>e.tipo==='llegada_area'},
  {id:'llegada_banda',g:'Ataque',    n:'Llegadas por banda (origen del ataque)', c:'verde', f:e=>e.tipo==='llegada_banda'},
  {id:'tiro_puerta',  g:'Ataque',    n:'Tiros (distribución)',        c:'verde', f:e=>e.tipo==='tiro_puerta'},
  {id:'centro_remate',g:'Ataque',    n:'Centros con remate',          c:'verde', f:e=>e.tipo==='centro_remate'},
  {id:'dos_por_uno',  g:'Ataque',    n:'2x1 con centro al área',      c:'verde', f:e=>e.tipo==='dos_por_uno'},
  {id:'profundidad',  g:'Ataque',    n:'Ataques a la profundidad',    c:'verde', f:e=>e.tipo==='profundidad'},
  {id:'gol',          g:'Ataque',    n:'Goles',                       c:'verde', f:e=>e.tipo==='gol'},
  {id:'asistencia',   g:'Ataque',    n:'Asistencias',                 c:'verde', f:e=>e.tipo==='asistencia'},
  {id:'regate_ok',    g:'Ataque',    n:'Regates exitosos',            c:'verde', f:e=>e.tipo==='regate_ok'},
  {id:'regate_fallo', g:'Ataque',    n:'Regates fallidos',            c:'rojo',  f:e=>e.tipo==='regate_fallo'},
  {id:'foul_won',     g:'Ataque',    n:'Faltas recibidas',            c:'verde', f:e=>e.tipo==='foul_won'},
  {id:'perdida',      g:'Defensa',   n:'Pérdidas (todas)',            c:'rojo',  f:e=>e.tipo==='perdida'},
  {id:'perdida_def',  g:'Defensa',   n:'Pérdidas en inicio de juego', c:'rojo',  f:e=>e.tipo==='perdida'&&zonaFranja(e.zona)==='def'},
  {id:'perdida_med',  g:'Defensa',   n:'Pérdidas en zona media',      c:'rojo',  f:e=>e.tipo==='perdida'&&zonaFranja(e.zona)==='med'},
  {id:'perdida_ata',  g:'Defensa',   n:'Pérdidas en campo rival',     c:'rojo',  f:e=>e.tipo==='perdida'&&zonaFranja(e.zona)==='ata'},
  {id:'recuperacion', g:'Defensa',   n:'Recuperaciones',              c:'verde', f:e=>e.tipo==='recuperacion'},
  {id:'duelo_ganado', g:'Defensa',   n:'Duelos ganados',              c:'verde', f:e=>e.tipo==='duelo_ganado'},
  {id:'duelo_perdido',g:'Defensa',   n:'Duelos perdidos',             c:'rojo',  f:e=>e.tipo==='duelo_perdido'},
  {id:'ocasion_conc', g:'Defensa',   n:'Ocasiones concedidas',        c:'rojo',  f:e=>e.tipo==='ocasion_conc'},
  {id:'foul_made',    g:'Defensa',   n:'Faltas cometidas',            c:'rojo',  f:e=>e.tipo==='foul_made'},
  {id:'pase_fallido', g:'Defensa',   n:'Pases fallidos',              c:'rojo',  f:e=>e.tipo==='pase_fallido'},
  {id:'error_despeje',g:'Defensa',   n:'Errores en despeje',          c:'rojo',  f:e=>e.tipo==='error_despeje'},
  {id:'llegada_rival',g:'Defensa',   n:'Llegadas del rival',          c:'rojo',  f:e=>e.tipo==='llegada_rival'},
  {id:'balance',      g:'Combinada', n:'Balance defensivo (rec. − pérd.)', c:'div'},
  {id:'regate_pct',   g:'Combinada', n:'% de acierto en regate',      c:'pct'}
];
// Por id, nunca por posición: la lista crece y un índice fijo acaba señalando
// a otra métrica distinta de la que se quería por defecto.
const metricaDe=id=>METRICAS.find(m=>m.id===id)||METRICAS.find(m=>m.id==='perdida');
// 6 escalones discretos en vez de degradado: se lee mejor en el móvil y con sol.
const RAMPA={rojo:['#eef3f0','#ffe1de','#ffb8b0','#f6867d','#e04e57','#a61f2b'],verde:['#eef3f0','#daf1e3','#a5e0bd','#59c78f','#199f68','#0c6742']};
const pasoDe=(v,max)=>!v||max<=0?0:Math.max(1,Math.min(5,Math.ceil(Math.abs(v)/max*5)));
const CAMPO_W=300,CAMPO_H=452;

let repMetrica='perdida',repJugador='',repParte='',repMinDe=0,repMinA=130,repZona=null,repFiltrosAbiertos=false;
/* Por defecto el mapa es el nuestro, como siempre. Desde el modo en directo
   también se apuntan acciones del rival (con el toggle de la barra superior),
   así que ahora el equipo es un filtro más en vez de un descarte fijo. */
let repEquipo='own';

function eventosDelPartido(){return state.live.events.filter(e=>e.tipo!=='sub')}
function eventosFiltrados(){
  return eventosDelPartido().filter(e=>{
    if(repEquipo&&(e.team||'own')!==repEquipo)return false;
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
  $('#repFilterToggle').textContent=(repFiltrosAbiertos?'▴':'▾')+' Filtros'+(repJugador||repParte||repEquipo!=='own'||repMinDe>0||repMinA<130?' · activos':'');
  $('#repFilters').hidden=!repFiltrosAbiertos;
  $('#repFilters').innerHTML=`
    <label>Equipo<select id="repF_eq"><option value="own"${repEquipo==='own'?' selected':''}>Nosotros</option><option value="rival"${repEquipo==='rival'?' selected':''}>${esc(state.match.opponent||'Rival')}</option><option value=""${repEquipo===''?' selected':''}>Los dos</option></select></label>
    <label>Jugador<select id="repF_jug"><option value="">Todos</option>${jugadoresConDatos.map(p=>`<option value="${p.id}"${repJugador===p.id?' selected':''}>${esc(p.name)}</option>`).join('')}</select></label>
    <label>Parte<select id="repF_parte"><option value="">Partido completo</option>${[1,2,3,4].filter(h=>h<=Math.max(2,L.half)).map(h=>`<option value="${h}"${repParte===String(h)?' selected':''}>${halfName(h)}</option>`).join('')}</select></label>
    <label>Desde el minuto<input id="repF_de" type="number" min="0" max="130" value="${repMinDe}" /></label>
    <label>Hasta el minuto<input id="repF_a" type="number" min="0" max="130" value="${repMinA}" /></label>
    <button type="button" class="text-btn" id="repF_reset">Quitar filtros</button>
    <p class="rep-note">Los filtros afectan al mapa y al resumen por zonas. Las tablas de equipo y de jugadores muestran el partido completo.</p>`;
  $('#repF_eq').onchange=e=>{repEquipo=e.target.value;repZona=null;renderReport()};
  $('#repF_jug').onchange=e=>{repJugador=e.target.value;repZona=null;renderReport()};
  $('#repF_parte').onchange=e=>{repParte=e.target.value;repZona=null;renderReport()};
  $('#repF_de').onchange=e=>{repMinDe=Math.max(0,Math.min(130,+e.target.value||0));renderReport()};
  $('#repF_a').onchange=e=>{repMinA=Math.max(repMinDe,Math.min(130,+e.target.value||130));renderReport()};
  $('#repF_reset').onclick=()=>{repEquipo='own';repJugador='';repParte='';repMinDe=0;repMinA=130;repZona=null;renderReport()};

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
  renderHalvesPanel();
  renderPlayersPanel();
  renderSummaryPanel(m,d);
  renderTimelinePanel();
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
  const rival=(e.team||'own')==='rival',otro=state.match.opponent||'Rival';
  // El nombre del equipo entra tal cual (lo escapa el esc() de abajo, junto con
  // todo lo demás que escribe el usuario).
  const quien=e.ambito==='equipo'
    ?(rival?otro:(state.club||'Equipo'))
    :(e.jugadorId?nombreDe(e.team,e.jugadorId):(rival?otro:'—'));
  return `<li data-ev-row="${e.id}" class="${rival?'rz-rival':''}"><span class="rz-min">${e.minuto?e.minuto+'′':'–'}</span><span class="rz-tipo">${EVENTO_IC[e.tipo]||''} ${esc(EVENTO_NOM[e.tipo]||e.tipo)}</span><span class="rz-quien">${esc(quien)}</span><span class="rz-zona">${e.zona?ZONA_ETI[e.zona]:'sin zona'}</span><button type="button" class="rz-btn" data-ev-zone="${e.id}" title="Cambiar zona">✎</button><button type="button" class="rz-btn del" data-ev-del="${e.id}" title="Borrar evento">×</button></li>`
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
/* Los córners llevan el lado en el propio tipo (a favor / en contra), así que se
   cuentan por tipo y da igual en qué posición estuviera el toggle
   Nosotros/Rival al apuntarlos. El resto de acciones sí son de quien las hizo. */
function contarTipoEquipo(lista,tipo){
  return tipo.startsWith('corner_')
    ?lista.filter(e=>e.tipo===tipo).length
    :lista.filter(e=>e.tipo===tipo&&(e.team||'own')!=='rival').length
}
function renderTeamPanel(){
  const todos=eventosDelPartido(),ev=todos.filter(e=>(e.team||'own')!=='rival');
  const n=t=>ev.filter(e=>e.tipo===t).length;
  const nc=t=>todos.filter(e=>e.tipo===t).length;
  const perdFranja=f=>ev.filter(e=>e.tipo==='perdida'&&zonaFranja(e.zona)===f).length;
  const ataque=[['Llegadas por banda',n('llegada_banda')],['Entradas al área',n('llegada_area')],['Tiros',n('tiro_puerta')],['Centros con remate',n('centro_remate')],['2x1 con centro al área',n('dos_por_uno')],['Ataques a la profundidad',n('profundidad')],['Faltas recibidas',n('foul_won')]];
  const defensa=[['Recuperaciones',n('recuperacion')],['Duelos ganados',n('duelo_ganado')],['Duelos perdidos',n('duelo_perdido')],['Ocasiones concedidas',n('ocasion_conc')],['Pérdidas en inicio de juego',perdFranja('def')],['Pérdidas en zona media',perdFranja('med')],['Llegadas del rival',n('llegada_rival')],['Faltas cometidas',n('foul_made')]];
  const llegadas=n('llegada_area'),llegadasR=n('llegada_rival'),tiros=n('tiro_puerta');
  const cf=nc('corner_favor'),cc=nc('corner_contra'),ct=cf+cc;
  const dominio=llegadasR?(llegadas/llegadasR).toFixed(2).replace('.',','):(llegadas?'—':'0');
  const eficacia=llegadas?(tiros/llegadas*10).toFixed(1).replace('.',','):'—';
  const col=(t,filas)=>`<div class="rt-col"><h4>${t}</h4><ul>${filas.map(([k,v])=>`<li><span>${k}</span><b>${v}</b></li>`).join('')}</ul></div>`;
  // El porcentaje nunca va solo: con seis córners en un partido, "67%" no dice
  // nada y "4 de 6" sí.
  const pctC=v=>ct?` · ${v} de ${ct}, ${Math.round(v/ct*100)}%`:'';
  $('#repTeam').innerHTML=`<div class="rep-card-head"><span class="eyebrow">EQUIPO</span><h3>Totales del partido</h3></div>
    <div class="rt-cols">${col('Ataque',ataque)}${col('Defensa',defensa)}</div>
    <div class="rt-ratios">
      <div><span>Córners</span><b>${cf} – ${cc}</b><small>a favor – en contra${ct?` · ${ct} en total${pctC(cf)} a favor`:' · ninguno registrado'}</small></div>
      <div><span>Dominio del partido</span><b>${llegadas} – ${llegadasR}</b><small>entradas al área propias vs. llegadas del rival${llegadasR?` · ${dominio}×`:''}</small></div>
      <div><span>Eficacia en finalización</span><b>${eficacia}</b><small>tiros por cada 10 entradas al área</small></div>
    </div>`
}

/* Comparativa 1ª / 2ª parte. Siempre con el número absoluto delante del
   porcentaje: en un partido de 40 acciones un porcentaje suelto engaña. */
const FILAS_PARTE=[
  ['llegada_banda','Llegadas por banda'],['llegada_area','Entradas al área'],['tiro_puerta','Tiros'],['gol','Goles'],
  ['recuperacion','Recuperaciones'],['duelo_ganado','Duelos ganados'],['duelo_perdido','Duelos perdidos'],
  ['perdida','Pérdidas'],['ocasion_conc','Ocasiones concedidas'],
  ['foul_won','Faltas recibidas'],['foul_made','Faltas cometidas'],
  ['corner_favor','Córners a favor'],['corner_contra','Córners en contra']
];
function renderHalvesPanel(){
  const box=$('#repHalves');if(!box)return;
  const ev=eventosDelPartido();
  const cab='<div class="rep-card-head"><span class="eyebrow">RITMO DEL PARTIDO</span><h3>1ª parte y 2ª parte</h3></div>';
  const partes=[1,2].concat([3,4,5].filter(h=>ev.some(e=>(e.parte||1)===h)));
  const porParte=partes.map(h=>ev.filter(e=>(e.parte||1)===h));
  const filas=FILAS_PARTE.map(([t,nom])=>{
    const v=porParte.map(l=>contarTipoEquipo(l,t)),tot=v.reduce((a,b)=>a+b,0);
    return {nom,v,tot}
  }).filter(f=>f.tot>0);
  if(!filas.length){box.innerHTML=cab+'<p class="rep-hint">Todavía no hay acciones registradas en el partido.</p>';return}
  const th=partes.map(h=>`<th scope="col">${halfName(h)}</th>`).join('');
  const cuerpo=filas.map(f=>`<tr><th scope="row">${f.nom}</th>${f.v.map(x=>
      `<td class="${x?'':'cero'}">${x}<small>${f.tot?Math.round(x/f.tot*100)+'%':'—'}</small></td>`).join('')}<td class="rh-tot">${f.tot}</td></tr>`).join('');
  box.innerHTML=cab
    +'<p class="rep-hint">Reparto de cada acción entre las partes. El porcentaje es sobre el total de esa fila; al lado va siempre el número real.</p>'
    +`<div class="rep-table-wrap"><table class="rep-table rep-halves"><thead><tr><th scope="col">Acción</th>${th}<th scope="col">Total</th></tr></thead><tbody>${cuerpo}</tbody></table></div>`
}

/* Línea temporal: todo el partido minuto a minuto, en un solo sitio y con los
   mismos botones de corregir zona y borrar que el resto del informe. */
function renderTimelinePanel(){
  const box=$('#repTimeline');if(!box)return;
  const cab='<div class="rep-card-head"><span class="eyebrow">MINUTO A MINUTO</span><h3>Cronología del partido</h3></div>';
  const ev=eventosDelPartido().slice().sort((a,b)=>(a.parte||1)-(b.parte||1)||(a.minuto||0)-(b.minuto||0)||(a.ts||0)-(b.ts||0));
  if(!ev.length){box.innerHTML=cab+'<p class="rep-hint">Sin acciones registradas.</p>';return}
  const partes=[...new Set(ev.map(e=>e.parte||1))].sort((a,b)=>a-b);
  const bloques=partes.map(h=>{
    const lista=ev.filter(x=>(x.parte||1)===h);
    return `<div class="r-block"><h4>${halfName(h)} · ${lista.length} ${lista.length===1?'acción':'acciones'}</h4><ul class="rz-list">${lista.map(eventoFilaHTML).join('')}</ul></div>`
  }).join('');
  box.innerHTML=cab+'<p class="rep-hint">El partido completo, los dos equipos. Toca ✎ para corregir la zona de una acción o × para borrarla.</p>'+bloques;
  bindEventoFilas(box)
}

/* 4.3 Panel individual: nombres escritos, nunca iconos sueltos. En móvil hay
   scroll horizontal con la columna del jugador fija y se ocultan las columnas
   que no tienen ningún dato en este partido. */
/* Los cuatro del final nacieron como eventos de equipo y no tenían columna: en
   directo se guardaban sin jugador y no había nada que enseñar. Desde que la
   pantalla de jugadores les pone autor, sin estas columnas el entrenador
   marcaría a alguien y el dato no aparecería en ninguna tabla.
   Las columnas vacías se ocultan solas (ver el filtro de renderPlayersPanel),
   así que ampliar la lista no ensucia el informe de quien no las use. */
const COLS_JUG=[
  {t:'gol',n:'Goles'},{t:'asistencia',n:'Asistencias'},{t:'tiro_puerta',n:'Tiros a puerta'},
  {t:'regate_ok',n:'Regates exitosos'},{t:'regate_fallo',n:'Regates fallidos'},{t:'pct',n:'% acierto en regate'},
  {t:'recuperacion',n:'Recuperaciones'},{t:'perdida',n:'Pérdidas'},{t:'pase_fallido',n:'Pases fallidos'},
  {t:'centro_remate',n:'Centros con remate'},{t:'error_despeje',n:'Errores en despeje'},{t:'profundidad',n:'Ataques a la profundidad'},
  {t:'foul_won',n:'Faltas recibidas'},{t:'foul_made',n:'Faltas cometidas'},{t:'save',n:'Paradas'},
  {t:'yellow',n:'Tarjetas amarillas'},{t:'red',n:'Tarjetas rojas'},
  {t:'duelo_ganado',n:'Duelos ganados'},{t:'duelo_perdido',n:'Duelos perdidos'},
  {t:'llegada_area',n:'Entradas al área'},{t:'llegada_banda',n:'Llegadas por banda'},
  {t:'ocasion_conc',n:'Ocasiones concedidas'}
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
  // Córners y reparto por partes: se leen del partido entero, no del filtro,
  // porque son el titular del vestuario y no dependen del cuadrante elegido.
  const todos=eventosDelPartido();
  const cf=todos.filter(e=>e.tipo==='corner_favor').length,cc=todos.filter(e=>e.tipo==='corner_contra').length;
  if(cf||cc)lin.push(`Córners: ${cf} a favor y ${cc} en contra${cf+cc?` (${Math.round(cf/(cf+cc)*100)}% a favor de ${cf+cc})`:''}`);
  const accion=h=>todos.filter(e=>(e.parte||1)===h&&(e.team||'own')!=='rival'&&!e.tipo.startsWith('corner_')).length;
  const a1=accion(1),a2=accion(2),at=a1+a2;
  if(at)lin.push(`Reparto por partes: 1ª parte ${a1} acciones (${Math.round(a1/at*100)}%) · 2ª parte ${a2} (${Math.round(a2/at*100)}%)`);
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
    return `<li><span class="r-min">${x.min?x.min+'′':'–'}</span><span class="r-side ${x.team}"></span>⚽ <strong>${esc(goleadorDe(x.team,x.scorerId))}</strong>${a}</li>`
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
let db=null,auth=null,boardRef=null,keyHash='',saveTimer=null,unsubscribe=null;
/* Dueño de la pizarra abierta, tal y como lo tiene el servidor.
   null = heredada: se entra solo con la clave, como se ha hecho siempre.
   Con valor = cerrada: solo su dueño y sus invitados. Se refresca en cada
   snapshot porque puede cambiar desde otro dispositivo (al reclamarla). */
let boardOwner=null;
/* Declaradas aquí, ANTES del try: `nubeActiva=true` se asigna dentro de él, y
   con la declaración veinte líneas más abajo caía en la zona muerta del `let`.
   Resultado: ReferenceError en cada arranque, que el catch camuflaba de
   "Firebase no disponible" cuando en realidad `db` ya estaba asignado y la
   sincronización funcionaba. Lo que quedaba roto era el semáforo del modo en
   directo: con `nubeActiva` en false, estadoSync() devolvía 'off' siempre y
   marcaba "Sin conexión" aunque todo estuviese subiendo. */
let nubePend=0,syncOk=false,nubeActiva=false;
try{
  if(typeof firebase!=='undefined'&&FIREBASE_CONFIG.projectId!=='__PROJECT'+'_ID__'){
    firebase.initializeApp(FIREBASE_CONFIG);
    // Si el SDK de Auth no llegó a cargar (bloqueador, red a medias), se sigue
    // adelante sin él: las pizarras heredadas no lo necesitan.
    try{ auth=firebase.auth?firebase.auth():null }catch(e){ auth=null }
    db=firebase.firestore();
    db.enablePersistence({synchronizeTabs:true}).catch(()=>{});
    nubeActiva=true;
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
/* Estado de sincronización. Además del rótulo de la cabecera hay un semáforo en
   la barra del modo en directo: verde sincronizado, ámbar pendiente de subir,
   gris sin conexión. `nubePend` cuenta las escrituras de evento que aún no ha
   confirmado el servidor; sin cobertura la promesa de Firestore se queda
   colgada hasta que vuelve la red, que es justo lo que el ámbar quiere decir.
   `nubePend`, `syncOk` y `nubeActiva` se declaran arriba, junto a `db`: aquí
   abajo quedaban dentro de la zona muerta del `let` y reventaban al arrancar. */
function setSync(ok,label){
  syncOk=ok;
  const dot=$('#syncDot'),lab=$('#syncLabel');
  if(dot){dot.style.background=ok?'var(--green)':'var(--amber)';lab.textContent=label||(ok?'Sincronizado':'Sin conexión');$('.saved-status').classList.toggle('warn',!ok)}
  pintarSyncDirecto()
}
function estadoSync(){
  if(!nubeActiva||!navigator.onLine)return 'off';
  if(nubePend>0||!syncOk)return 'pend';
  return 'ok'
}
const SYNC_TXT={ok:'Sincronizado',pend:'Pendiente',off:'Sin conexión'};
function pintarSyncDirecto(){
  const el=$('#lmSync');if(!el)return;
  const est=estadoSync();
  el.dataset.est=est;
  $('#lmSyncTxt').textContent=SYNC_TXT[est]
}
function marcaNube(n){nubePend=Math.max(0,nubePend+n);pintarSyncDirecto()}
addEventListener('online',()=>{pintarSyncDirecto();reintentarPendientes()});
addEventListener('offline',pintarSyncDirecto);
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
/* La interfaz nunca espera a la red: el evento ya está en memoria y en el
   navegador antes de llamar aquí. Si la escritura falla (no si tarda: eso lo
   resuelve solo Firestore al volver la cobertura), el id queda en `fallidos` y
   se reintenta al recuperar conexión. */
const fallidos=new Set();
function cloudSaveEvent(ev){
  const r=eventosRef();if(!r)return;
  marcaNube(1);
  r.doc(ev.id).set(limpioParaNube(ev))
    .then(()=>{fallidos.delete(ev.id);marcaNube(-1)})
    .catch(e=>{fallidos.add(ev.id);marcaNube(-1);console.warn('Evento sin sincronizar:',e)})
}
function cloudDeleteEvent(id){const r=eventosRef();if(!r)return;fallidos.delete(id);r.doc(id).delete().catch(()=>{})}
function reintentarPendientes(){
  if(!eventosRef()||!fallidos.size)return;
  const ids=[...fallidos];
  ids.forEach(id=>{const ev=state.live.events.find(e=>e.id===id);if(ev)cloudSaveEvent(ev);else fallidos.delete(id)})
}
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
    saveLocal();renderScoreboard();refrescarPaneles();lmPintarContador();
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
  const carga={data:json,writer:CLIENT_ID,updatedAt:firebase.firestore.FieldValue.serverTimestamp()};
  /* Reclamar la pizarra, solo en el caso seguro.
     `udt-owner` lo deja la pantalla de cuenta al abrir una pizarra DESDE la
     lista del usuario. Es lo que distingue "esta pizarra es mía" de "he
     tecleado una clave que me han pasado": sin esa distinción, el ayudante que
     abriese la clave compartida antes que el entrenador se quedaría con la
     pizarra y dejaría fuera al jefe.
     Solo se pone si no hay dueño ya; las reglas además exigen que coincida con
     el usuario de la sesión, así que esto no puede reclamar a nombre de otro. */
  const uid=auth&&auth.currentUser&&auth.currentUser.uid;
  if(uid&&!boardOwner&&localStorage.getItem('udt-owner')===uid)carga.owner=uid;
  /* merge:true es obligatorio desde que existe `owner`. Con el set() de antes,
     que reemplazaba el documento entero, el primer guardado tras reclamar una
     pizarra habría borrado el campo `owner` y la habría dejado abierta otra
     vez, en silencio. `data` se sigue reemplazando entero, que es lo que se
     quiere: merge solo protege los campos que la app no manda. */
  boardRef.set(carga,{merge:true})
    .then(()=>setSync(true))
    .catch(e=>{
      console.warn('Error al guardar en la nube:',e);
      if(e&&e.code==='permission-denied'){
        setSync(false,'Sin permiso');
        showToast('Esta pizarra pertenece a otra cuenta. Pide a su dueño que te invite desde "Tus pizarras".',7000)
      }else{
        setSync(false,'No se pudo guardar');
        showToast('No se han podido guardar los cambios en la nube. Revisa la conexión.',4000)
      }
    })
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
/* ===== Bienvenida de una pizarra nueva =====
   Solo se enseña cuando el SERVIDOR ha confirmado que esta pizarra no existía.
   Dispararla porque el nombre del club esté vacío se la pondría delante a quien
   ya tiene su pizarra montada y entra sin cobertura: en ese momento lo que hay
   en memoria son los datos de ejemplo, no los suyos, y "Empezar" le grabaría el
   nombre encima de su pizarra real. */
let bienvenidaVista=false;
function quizaBienvenida(esNueva){
  if(bienvenidaVista||!esNueva)return;
  if(state.club||state.crest)return;   // ya tiene identidad: nada que preguntar
  bienvenidaVista=true;
  openClub(true)
}
async function connectBoard(key){
  bienvenidaVista=false;               // cada cambio de clave es otra pizarra
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
  // Sin Firebase no hay servidor al que preguntar: "nueva" es no tener copia
  // local de esta clave, que es lo único comprobable aquí.
  if(!db){setSync(false,'Solo local');quizaBienvenida(!localIsThisBoard);return}
  if(unsubscribe)unsubscribe();
  boardRef=db.collection('pizarras').doc(keyHash);
  subscribeEvents();
  setSync(false,'Conectando…');
  unsubscribe=boardRef.onSnapshot(s=>{
    // fromCache = Firestore contesta de su memoria local, sin haber hablado con
    // el servidor. Mientras sea true no sabemos si la nube tiene datos, así que
    // no se toca: es justo el caso en el que antes se perdía la plantilla.
    if(s.metadata.fromCache)return;
    // Puede cambiar en cualquier momento: reclamarla desde otro dispositivo se
    // ve aquí. Se refresca en TODOS los snapshots, no solo en el primero.
    boardOwner=s.exists?(s.data().owner||null):null;
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
      // `remoto` vacío = el servidor confirma que esta pizarra no existía.
      quizaBienvenida(!remoto);
      return
    }
    if(s.metadata.hasPendingWrites)return;
    // Si este dispositivo lleva el cronómetro en marcha, no se deja sobrescribir
    // por lo que llegue de otro: sus datos en directo mandan hasta pausar/finalizar.
    if(isTimekeeper&&state.live.running)return;
    const d=s.data();
    if(d.writer===CLIENT_ID||!d.data)return;
    applyRemote(d.data)
  },e=>{
    console.warn('Error de sincronización:',e);
    cloudReady=false;
    // Acertar la clave ya no basta si la pizarra tiene dueño. Sin este aviso el
    // usuario solo vería "Sin sincronizar" y creería que es cosa de la red.
    if(e&&e.code==='permission-denied'){
      setSync(false,'Sin permiso');
      showToast('Esta pizarra pertenece a otra cuenta. Entra con ella, o pide a su dueño que te invite.',8000)
    }else setSync(false,'Sin sincronizar')
  })
}
/* ¿Existe ya esta pizarra?
   Solo se usa para decidir si la clave ABRE algo o intentaría fabricarlo.

   Falla ABIERTO a propósito. Si la comprobación no se puede hacer —sin
   cobertura en el campo, Firestore tardando, permiso denegado— se deja pasar y
   que decida connectBoard(). Al revés, un fallo de red dejaría al entrenador
   plantado en la pantalla de acceso a diez minutos del partido, que es mucho
   peor que crear una pizarra de más. */
async function pizarraExiste(clave){
  if(!db)return true;
  try{
    const h=await sha256hex('udt·pizarra·'+clave);
    const d=await db.collection('pizarras').doc(h).get();
    return d.exists
  }catch(e){ console.warn('No se pudo comprobar si la pizarra existe:',e); return true }
}

$('#authForm').onsubmit=async e=>{
  e.preventDefault();
  const k=$('#accessKey').value.trim();
  if(k.length<6){$('#authError').textContent='La clave debe tener al menos 6 caracteres.';return}
  $('#authError').textContent='';
  const btn=$('#enterBtn');btn.disabled=true;btn.textContent='Conectando…';
  /* Crear una pizarra nueva ya solo se hace desde una cuenta. Antes, cualquier
     clave que no existiese fabricaba una pizarra en el acto: eso permitía tener
     pizarras ilimitadas sin registrarse y saltarse el tope de tres, que solo
     cuenta lo que hay dentro de una cuenta.
     Esta puerta sigue ABRIENDO las que ya existen, que es lo que mantiene
     dentro a quien lleva media temporada con su clave. */
  if(!await pizarraExiste(k)){
    $('#authError').innerHTML='No hay ninguna pizarra con esa clave. Para crear una nueva, <a href="/app/login.html">entra con tu cuenta</a>.';
    btn.disabled=false;btn.textContent='Entrar';
    return
  }
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
    // Con ?clave, y no un reload a secas: sin clave guardada el desvío del
    // <head> mandaría a la landing justo a quien acaba de pedir teclear otra.
    localStorage.removeItem('udt-key');location.replace('/?clave')
  }
};
(function boot(){
  const k=localStorage.getItem('udt-key');
  if(k){$('#authOverlay').classList.add('hidden');connectBoard(k)}
})();
