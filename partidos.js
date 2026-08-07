/* ===== Partidos jugados: el histórico =====
   Hasta ahora la app solo conocía un partido, el actual: liveStart() vaciaba
   los minutos y borraba en lote los eventos de la nube, así que cada partido
   nuevo se llevaba por delante al anterior. Aquí se archiva una copia al
   finalizar, antes de que nadie pueda pulsar "Iniciar partido".

   La copia es INMUTABLE de verdad: dentro del documento se guardan el nombre y
   el dorsal de cada jugador implicado, no su id. Si mañana se da de baja a un
   jugador de la plantilla, el partido de hace tres meses lo sigue nombrando
   bien. Lo mismo con el nombre del club y el del rival.

   Dos documentos por partido, a propósito:
     pizarras/{clave}/partidos/{id}                 cabecera  (lo que lee el listado)
     pizarras/{clave}/partidos/{id}/detalle/informe cuerpo    (solo al abrir uno)
   Con un único documento Firestore no sabe traer "solo unos campos", así que
   listar veinte partidos se descargaría veinte informes enteros.

   El cuerpo va como cadena JSON en un solo campo, igual que el documento de la
   pizarra hace con `data`: es el patrón que ya usa la app y evita pelearse con
   los arrays anidados de Firestore.

   Sin conexión funciona como todo lo demás: la persistencia de Firestore sirve
   el listado desde su caché y encola las escrituras hasta que vuelve la red. */
