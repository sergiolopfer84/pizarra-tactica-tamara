/* ===========================================================================
   Dirige Tu Club · Cuenta de usuario
   ---------------------------------------------------------------------------
   Cómo encaja con la app, que es lo que importa entender antes de tocar nada:

   La app (app.js) NO sabe de cuentas. Sigue abriendo la pizarra cuyo id es el
   hash de una "clave de acceso", y al arrancar mira si hay una clave guardada
   en localStorage('udt-key') para reconectarse sola.

   Esta pantalla se apoya exactamente en eso: una cuenta no es más que una LISTA
   de claves guardada en usuarios/{uid}. Al elegir una pizarra se deja su clave
   en localStorage y se redirige a la app, que se conecta como lo ha hecho
   siempre. Por eso el registro se puede añadir sin tocar connectBoard() y por
   eso quien ya venía usando su clave a pelo sigue entrando igual: las dos
   puertas llevan al mismo sitio.

   La consecuencia es que la clave sigue siendo lo que da acceso a una pizarra,
   también para quien entre por cuenta. La cuenta organiza y limita (3 por
   usuario); no es todavía el muro de seguridad. Cerrar ese muro es el paso
   siguiente y toca firestore.rules.
   ======================================================================== */

/* Misma configuración que app.js. Es pública (va en el HTML de cualquier web
   con Firebase), pero si cambia allí hay que cambiarla aquí. */
const FIREBASE_CONFIG={apiKey:'AIzaSyBrysK7UDFDW_XpY1tSFnrQSX9rD8mbrrQ',authDomain:'pizarra-tamara-2026.firebaseapp.com',projectId:'pizarra-tamara-2026',storageBucket:'pizarra-tamara-2026.firebasestorage.app',messagingSenderId:'886197824457',appId:'1:886197824457:web:4beab9509451daac1c9618'};

const MAX_PIZARRAS=3;

firebase.initializeApp(FIREBASE_CONFIG);
const auth=firebase.auth();
const db=firebase.firestore();
// La sesión sobrevive al cierre del navegador: un entrenador no va a teclear la
// contraseña cada domingo en el móvil.
auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL).catch(()=>{});

const $=s=>document.querySelector(s);
const $$=s=>[...document.querySelectorAll(s)];

/* COPIA LITERAL de sha256hex() en app.js, incluida la sal 'udt·pizarra·' y el
   respaldo sin crypto.subtle. Tiene que dar exactamente el mismo hash para la
   misma clave: si las dos versiones se separan, esta pantalla mandaría a la app
   a un documento distinto del suyo y la pizarra aparecería vacía. */
async function sha256hex(text){
  if(crypto&&crypto.subtle){
    const buf=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text));
    return [...new Uint8Array(buf)].map(b=>b.toString(16).padStart(2,'0')).join('')
  }
  let out='';for(let s=0;s<4;s++){let h=0x811c9dc5^s;for(let i=0;i<text.length;i++){h^=text.charCodeAt(i);h=Math.imul(h,0x01000193)}out+=(h>>>0).toString(16).padStart(8,'0')}
  return out
}
const hashDeClave=clave=>sha256hex('udt·pizarra·'+clave);

/* Alfabeto sin i, l, o, 0 ni 1: la clave se dicta por teléfono o se copia a
   mano en la tablet del segundo entrenador, y esos cinco caracteres son los que
   se confunden. */
const ALFABETO='abcdefghjkmnpqrstuvwxyz23456789';
function claveNueva(){
  const n=new Uint32Array(10);
  crypto.getRandomValues(n);
  return 'dtc-'+[...n].map(v=>ALFABETO[v%ALFABETO.length]).join('')
}

