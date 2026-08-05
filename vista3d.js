/* ===== Vista 3D del campo principal =====
   Solo mira, no toca. Lee las MISMAS posiciones que la pizarra 2D
   (tactic().placed y tactic().opponentPlaced, en porcentajes 0–100) y las
   proyecta sobre un campo tridimensional. No hay estado nuevo, ni copia de las
   coordenadas, ni modelo de datos paralelo: si el 3D pinta algo distinto de lo
   que hay en la 2D, es un fallo de este archivo.

   Las posiciones se editan solo en 2D. Aquí no se arrastra nada a propósito:
   mezclar "girar la cámara" con "mover al jugador" en la misma pantalla táctil
   acaba descolocando el once cada vez que alguien quiere ver el campo de lado.

   three.js se carga la PRIMERA vez que se pulsa el botón, nunca al arrancar:
   son ~700 KB que no debe pagar quien entra a mirar la convocatoria desde el
   móvil en el campo.

   Convenio de ejes, heredado de la 2D para que las dos vistas coincidan:
     x 0→100 (izquierda→derecha)  ⇒  X  −W/2 → +W/2
     y 0→100 (portería rival→la nuestra) ⇒ Z  −L/2 → +L/2
   Es decir: −Z es a donde atacamos y +Z es nuestra portería, que es justo
   detrás de donde arranca la cámara. */