(function(){
'use strict';

const $=s=>document.querySelector(s);
const VERSION_COPIA=1;

let desuscribir=null,refUsada=null;
let cabeceras=[],abierto=null,cargandoDetalle=false;
const cacheDetalle=new Map();     // id → informe ya descargado, para no repetir la lectura al ir y volver

/* ---------- Acceso a la colección ----------
   boardRef es de app.js y se rellena dentro de connectBoard(), que es asíncrona,
   así que se lee siempre tarde, nunca al cargar este archivo. */
function coleccion(){
  try{ return boardRef?boardRef.collection('partidos'):null }catch(_){ return null }
}
const hoyISO=()=>new Date().toISOString().slice(0,10);
function fechaBonita(iso){
  if(!iso)return '—';
  const p=String(iso).slice(0,10).split('-');
  return p.length===3?`${p[2]}/${p[1]}/${p[0]}`:iso;
}

/* ---------- Archivar al finalizar ----------
   El id del documento es el matchId del partido, así que volver a finalizar el
   mismo partido reescribe su copia en vez de dejar dos. */
function copiaJugador(team,id){
  const roster=team==='rival'?state.rivals:state.players;
  const p=(roster||[]).find(x=>x.id===id);
  return {id:id||null,nombre:p?p.name:null,dorsal:p&&p.number!==''?p.number:null};
}
function construirCopia(){
  const L=state.live,M=state.match||{};
  const goles=(M.goals||[]).map(g=>{
    const gol=copiaJugador(g.team,g.scorerId),asi=g.assistId?copiaJugador(g.team,g.assistId):null;
    return {id:g.id,team:g.team,min:g.min??null,
            goleador:gol.nombre,goleadorDorsal:gol.dorsal,
            asistente:asi?asi.nombre:null}
  });
  // Cada evento se lleva dentro el nombre y el dorsal de quien lo hizo.
  const eventos=(L.events||[]).filter(e=>e.tipo!=='sub').map(e=>{
    const j=e.jugadorId?copiaJugador(e.team,e.jugadorId):null;
    return Object.assign({},e,{nombre:j?j.nombre:null,dorsal:j?j.dorsal:null})
  });
  const cambios=(L.events||[]).filter(e=>e.tipo==='sub').map(e=>({
    minuto:e.minuto??null,parte:e.parte||1,
    entra:copiaJugador(e.team||'own',e.inId).nombre,
    sale:copiaJugador(e.team||'own',e.outId).nombre
  }));
  const minutos=Object.keys(L.minutes||{})
    .map(id=>{const c=copiaJugador('own',id);return {nombre:c.nombre,dorsal:c.dorsal,segundos:L.minutes[id]||0}})
    .filter(x=>x.nombre&&x.segundos>0)
    .sort((a,b)=>b.segundos-a.segundos);
  return {v:VERSION_COPIA,club:state.club||'Equipo',rival:M.opponent||'Rival',
          coloresRival:Object.assign({},state.rivalColors),
          duracionParte:L.halfLength||45,partes:Math.max(2,L.half||1),
          eventos,goles,cambios,minutos}
}
function construirCabecera(){
  const M=state.match||{},g=M.goals||[];
  return {
    fecha:(M.date||hoyISO()).slice(0,10),
    ts:Date.now(),                                  // orden fiable aunque dos partidos compartan fecha
    local:state.club||'Equipo',
    visitante:M.opponent||'Rival',
    golesLocal:g.filter(x=>x.team==='own').length,
    golesVisitante:g.filter(x=>x.team==='rival').length,
    competicion:M.competition||'',
    lugar:M.venue||''
  }
}
function archivar(){
  const col=coleccion();
  if(!col){showToast('Partido no archivado: sin pizarra en la nube.',3500);return}
  const id=state.live.matchId||('m'+Date.now().toString(36));
  const cab=construirCabecera(),det=JSON.stringify(construirCopia());
  if(det.length>880000){
    showToast('El partido es demasiado grande para archivarlo entero.',5000);
    return
  }
  /* Sin cobertura, Firestore encola la escritura y su promesa se queda pendiente
     hasta que vuelve la red: por eso el aviso de "guardado" se da por adelantado
     y no es mentira. Lo que sí sería mentira es callarse un rechazo de verdad
     (reglas sin desplegar, cuota agotada): ahí el técnico se quedaría creyendo
     que tiene el partido guardado cuando no lo tiene, y "Iniciar partido"
     borrará los eventos de todas formas. */
  let avisado=false;
  const falla=e=>{
    console.warn('Partido sin archivar:',e);
    if(avisado)return;
    avisado=true;
    showToast(e&&e.code==='permission-denied'
      ?'ATENCIÓN: el partido NO se ha guardado. Falta desplegar las reglas de Firestore.'
      :'ATENCIÓN: el partido no se ha podido guardar en el histórico.',8000)
  };
  col.doc(id).set(cab).catch(falla);
  col.doc(id).collection('detalle').doc('informe').set({datos:det}).catch(falla);
  cacheDetalle.delete(id);
  showToast('Partido guardado en “Partidos jugados”.',3000)
}

/* ---------- Listado ----------
   Suscripción en vivo a la colección de CABECERAS. El informe no se toca aquí:
   son unos pocos campos por partido. */
function suscribir(){
  const col=coleccion();
  if(!col||refUsada===boardRef)return;
  if(desuscribir){desuscribir();desuscribir=null}
  refUsada=boardRef;
  desuscribir=col.onSnapshot(snap=>{
    cabeceras=snap.docs.map(d=>Object.assign({id:d.id},d.data()))
      .sort((a,b)=>(b.ts||0)-(a.ts||0)||String(b.fecha).localeCompare(String(a.fecha)));
    pintarContador();
    if(vistaActiva()&&!abierto)pintarLista()
  },e=>{
    console.warn('Histórico sin sincronizar:',e);
    const c=$('#matchesList');
    if(c&&vistaActiva()&&!abierto)c.innerHTML=`<p class="rep-hint">${avisoError(e)}</p>`
  })
}
/* Distinguir "sin permisos" de "sin cobertura" no es un detalle: mandan a
   sitios opuestos. Con las reglas sin desplegar, Firestore contesta
   permission-denied y decir "revisa la conexión" hace perder la tarde. */
function avisoError(e){
  if(e&&e.code==='permission-denied')
    return 'El histórico no está habilitado en la nube todavía. Hay que desplegar las reglas de Firestore (<code>firebase deploy --only firestore:rules</code>). El resto de la app funciona con normalidad.';
  return 'No se ha podido leer el histórico. Revisa la conexión.'
}
const vistaActiva=()=>$('#matchesView')&&$('#matchesView').classList.contains('active');
function pintarContador(){const b=$('#matchesCount');if(b)b.textContent=cabeceras.length}

function filaHTML(p){
  const res=`${p.golesLocal??0} – ${p.golesVisitante??0}`;
  const gana=(p.golesLocal??0)>(p.golesVisitante??0),pierde=(p.golesLocal??0)<(p.golesVisitante??0);
  return `<li class="mp-fila" data-abrir="${p.id}">
    <span class="mp-fecha">${fechaBonita(p.fecha)}</span>
    <span class="mp-equipos"><b>${esc(p.local||'')}</b><i>vs</i><b>${esc(p.visitante||'')}</b>
      ${p.competicion?`<small>${esc(p.competicion)}</small>`:''}</span>
    <span class="mp-res ${gana?'gana':pierde?'pierde':'empata'}">${res}</span>
    <span class="mp-acciones">
      <button type="button" class="mp-btn" data-editar="${p.id}" title="Corregir la ficha">✎</button>
      <button type="button" class="mp-btn del" data-borrar="${p.id}" title="Borrar el partido">×</button>
    </span></li>`
}
function pintarLista(){
  const c=$('#matchesList');if(!c)return;
  abierto=null;
  $('#matchDetail').hidden=true;
  c.hidden=false;
  if(!coleccion()){
    c.innerHTML='<p class="rep-hint">Entra con tu clave de acceso para ver el histórico.</p>';return
  }
  if(!cabeceras.length){
    c.innerHTML='<p class="rep-hint">Todavía no hay partidos guardados. Cada vez que pulses <b>Finalizar</b> en un partido en directo, se archivará aquí con su informe.</p>';
    return
  }
  c.innerHTML=`<ul class="mp-lista">${cabeceras.map(filaHTML).join('')}</ul>`;
  c.querySelectorAll('[data-abrir]').forEach(f=>f.onclick=e=>{
    if(e.target.closest('[data-editar],[data-borrar]'))return;
    abrir(f.dataset.abrir)
  });
  c.querySelectorAll('[data-editar]').forEach(b=>b.onclick=e=>{e.stopPropagation();editar(b.dataset.editar)});
  c.querySelectorAll('[data-borrar]').forEach(b=>b.onclick=e=>{e.stopPropagation();borrar(b.dataset.borrar)})
}

/* ---------- Borrar y corregir ---------- */
function borrar(id){
  const p=cabeceras.find(x=>x.id===id);if(!p)return;
  if(!confirm(`¿Borrar el partido ${esc(p.local)} ${p.golesLocal}–${p.golesVisitante} ${esc(p.visitante)} del ${fechaBonita(p.fecha)}?\n\nSe borra también su informe. No se puede deshacer.`))return;
  const col=coleccion();if(!col)return;
  col.doc(id).collection('detalle').doc('informe').delete().catch(()=>{});
  col.doc(id).delete().catch(e=>{console.warn('No se pudo borrar:',e);showToast('No se ha podido borrar.',3000)});
  cacheDetalle.delete(id);
  showToast('Partido borrado')
}
/* Corrige solo la cabecera: la fecha, los dos equipos y el resultado, que es
   donde se equivoca uno al cerrar en caliente. El informe no se toca: es el
   registro de lo que se apuntó durante el partido. */
function editar(id){
  const p=cabeceras.find(x=>x.id===id);if(!p)return;
  const d=$('#matchEditDialog');
  d.dataset.id=id;
  $('#meFecha').value=(p.fecha||'').slice(0,10);
  $('#meLocal').value=p.local||'';
  $('#meVisitante').value=p.visitante||'';
  $('#meGolesLocal').value=p.golesLocal??0;
  $('#meGolesVisitante').value=p.golesVisitante??0;
  $('#meCompeticion').value=p.competicion||'';
  d.showModal()
}
function guardarEdicion(e){
  e.preventDefault();
  const d=$('#matchEditDialog'),id=d.dataset.id,col=coleccion();
  if(!id||!col){d.close();return}
  const cambios={
    fecha:$('#meFecha').value||hoyISO(),
    local:$('#meLocal').value.trim()||'Equipo',
    visitante:$('#meVisitante').value.trim()||'Rival',
    golesLocal:Math.max(0,+$('#meGolesLocal').value||0),
    golesVisitante:Math.max(0,+$('#meGolesVisitante').value||0),
    competicion:$('#meCompeticion').value.trim()
  };
  col.doc(id).update(cambios).catch(e2=>{console.warn('No se pudo corregir:',e2);showToast('No se ha podido guardar.',3000)});
  d.close();showToast('Ficha corregida')
}

/* ---------- Abrir un partido: aquí sí se descarga el informe ---------- */
async function abrir(id){
  const col=coleccion();if(!col||cargandoDetalle)return;
  const cab=cabeceras.find(x=>x.id===id);
  abierto=id;
  $('#matchesList').hidden=true;
  const box=$('#matchDetail');
  box.hidden=false;
  if(cacheDetalle.has(id)){pintarDetalle(cab,cacheDetalle.get(id));return}
  box.innerHTML='<p class="rep-hint">Abriendo el informe…</p>';
  cargandoDetalle=true;
  try{
    const doc=await col.doc(id).collection('detalle').doc('informe').get();
    const info=doc.exists?JSON.parse(doc.data().datos||'{}'):null;
    if(info)cacheDetalle.set(id,info);
    pintarDetalle(cab,info)
  }catch(err){
    console.warn('No se pudo abrir el informe:',err);
    box.innerHTML=`<button type="button" class="btn secondary" id="mdVolver">← Volver al listado</button>
      <p class="rep-hint">No se ha podido abrir el informe. Sin conexión solo están los partidos que ya hayas abierto en este dispositivo.</p>`;
    const v=$('#mdVolver');if(v)v.onclick=pintarLista
  }finally{ cargandoDetalle=false }
}

/* Informe archivado. Reutiliza METRICAS y campoSVG() de app.js para el mapa —así
   una métrica nueva también sale en los partidos viejos— y calcula el resto
   sobre la copia, que tiene los nombres dentro y ya no depende de la plantilla. */
let metricaHist='perdida';
function datosMapaHist(m,eventos){
  const z={},extra={};ZONAS.forEach(k=>{z[k]=0;extra[k]=''});
  let sin=0,total=0,max=0;
  eventos.filter(e=>(e.team||'own')!=='rival').forEach(e=>{
    if(!m.f||!m.f(e))return;
    total++;if(!e.zona){sin++;return}
    z[e.zona]++
  });
  ZONAS.forEach(k=>max=Math.max(max,z[k]));
  const conZona=total-sin;
  ZONAS.forEach(k=>extra[k]=conZona>0?Math.round(z[k]/conZona*100)+'%':'0%');
  return {z,extra,sin,total,conZona,max,modo:'conteo',color:m.c}
}
function tablaHist(titulo,filas){
  const con=filas.filter(f=>f[1]>0);
  if(!con.length)return '';
  return `<div class="rt-col"><h4>${titulo}</h4><ul>${con.map(([k,v])=>`<li><span>${esc(k)}</span><b>${v}</b></li>`).join('')}</ul></div>`
}
function pintarDetalle(cab,info){
  const box=$('#matchDetail');
  if(!info){
    box.innerHTML=`<button type="button" class="btn secondary" id="mdVolver">← Volver al listado</button>
      <p class="rep-hint">Este partido no tiene informe guardado.</p>`;
    $('#mdVolver').onclick=pintarLista;return
  }
  const ev=info.eventos||[],n=t=>ev.filter(e=>e.tipo===t&&(e.team||'own')!=='rival').length;
  const nc=t=>ev.filter(e=>e.tipo===t).length;
  // Métricas que de verdad tienen datos en este partido: no tiene sentido
  // ofrecer un desplegable con veinte opciones vacías.
  const conDatos=METRICAS.filter(m=>m.f&&ev.some(e=>m.f(e)&&(e.team||'own')!=='rival'));
  if(!conDatos.some(m=>m.id===metricaHist))metricaHist=(conDatos[0]||{id:'perdida'}).id;
  const m=METRICAS.find(x=>x.id===metricaHist)||METRICAS[0];
  const d=datosMapaHist(m,ev);

  const ataque=[['Llegadas por banda',n('llegada_banda')],['Entradas al área',n('llegada_area')],['Tiros',n('tiro_puerta')],
                ['Centros con remate',n('centro_remate')],['Ataques a la profundidad',n('profundidad')],['Goles',n('gol')]];
  const defensa=[['Recuperaciones',n('recuperacion')],['Duelos ganados',n('duelo_ganado')],['Duelos perdidos',n('duelo_perdido')],
                 ['Pérdidas',n('perdida')],['Ocasiones concedidas',n('ocasion_conc')],['Llegadas del rival',n('llegada_rival')],
                 ['Faltas recibidas',n('foul_won')],['Faltas cometidas',n('foul_made')]];
  const cf=nc('corner_favor'),cc=nc('corner_contra');

  const goles=(info.goles||[]).slice().sort((a,b)=>(a.min||999)-(b.min||999));
  const golesHTML=goles.length?goles.map(g=>`<li><span class="r-min">${g.min?g.min+'′':'–'}</span><span class="r-side ${g.team}"></span>⚽ <strong>${esc(g.goleador||'Sin asignar')}</strong>${g.asistente?` <i>(asist. ${esc(g.asistente)})</i>`:''}</li>`).join('')
                             :'<li class="tr-empty">Sin goles registrados.</li>';
  const minutos=(info.minutos||[]);
  const minHTML=minutos.length?minutos.map(x=>`<li><strong>${esc(x.nombre)}</strong><span class="r-min-val">${Math.floor(x.segundos/60)}′</span></li>`).join('')
                              :'<li class="tr-empty">Sin minutos registrados.</li>';
  const cambios=(info.cambios||[]);
  const camHTML=cambios.length?`<div class="r-block"><h4>Cambios</h4><ul class="r-list">${cambios.map(s=>`<li><span class="r-min">${s.minuto?s.minuto+'′':'–'}</span>▶ <strong>${esc(s.entra||'—')}</strong> ◀ ${esc(s.sale||'—')}</li>`).join('')}</ul></div>`:'';

  // Cronología: la copia ya trae el nombre dentro de cada evento.
  const partes=[...new Set(ev.map(e=>e.parte||1))].sort((a,b)=>a-b);
  const crono=partes.map(h=>{
    const l=ev.filter(x=>(x.parte||1)===h).sort((a,b)=>(a.minuto||0)-(b.minuto||0)||(a.ts||0)-(b.ts||0));
    return `<div class="r-block"><h4>${halfName(h)} · ${l.length} ${l.length===1?'acción':'acciones'}</h4>
      <ul class="rz-list">${l.map(e=>`<li class="${(e.team||'own')==='rival'?'rz-rival':''}">
        <span class="rz-min">${e.minuto?e.minuto+'′':'–'}</span>
        <span class="rz-tipo">${EVENTO_IC[e.tipo]||''} ${esc(EVENTO_NOM[e.tipo]||e.tipo)}</span>
        <span class="rz-quien">${esc(e.nombre||((e.team||'own')==='rival'?info.rival:info.club))}</span>
        <span class="rz-zona">${e.zona?ZONA_ETI[e.zona]:'sin zona'}</span></li>`).join('')}</ul></div>`
  }).join('');

  box.innerHTML=`
    <div class="md-top">
      <button type="button" class="btn secondary" id="mdVolver">← Volver al listado</button>
      <span class="md-sello">Copia guardada · no se edita</span>
    </div>
    <div class="rep-card md-cabecera">
      <span class="eyebrow">${esc(cab&&cab.competicion||'PARTIDO')}</span>
      <div class="md-marcador"><b>${esc(cab?cab.local:info.club)}</b>
        <em>${cab?cab.golesLocal:0} – ${cab?cab.golesVisitante:0}</em>
        <b>${esc(cab?cab.visitante:info.rival)}</b></div>
      <small>${fechaBonita(cab&&cab.fecha)}${cab&&cab.lugar?' · '+esc(cab.lugar):''} · ${ev.length} acciones registradas</small>
    </div>
    <section class="rep-card">
      <div class="rep-card-head"><span class="eyebrow">MAPA DEL PARTIDO</span><h3>Zonas del campo</h3></div>
      ${conDatos.length?`<label class="rep-metric-label">Métrica<select id="mdMetrica">${
        conDatos.map(x=>`<option value="${x.id}"${x.id===metricaHist?' selected':''}>${esc(x.n)}</option>`).join('')}</select></label>`:''}
      <div class="rep-field-wrap">${campoSVG(m,d,null)}</div>
      <span class="rep-tot">${d.total} ${d.total===1?'evento':'eventos'}${d.sin?` · ${d.sin} sin zona asignada`:''}</span>
    </section>
    <section class="rep-card">
      <div class="rep-card-head"><span class="eyebrow">EQUIPO</span><h3>Totales del partido</h3></div>
      <div class="rt-cols">${tablaHist('Ataque',ataque)}${tablaHist('Defensa',defensa)}</div>
      ${(cf||cc)?`<div class="rt-ratios"><div><span>Córners</span><b>${cf} – ${cc}</b><small>a favor – en contra</small></div></div>`:''}
    </section>
    <section class="rep-card">
      <div class="rep-card-head"><span class="eyebrow">PARTIDO</span><h3>Goles, minutos y cambios</h3></div>
      <div class="r-block"><h4>Goles</h4><ul class="r-list r-goals">${golesHTML}</ul></div>
      <div class="r-block"><h4>Minutos jugados</h4><ul class="r-list r-minutes">${minHTML}</ul></div>${camHTML}
    </section>
    ${crono?`<section class="rep-card"><div class="rep-card-head"><span class="eyebrow">MINUTO A MINUTO</span><h3>Cronología</h3></div>${crono}</section>`:''}`;

  $('#mdVolver').onclick=pintarLista;
  const sel=$('#mdMetrica');
  if(sel)sel.onchange=()=>{metricaHist=sel.value;pintarDetalle(cab,info)}
}

/* ---------- Enganche ---------- */
window.Partidos={
  archivar,
  refrescar(){ suscribir(); if(vistaActiva()&&!abierto)pintarLista() }
};
const nav=document.querySelector('.nav-item[data-view="matches"]');
if(nav)nav.addEventListener('click',()=>{ abierto=null; window.Partidos.refrescar() });
$('#matchEditForm').addEventListener('submit',guardarEdicion);
document.querySelectorAll('.close-match-edit').forEach(b=>b.onclick=()=>$('#matchEditDialog').close());

})();