/* ===== Navegación entre pantallas ===== */
const PANTALLAS=['pCargando','pAcceder','pRegistro','pRecuperar','pPizarras'];
function mostrar(id){
  PANTALLAS.forEach(p=>{const el=$('#'+p);if(el)el.hidden=(p!==id)});
  // El primer campo de la pantalla, enfocado, salvo en móvil: allí abrir el
  // teclado de golpe tapa media pantalla antes de que se lea el encabezado.
  if(!matchMedia('(max-width:560px)').matches){
    const primero=$('#'+id+' input');
    if(primero)primero.focus();
  }
}
$$('[data-ir]').forEach(b=>b.onclick=()=>{limpiarAvisos();mostrar(b.dataset.ir)});
function limpiarAvisos(){$$('.error,.ok').forEach(e=>e.textContent='')}

/* Firebase devuelve códigos; aquí se traducen a algo accionable. Los tres
   últimos son de configuración del proyecto, no del usuario: si aparecen, lo
   que falta es una casilla en la consola de Firebase o desplegar las reglas. */
function mensajeError(e){
  const c=(e&&e.code)||'';
  switch(c){
    case 'auth/invalid-email':          return 'Ese correo no tiene un formato válido.';
    case 'auth/missing-password':       return 'Escribe tu contraseña.';
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':     return 'Correo o contraseña incorrectos.';
    case 'auth/email-already-in-use':   return 'Ya existe una cuenta con ese correo. Prueba a entrar.';
    case 'auth/weak-password':          return 'La contraseña debe tener al menos 6 caracteres.';
    case 'auth/too-many-requests':      return 'Demasiados intentos seguidos. Espera unos minutos.';
    case 'auth/network-request-failed': return 'Sin conexión. Comprueba la red e inténtalo otra vez.';
    case 'auth/operation-not-allowed':  return 'El acceso con correo y contraseña no está activado en este proyecto de Firebase.';
    case 'auth/unauthorized-domain':    return 'Este dominio no está autorizado en Firebase Authentication.';
    case 'permission-denied':           return 'Las reglas de Firestore no permiten esta operación todavía.';
    default: return (e&&e.message)||'Algo ha fallado. Inténtalo de nuevo.';
  }
}

function ocupado(btn,texto){
  btn.disabled=true;
  btn.dataset.textoPrevio=btn.textContent;
  btn.textContent=texto;
}
function libre(btn){
  btn.disabled=false;
  if(btn.dataset.textoPrevio)btn.textContent=btn.dataset.textoPrevio;
}

/* ===== Alta, acceso y recuperación ===== */
$('#formAcceder').onsubmit=async e=>{
  e.preventDefault();limpiarAvisos();
  const b=$('#btnAcceder');ocupado(b,'Entrando…');
  try{ await auth.signInWithEmailAndPassword($('#accEmail').value.trim(),$('#accPass').value) }
  catch(err){ $('#errAcceder').textContent=mensajeError(err) }
  finally{ libre(b) }
};

$('#formRegistro').onsubmit=async e=>{
  e.preventDefault();limpiarAvisos();
  const b=$('#btnRegistro');ocupado(b,'Creando…');
  try{
    const cred=await auth.createUserWithEmailAndPassword($('#regEmail').value.trim(),$('#regPass').value);
    // Firebase NO manda nada por su cuenta al crear la cuenta: hay que pedirlo.
    // Si falla el envío la cuenta ya existe igual, así que no se propaga el
    // error: el usuario acaba en la lista con el aviso y el botón de reenviar.
    try{ await cred.user.sendEmailVerification() }catch(err){ console.warn('No se pudo enviar la verificación:',err) }
  }
  catch(err){ $('#errRegistro').textContent=mensajeError(err) }
  finally{ libre(b) }
};

$('#formRecuperar').onsubmit=async e=>{
  e.preventDefault();limpiarAvisos();
  const b=$('#btnRecuperar');ocupado(b,'Enviando…');
  try{
    await auth.sendPasswordResetEmail($('#recEmail').value.trim());
    // Se confirma el envío sin decir si el correo existe o no: eso permitiría
    // averiguar quién tiene cuenta probando direcciones.
    $('#okRecuperar').textContent='Si hay una cuenta con ese correo, te llegará un enlace en un minuto.';
  }catch(err){ $('#errRecuperar').textContent=mensajeError(err) }
  finally{ libre(b) }
};