(function(){
'use strict';

/* Proporción 10:14, la de .pitch en styles.css. No son los 68×105 m
   reglamentarios a posta: con las medidas reales las fichas caerían en un punto
   distinto al de la 2D, y que las dos vistas coincidan importa más que el
   reglamento en un campo que es un esquema. */
const ANCHO=68, LARGO=ANCHO*1.4;
/* Las figuras van exageradas ~2,8 veces (5 unidades sobre un campo de 68 de
   ancho, cuando una persona real serían 1,8). A escala real serían motas
   invisibles desde la cámara: en una pizarra táctica manda que se distingan
   desde arriba, no el tamaño reglamentario. */
const ALTO_FIGURA=5;
/* Portería: el ancho es el mismo que la marca pintada en la línea de fondo
   (18% del ancho, como en el CSS de la 2D) para que los palos caigan justo
   encima de ella. Alto y fondo van a juego con las figuras exageradas. */
const PORT_ANCHO=ANCHO*.18, PORT_ALTO=4.8, PORT_FONDO=2.8, PORT_PALO=.22;
const LINEA_FONDO=LARGO*.47;      // el campo pintado está metido un 3% por cada lado

const CDN='https://unpkg.com/three@0.170.0/';

let THREE=null,OrbitControls=null;           // se rellenan al cargar
let escena,camara,motor,controles;
/* Geometrías y materiales del cuerpo: se crean UNA vez y se comparten entre las
   veintidós figuras. Por eso tirarFichas() no los toca al repintar; si los
   liberase, la siguiente pasada dibujaría sobre recursos ya destruidos. */
let piezas=null,materiales=null;
let activo=false,cargando=false,fallo=false,tocado=false;
let fichas=[];                                // objetos 3D en pantalla, para poder tirarlos
let observador=null;

const $=s=>document.querySelector(s);
const caja=()=>$('#pitch3d');
const boton=()=>$('#ver3d');

/* ---------- Lectura del estado: siempre a través de la táctica activa ----------
   tactic() y state son variables de app.js. Los dos archivos son scripts
   clásicos, así que comparten ámbito global y se ven por nombre. Se leen dentro
   de las funciones, nunca al cargar, para no depender del orden de los <script>
   ni quedarnos con una foto vieja al cambiar de pestaña táctica. */
function tacticaActiva(){
  try{ return typeof tactic==='function' ? tactic() : null }catch(_){ return null }
}
function plantilla(equipo){
  try{ return equipo==='rival' ? state.rivals : state.players }catch(_){ return [] }
}
function coloresRival(){
  try{ return state.rivalColors||{} }catch(_){ return {} }
}

/* ---------- Carga diferida ---------- */
function admiteImportmap(){
  return typeof HTMLScriptElement!=='undefined'
      && typeof HTMLScriptElement.supports==='function'
      && HTMLScriptElement.supports('importmap');
}
async function cargarThree(){
  // El importmap de index.html resuelve 'three' y 'three/addons/'. OrbitControls
  // importa 'three' por su cuenta, así que sin importmap no hay vuelta: no se
  // puede cargar por URL completa y que sus importes internos funcionen.
  const t=await import('three');
  const o=await import('three/addons/controls/OrbitControls.js');
  return {t,o:o.OrbitControls};
}

/* ---------- El campo: una textura, no cientos de líneas ----------
   Las líneas de un campo dibujadas con THREE.Line salen de 1 píxel en casi
   todas las GPU (linewidth no se respeta) y en el móvil no se ven. Pintarlas en
   un canvas y usarlo de textura da un trazo grueso a cualquier zoom, una sola
   llamada de dibujo y, sobre todo, los MISMOS porcentajes que el CSS de la 2D. */
function texturaCampo(){
  const W=1024,H=Math.round(W*1.4),c=document.createElement('canvas');
  c.width=W;c.height=H;
  const x=c.getContext('2d');
  const px=p=>p/100*W, py=p=>p/100*H;

  x.fillStyle='#24784e';x.fillRect(0,0,W,H);
  // Franjas de corte: ocho bandas, como el césped de un campo de verdad.
  x.fillStyle='#277e52';
  for(let i=0;i<8;i+=2)x.fillRect(0,H/8*i,W,H/8);

  x.strokeStyle='rgba(255,255,255,.82)';
  x.lineWidth=Math.max(2,W*.005);
  const rect=(x1,y1,x2,y2)=>x.strokeRect(px(x1),py(y1),px(x2-x1),py(y2-y1));

  rect(3,3,97,97);                                     // banda exterior (.field-outline: inset 3%)
  x.beginPath();x.moveTo(px(3),py(50));x.lineTo(px(97),py(50));x.stroke();   // medio campo
  x.beginPath();x.arc(px(50),py(50),px(11),0,Math.PI*2);x.stroke();          // círculo central (.center-circle: 22% de ancho)
  x.fillStyle='rgba(255,255,255,.82)';
  x.beginPath();x.arc(px(50),py(50),px(.7),0,Math.PI*2);x.fill();            // punto central

  // Áreas. En el CSS el área grande va de 26% a 74% y mide 16% de alto desde la
  // línea de fondo; la chica es el 46% de su ancho y el 43% de su alto, y el
  // punto de penalti está al 62% del área grande.
  [0,1].forEach(abajo=>{
    const y1=abajo?84:3, y2=abajo?97:19;
    rect(26,y1,74,y2);
    const chY1=abajo?97-6.88:3, chY2=abajo?97:3+6.88;
    rect(38.96,chY1,61.04,chY2);
    const pen=abajo?97-16*.62:3+16*.62;
    x.beginPath();x.arc(px(50),py(pen),px(.7),0,Math.PI*2);x.fill();
    rect(41,abajo?97:1,59,abajo?99:3);                 // portería (.goal: 41%→59%)
  });

  const t=new THREE.CanvasTexture(c);
  t.anisotropy=Math.min(8,motor.capabilities.getMaxAnisotropy());
  if('colorSpace' in t && THREE.SRGBColorSpace)t.colorSpace=THREE.SRGBColorSpace;
  return t;
}

/* ---------- Dorsal ----------
   En una chapa vertical que siempre mira a la cámara. Sobre la cara superior
   del cilindro solo se leería desde arriba, y la gracia del 3D es justamente
   poder bajar la cámara a ras de campo. */
function texturaDorsal(dorsal,fondo,tinta){
  const S=128,c=document.createElement('canvas');
  c.width=c.height=S;
  const x=c.getContext('2d'),r=26;
  x.fillStyle=fondo;
  x.beginPath();
  if(x.roundRect)x.roundRect(6,6,S-12,S-12,r);
  else x.rect(6,6,S-12,S-12);
  x.fill();
  x.lineWidth=7;x.strokeStyle=tinta;x.stroke();
  x.fillStyle=tinta;
  x.font='800 76px Manrope, Arial, sans-serif';
  x.textAlign='center';x.textBaseline='middle';
  x.fillText(String(dorsal||'–'),S/2,S/2+4);
  const t=new THREE.CanvasTexture(c);
  if('colorSpace' in t && THREE.SRGBColorSpace)t.colorSpace=THREE.SRGBColorSpace;
  return t;
}

/* ---------- Red de la portería ----------
   Una rejilla pintada en un canvas con el fondo transparente, repetida sobre
   cuatro planos (fondo, dos costados y techo). Con líneas de verdad
   (LineSegments) haría falta un centenar de segmentos por portería y en el
   móvil se verían de un píxel; así son dos triángulos por paño. */
function texturaRed(){
  const S=64,c=document.createElement('canvas');
  c.width=c.height=S;
  const x=c.getContext('2d');
  x.clearRect(0,0,S,S);
  // Hilo fino y celda grande: con la malla muy tupida, de lejos el mipmap la
  // promedia y la portería se convierte en una caja gris maciza.
  x.strokeStyle='rgba(255,255,255,.9)';
  x.lineWidth=2;
  x.beginPath();
  for(let i=0;i<=4;i++){
    const p=i*S/4;
    x.moveTo(p,0);x.lineTo(p,S);
    x.moveTo(0,p);x.lineTo(S,p);
  }
  x.stroke();
  const t=new THREE.CanvasTexture(c);
  t.wrapS=t.wrapT=THREE.RepeatWrapping;
  return t;
}
function crearPorteria(mirandoAdentro){
  // mirandoAdentro = +1 si la portería está en +Z (la nuestra) y la red crece
  // hacia fuera del campo; -1 para la del fondo.
  const g=new THREE.Group();
  const blanco=new THREE.MeshLambertMaterial({color:0xffffff});
  const A=PORT_ANCHO/2,H=PORT_ALTO,F=PORT_FONDO;

  const geoPalo=new THREE.CylinderGeometry(PORT_PALO,PORT_PALO,H,10);
  [-A,A].forEach(x=>{
    const p=new THREE.Mesh(geoPalo,blanco);
    p.position.set(x,H/2,0);
    g.add(p);
  });
  const larguero=new THREE.Mesh(new THREE.CylinderGeometry(PORT_PALO,PORT_PALO,PORT_ANCHO+PORT_PALO*2,10),blanco);
  larguero.rotation.z=Math.PI/2;
  larguero.position.y=H;
  g.add(larguero);

  const red=(rx,ry)=>{
    const t=texturaRed();
    t.repeat.set(rx,ry);
    return new THREE.MeshLambertMaterial({map:t,transparent:true,opacity:.85,
                                          side:THREE.DoubleSide,depthWrite:false})
  };
  const paño=(geo,mat,pos,rot)=>{
    const m=new THREE.Mesh(geo,mat);
    m.position.set(pos[0],pos[1],pos[2]);
    if(rot)m.rotation.set(rot[0],rot[1],rot[2]);
    g.add(m);
    return m
  };
  const z=mirandoAdentro*F;                     // plano del fondo de la red
  // Repeticiones calculadas para que la celda mida ~1,2 unidades en los cuatro
  // paños y la malla no cambie de tamaño de un lado a otro de la portería.
  const c=1.2, rep=(w,h)=>[Math.max(1,Math.round(w/c/4)),Math.max(1,Math.round(h/c/4))];
  paño(new THREE.PlaneGeometry(PORT_ANCHO,H),red(...rep(PORT_ANCHO,H)),[0,H/2,z]);           // fondo
  paño(new THREE.PlaneGeometry(F,H),red(...rep(F,H)),[-A,H/2,z/2],[0,Math.PI/2,0]);          // costado izquierdo
  paño(new THREE.PlaneGeometry(F,H),red(...rep(F,H)),[A,H/2,z/2],[0,Math.PI/2,0]);           // costado derecho
  paño(new THREE.PlaneGeometry(PORT_ANCHO,F),red(...rep(PORT_ANCHO,F)),[0,H,z/2],[Math.PI/2,0,0]); // techo
  return g
}

/* ---------- Las figuras ----------
   Un muñequito de primitivas: piernas, tronco troncocónico (hombros más anchos
   que la cintura), brazos y cabeza. Nada de modelos descargados: son cinco
   mallas por jugador con geometría compartida, así que el móvil lo mueve sin
   despeinarse y no hay un solo byte más que bajar. */
function crearPiezas(){
  piezas={
    pierna:new THREE.CylinderGeometry(.32,.26,2,10),
    tronco:new THREE.CylinderGeometry(.86,.62,2,14),
    brazo:new THREE.CylinderGeometry(.24,.2,1.7,8),
    cabeza:new THREE.SphereGeometry(.55,14,10)
  };
}
function materialesEquipo(camiseta,pantalon){
  return {
    camiseta:new THREE.MeshLambertMaterial({color:camiseta}),
    pantalon:new THREE.MeshLambertMaterial({color:pantalon}),
    // Cabeza en un tono neutro de figurita de madera, igual para todos: no hay
    // dato de nadie que justifique elegirle a cada jugador un tono de piel.
    cabeza:new THREE.MeshLambertMaterial({color:0xd9cbb8})
  };
}
function crearFigura(m){
  const g=new THREE.Group();
  [-.42,.42].forEach(x=>{
    const p=new THREE.Mesh(piezas.pierna,m.pantalon);
    p.position.set(x,1,0);
    g.add(p);
  });
  const tronco=new THREE.Mesh(piezas.tronco,m.camiseta);
  tronco.position.y=3;
  g.add(tronco);
  [-1,1].forEach(s=>{
    const b=new THREE.Mesh(piezas.brazo,m.camiseta);
    b.position.set(s*.95,3.05,0);
    b.rotation.z=s*.22;                 // separados del cuerpo, no en firmes
    g.add(b);
  });
  const cab=new THREE.Mesh(piezas.cabeza,m.cabeza);
  cab.position.y=4.45;
  g.add(cab);
  return g
}

/* ---------- Montaje ---------- */
function construir(){
  const cont=caja();
  escena=new THREE.Scene();
  escena.background=new THREE.Color('#e9e6ed');       // el mismo gris de .pitch-wrap

  camara=new THREE.PerspectiveCamera(50,1,.5,600);

  motor=new THREE.WebGLRenderer({antialias:true,alpha:false});
  motor.setPixelRatio(Math.min(devicePixelRatio||1,2));   // sin tope, un móvil a 3x va a tirones
  cont.appendChild(motor.domElement);

  escena.add(new THREE.AmbientLight(0xffffff,.9));
  const sol=new THREE.DirectionalLight(0xffffff,.55);
  sol.position.set(30,80,40);
  escena.add(sol);

  const suelo=new THREE.Mesh(
    new THREE.PlaneGeometry(ANCHO,LARGO),
    new THREE.MeshBasicMaterial({map:texturaCampo()})
  );
  suelo.rotation.x=-Math.PI/2;
  escena.add(suelo);

  crearPiezas();

  // Una portería en cada línea de fondo, con la red creciendo hacia fuera.
  const pNuestra=crearPorteria(1);
  pNuestra.position.z=LINEA_FONDO;
  escena.add(pNuestra);
  const pRival=crearPorteria(-1);
  pRival.position.z=-LINEA_FONDO;
  escena.add(pRival);

  controles=new OrbitControls(camara,motor.domElement);
  controles.enableDamping=true;
  controles.dampingFactor=.08;
  controles.target.set(0,0,0);
  controles.minDistance=26;
  controles.maxDistance=240;
  controles.minPolarAngle=.12;         // casi cenital
  controles.maxPolarAngle=1.45;        // sin llegar a meterse bajo el césped
  // A partir del primer gesto manda el usuario: no se le vuelve a recolocar la
  // cámara por debajo, ni siquiera al girar el móvil.
  controles.addEventListener('start',()=>{tocado=true});

  ajustarTamano();
  encuadrar();
  observador=new ResizeObserver(ajustarTamano);
  observador.observe(cont);
}

function ajustarTamano(){
  if(!motor)return;
  const c=caja(),w=c.clientWidth,h=c.clientHeight;
  if(!w||!h)return;
  motor.setSize(w,h,false);
  camara.aspect=w/h;
  camara.updateProjectionMatrix();
  if(!tocado)encuadrar();      // al girar el móvil cambia el ancho útil y el encuadre se rehace
}

/* Encuadre calculado, no a ojo. En una caja 10:14 el campo de visión horizontal
   se queda en ~37°, así que cualquier distancia elegida a mano deja fuera a los
   laterales o el campo diminuto en mitad de dos franjas grises. Se parte de
   cerca y se aleja la cámara hasta que las cuatro esquinas del campo caen
   dentro, con un margen. Así vale para el móvil, el PC y el apaisado sin tocar
   ningún número. */
/* 42°: medido, no elegido a ojo. Por debajo de 35° el campo se escora y deja
   media caja en gris (a 26° ocupa el 24%); por encima de 50° se vuelve casi
   cenital y el 3D ya no aporta nada sobre la 2D. Aquí ocupa ~47% y se siguen
   viendo los cilindros en perspectiva. */
const ELEVACION=42*Math.PI/180;
function encuadrar(){
  if(!camara)return;
  const objetivo=controles?controles.target:new THREE.Vector3();
  const dir=new THREE.Vector3(0,Math.sin(ELEVACION),Math.cos(ELEVACION));   // detrás de nuestra portería (+Z)
  const esquinas=[[-1,-1],[1,-1],[-1,1],[1,1]].map(([sx,sz])=>
    new THREE.Vector3(sx*ANCHO/2,0,sz*LARGO/2));
  let d=50;
  for(let i=0;i<40;i++){
    camara.position.copy(dir).multiplyScalar(d).add(objetivo);
    camara.lookAt(objetivo);
    camara.updateMatrixWorld();
    const fuera=esquinas.some(c=>{
      const p=c.clone().project(camara);
      return Math.abs(p.x)>.96||Math.abs(p.y)>.96
    });
    if(!fuera)break;
    d*=1.06;
  }
  if(controles)controles.update()
}

/* ---------- Los jugadores en el campo ---------- */
function tirarFichas(){
  fichas.forEach(g=>{
    escena.remove(g);
    // Solo se libera lo que es de ESTE jugador: la chapa del dorsal, que lleva
    // su propia textura. El cuerpo usa geometrías y materiales compartidos por
    // los veintidós, y destruirlos dejaría la siguiente pasada sin nada que
    // dibujar.
    g.traverse(n=>{
      if(n.isSprite&&n.material){
        if(n.material.map)n.material.map.dispose();
        n.material.dispose();
      }
    });
  });
  fichas=[];
}
const aX=p=>(p/100-.5)*ANCHO;
const aZ=p=>(p/100-.5)*LARGO;

function pintarFichas(){
  if(!escena)return;
  tirarFichas();
  const t=tacticaActiva();
  if(!t)return;
  const rc=coloresRival();
  if(!materiales)materiales={};
  // Se recrean solo si el usuario ha cambiado los colores del rival.
  const claveRival=(rc.primary||'#20232b')+'|'+(rc.secondary||'#ffbd35');
  if(!materiales.own)materiales.own=materialesEquipo('#31098c','#ffffff');
  if(materiales.claveRival!==claveRival){
    materiales.rival=materialesEquipo(rc.primary||'#20232b',rc.secondary||'#ffbd35');
    materiales.claveRival=claveRival;
  }
  const equipos=[
    {lista:t.placed||[],         roster:plantilla('own'),   mat:materiales.own,
     fondo:'#31098c', tinta:'#ffffff', mirando:Math.PI},                     // atacamos hacia −Z
    {lista:t.opponentPlaced||[], roster:plantilla('rival'), mat:materiales.rival,
     fondo:rc.primary||'#20232b', tinta:rc.secondary||'#ffbd35', mirando:0}
  ];
  equipos.forEach(eq=>{
    eq.lista.forEach(pp=>{
      const j=eq.roster.find(p=>p.id===pp.playerId);
      if(!j)return;                        // jugador borrado de la plantilla: la 2D tampoco lo pinta
      const g=crearFigura(eq.mat);
      g.position.set(aX(pp.x),0,aZ(pp.y));
      g.rotation.y=eq.mirando;             // cada equipo mira hacia la portería que ataca

      const chapa=new THREE.Sprite(new THREE.SpriteMaterial({
        map:texturaDorsal(j.number,eq.fondo,eq.tinta),
        depthTest:false                    // el dorsal se lee aunque el jugador quede tapado
      }));
      // Anclada por abajo y justo encima de la cabeza: al cambiar de tamaño
      // crece hacia arriba en vez de bajar y tragarse al jugador.
      chapa.center.set(.5,0);
      chapa.position.y=ALTO_FIGURA+.35;
      chapa.renderOrder=2;
      g.add(chapa);
      g.userData.chapa=chapa;

      escena.add(g);
      fichas.push(g);
    });
  });
}

/* ---------- Bucle ----------
   El dorsal es un rótulo, no un objeto del campo: se le recalcula el tamaño en
   cada cuadro para que ocupe SIEMPRE la misma fracción de la pantalla. Con un
   tamaño fijo en el mundo, de lejos no se leía y de cerca tapaba al jugador
   entero. Son veintidós cuentas por cuadro: ni se nota. */
const ALTO_CHAPA=.05;                  // 5% del alto del lienzo: legible sin comerse al muñeco
const _pos=()=>new THREE.Vector3();
let _aux=null;
function ajustarChapas(){
  if(!_aux)_aux=_pos();
  const k=2*Math.tan(camara.fov*Math.PI/360)*ALTO_CHAPA;
  fichas.forEach(g=>{
    const ch=g.userData.chapa;
    if(!ch)return;
    ch.getWorldPosition(_aux);
    const s=Math.max(1.5,Math.min(11,k*_aux.distanceTo(camara.position)));
    ch.scale.set(s,s,1);
  });
}
function bucle(){
  controles.update();
  ajustarChapas();
  motor.render(escena,camara);
}
function arrancar(){ motor.setAnimationLoop(bucle) }
function parar(){ if(motor)motor.setAnimationLoop(null) }

/* ---------- Mensajes dentro de la caja ---------- */
function aviso(texto,detalle){
  caja().innerHTML=`<p class="p3d-aviso"><b>${texto}</b>${detalle?`<small>${detalle}</small>`:''}</p>`;
}

/* ---------- Encendido y apagado ---------- */
function pintarBoton(){
  const b=boton();
  if(!b)return;
  b.classList.toggle('active',activo);
  b.setAttribute('aria-pressed',String(activo));
  const n=b.querySelector('.t-name');
  if(n)n.textContent=activo?'Ver en 2D':'Ver en 3D';
}
function mostrar(){
  activo=true;
  $('.pitch-wrap').classList.add('en-3d');
  caja().hidden=false;
  pintarBoton();
  if(motor){ ajustarTamano(); pintarFichas(); arrancar() }
}
function ocultar(){
  activo=false;
  parar();
  $('.pitch-wrap').classList.remove('en-3d');
  caja().hidden=true;
  pintarBoton();
}

async function alternar(){
  if(activo){ ocultar(); return }
  if(fallo){ aviso('La vista 3D no está disponible','Vuelve a intentarlo cuando tengas conexión.');mostrar();return }
  if(motor){ mostrar(); return }
  if(cargando)return;

  if(!admiteImportmap()){
    fallo=true;
    mostrar();
    aviso('Tu navegador no admite la vista 3D','Necesita Chrome 89 o Safari 16.4 en adelante. La pizarra en 2D funciona igual.');
    return
  }
  cargando=true;
  mostrar();
  aviso('Cargando la vista 3D…','Solo la primera vez.');
  try{
    const {t,o}=await cargarThree();
    THREE=t;OrbitControls=o;
    caja().innerHTML='';
    construir();
    pintarFichas();
    arrancar();
  }catch(e){
    console.warn('No se pudo cargar three.js:',e);
    fallo=true;
    aviso('No se ha podido cargar la vista 3D','Hace falta conexión la primera vez. La pizarra en 2D funciona igual.');
  }finally{
    cargando=false
  }
}

/* ---------- Enganche con app.js ----------
   Único punto de entrada desde fuera: renderPitch() lo llama después de
   repintar la 2D. Si la vista está apagada no cuesta nada. */
window.Vista3D={
  refrescar(){
    if(!activo||!escena)return;
    // Fuera de la pizarra (informe, plantilla…) el lienzo no se ve: se para el
    // bucle para no gastar batería dibujando a 60 fps contra un div oculto.
    const enPizarra=$('#boardView')&&$('#boardView').classList.contains('active');
    if(!enPizarra){ parar(); return }
    pintarFichas();
    arrancar()
  },
  activa(){ return activo }
};

document.addEventListener('visibilitychange',()=>{
  if(!activo||!motor)return;
  document.hidden?parar():arrancar()
});

const b=boton();
if(b)b.onclick=alternar;

})();