/* Cerrar sesión tiene que llevarse TAMBIÉN la pizarra abierta.
   Hay dos sesiones distintas y es fácil olvidarlo: la cuenta, que vive en
   Firebase Auth, y la pizarra, que vive en localStorage('udt-key') porque la
   app se reconecta sola con ella (boot(), en app.js). Cerrando solo la primera,
   la app seguía entrando directa a la última pizarra: en un ordenador
   compartido, el siguiente que abriese la web se metía en ella sin teclear
   nada.
   Se borra ANTES de signOut() a propósito: si signOut() falla por lo que sea,
   prefiero haber cerrado la pizarra de más que de menos. */
$('#btnSalir').onclick=async()=>{
  localStorage.removeItem('udt-key');
  try{ await auth.signOut() }
  catch(e){ console.warn('No se pudo cerrar la sesión:',e) }
};

/* ===== Correo confirmado =====
   El muro de verdad está en firestore.rules; esto es lo que lo explica y da
   salida. Sin esta pantalla el usuario solo vería un "permission-denied". */
const verificado=()=>!!(auth.currentUser&&auth.currentUser.emailVerified);

/* Refresca de dónde saca el navegador el "email_verified".
   Hacen falta las DOS llamadas y por este orden:
   - reload() actualiza la ficha del usuario (la propiedad emailVerified).
   - getIdToken(true) fuerza un token nuevo, que es lo que leen las reglas de
     Firestore. Sin esto el token viejo sigue diciendo false hasta una hora, y
     guardar seguiría fallando después de haber pulsado el enlace. */
async function refrescarVerificacion(){
  if(!auth.currentUser)return false;
  try{
    await auth.currentUser.reload();
    await auth.currentUser.getIdToken(true);
  }catch(e){ console.warn('No se pudo refrescar la sesión:',e) }
  return verificado();
}

$('#btnYaVerificado').onclick=async()=>{
  limpiarAvisos();
  const b=$('#btnYaVerificado');ocupado(b,'Comprobando…');
  try{
    if(await refrescarVerificacion()){
      $('#okVerificar').textContent='Listo, correo confirmado.';
      await pintarPizarras();
    }else{
      $('#errVerificar').textContent='Todavía nos consta sin confirmar. Pulsa el enlace del correo y vuelve a intentarlo.';
    }
  }finally{ libre(b) }
};

$('#btnReenviar').onclick=async()=>{
  limpiarAvisos();
  const b=$('#btnReenviar');ocupado(b,'Enviando…');
  try{
    await auth.currentUser.sendEmailVerification();
    $('#okVerificar').textContent='Enviado. Puede tardar un minuto en llegar.';
  }catch(e){
    $('#errVerificar').textContent=mensajeError(e);
  }finally{ libre(b) }
};

/* ===== Pizarras de la cuenta =====
   usuarios/{uid} = { pizarras: [ {clave, nombre, creada} ] }, tope de 3. El
   tope se comprueba aquí Y en firestore.rules: lo de aquí es comodidad, lo de
   las reglas es lo que de verdad lo impide. */
let usuario=null,pizarras=[];

const refUsuario=()=>db.collection('usuarios').doc(usuario.uid);

async function cargarPizarras(){
  const d=await refUsuario().get();
  pizarras=(d.exists&&Array.isArray(d.data().pizarras))?d.data().pizarras:[];
}
async function guardarPizarras(){
  await refUsuario().set({pizarras},{merge:true});
}

/* Nombre y escudo salen de la propia pizarra, no de lo que se guardó el día que
   se añadió: si el entrenador le cambia el nombre al club, esta lista tiene que
   enterarse. Si la pizarra no se puede leer se cae al nombre guardado. */
async function datosDePizarra(clave){
  try{
    const h=await hashDeClave(clave);
    const d=await db.collection('pizarras').doc(h).get();
    if(!d.exists)return null;
    const s=JSON.parse(d.data().data);
    return {club:s.club||'',crest:s.crest||'',jugadores:(s.players||[]).length};
  }catch(e){ return null }
}

const ESCUDO_GENERICO='../escudos/escudo-generico.svg';

async function pintarPizarras(){
  const ul=$('#listaPizarras');
  ul.innerHTML='';
  $('#quien').textContent=usuario.email||'';
  $('#subPizarras').textContent=pizarras.length
    ? 'Elige con cuál quieres trabajar.'
    : 'Todavía no tienes ninguna. Crea la primera o añade una que ya uses.';

  for(const p of pizarras){
    const li=document.createElement('li');
    const info=await datosDePizarra(p.clave);
    const nombre=(info&&info.club)||p.nombre||'Pizarra sin nombre';
    const detalle=info
      ? (info.jugadores+' jugador'+(info.jugadores===1?'':'es'))
      : 'No se ha podido leer ahora mismo';

    const btn=document.createElement('button');
    btn.type='button';btn.className='pizarra';
    const img=document.createElement('img');
    img.className='escudo';img.alt='';
    img.src=(info&&info.crest)||ESCUDO_GENERICO;
    const txt=document.createElement('div');
    txt.className='texto';
    const st=document.createElement('strong');st.textContent=nombre;
    const sm=document.createElement('small');sm.textContent=detalle;
    txt.append(st,sm);
    const fl=document.createElement('span');fl.className='flecha';fl.textContent='›';
    btn.append(img,txt,fl);
    btn.onclick=()=>abrir(p.clave);

    const quitar=document.createElement('button');
    quitar.type='button';quitar.className='quitar';
    quitar.title='Quitar de mi cuenta';
    quitar.setAttribute('aria-label','Quitar '+nombre+' de mi cuenta');
    quitar.textContent='×';
    quitar.onclick=()=>desvincular(p.clave,nombre);

    li.append(btn,quitar);
    ul.append(li);
  }

  // Dos motivos distintos para no poder añadir, y conviene decir cuál es: si se
  // deshabilitan los botones sin explicar por qué, parece que la app está rota.
  const sinConfirmar=!verificado();
  $('#avisoVerificar').hidden=!sinConfirmar;
  $('#avisoEmail').textContent=usuario.email||'';
  if(sinConfirmar)$('#formVincular').hidden=true;

  const lleno=pizarras.length>=MAX_PIZARRAS;
  $('#btnNueva').disabled=lleno||sinConfirmar;
  $('#btnVincular').disabled=lleno||sinConfirmar;
  $('#notaLimite').textContent=sinConfirmar
    ? 'Podrás crear pizarras en cuanto confirmes tu correo.'
    : (lleno
      ? 'Has llegado al máximo de '+MAX_PIZARRAS+' pizarras. Quita una para añadir otra.'
      : 'Puedes tener hasta '+MAX_PIZARRAS+' pizarras en esta cuenta ('+pizarras.length+' de '+MAX_PIZARRAS+').');
}

/* Abrir = dejarle la clave a la app y salir de aquí. Es el único punto de unión
   entre las dos pantallas. */
function abrir(clave){
  localStorage.setItem('udt-key',clave);
  location.href='/';
}

async function desvincular(clave,nombre){
  if(!confirm('¿Quitar "'+nombre+'" de tu cuenta?\n\nLa pizarra NO se borra: sigue existiendo y se puede volver a añadir con su clave de acceso.\n\nClave: '+clave))return;
  pizarras=pizarras.filter(p=>p.clave!==clave);
  try{ await guardarPizarras();await pintarPizarras() }
  catch(e){ $('#errPizarras').textContent=mensajeError(e);await cargarPizarras();await pintarPizarras() }
}

$('#btnNueva').onclick=async()=>{
  limpiarAvisos();
  if(pizarras.length>=MAX_PIZARRAS)return;
  const b=$('#btnNueva');ocupado(b,'Creando…');
  try{
    // Una clave al azar podría, en teoría, coincidir con la de otro: entonces
    // esta cuenta entraría en la pizarra de un tercero. Se comprueba y se
    // reintenta antes que arriesgarse.
    let clave=null;
    for(let i=0;i<5;i++){
      const c=claveNueva();
      const d=await db.collection('pizarras').doc(await hashDeClave(c)).get();
      if(!d.exists){clave=c;break}
    }
    if(!clave)throw new Error('No se ha podido generar una clave libre. Inténtalo otra vez.');
    pizarras=pizarras.concat([{clave,nombre:'Pizarra nueva',creada:Date.now()}]);
    await guardarPizarras();
    abrir(clave);
  }catch(e){
    $('#errPizarras').textContent=mensajeError(e);
    await cargarPizarras();await pintarPizarras();
  }finally{ libre(b) }
};

/* ===== Vincular una pizarra que ya existe ===== */
$('#btnVincular').onclick=()=>{
  limpiarAvisos();
  $('#formVincular').hidden=false;
  $('#vinClave').value='';
  $('#vinClave').focus();
};
$('#btnVincularNo').onclick=()=>{limpiarAvisos();$('#formVincular').hidden=true};

$('#formVincular').onsubmit=async e=>{
  e.preventDefault();limpiarAvisos();
  const clave=$('#vinClave').value.trim();
  if(clave.length<6){$('#errVincular').textContent='La clave debe tener al menos 6 caracteres.';return}
  if(pizarras.some(p=>p.clave===clave)){$('#errVincular').textContent='Esa pizarra ya está en tu cuenta.';return}
  if(pizarras.length>=MAX_PIZARRAS){$('#errVincular').textContent='Ya tienes '+MAX_PIZARRAS+' pizarras.';return}

  const b=$('#btnVincularOk');ocupado(b,'Comprobando…');
  try{
    const info=await datosDePizarra(clave);
    // Se exige que exista: así una errata no añade una pizarra vacía que el
    // usuario cree que es la suya.
    if(!info){
      $('#errVincular').textContent='No hay ninguna pizarra con esa clave. Repásala: distingue mayúsculas de minúsculas.';
      return;
    }
    pizarras=pizarras.concat([{clave,nombre:info.club||'Pizarra',creada:Date.now()}]);
    await guardarPizarras();
    $('#formVincular').hidden=true;
    await pintarPizarras();
  }catch(err){
    $('#errVincular').textContent=mensajeError(err);
  }finally{ libre(b) }
};

/* ===== Arranque =====
   Nada se pinta hasta que Firebase dice si hay sesión: si no, se vería un
   instante "Entra en tu cuenta" antes de saltar a la lista de pizarras. */
auth.onAuthStateChanged(async u=>{
  usuario=u;
  limpiarAvisos();
  if(!u){ pizarras=[];mostrar('pAcceder');return }
  mostrar('pCargando');
  // Puede haber confirmado el correo en otra pestaña, o en el móvil mientras
  // esta sesión seguía abierta: se pregunta al servidor en cada arranque en vez
  // de fiarse del token que trae la sesión guardada.
  if(!u.emailVerified)await refrescarVerificacion();
  try{
    await cargarPizarras();
    await pintarPizarras();
    mostrar('pPizarras');
  }catch(e){
    // Con las reglas sin desplegar esto es permission-denied. Se enseña la
    // pantalla igualmente, con el motivo escrito, en vez de dejar "Cargando…".
    await pintarPizarras().catch(()=>{});
    mostrar('pPizarras');
    $('#errPizarras').textContent=mensajeError(e);
  }
});
