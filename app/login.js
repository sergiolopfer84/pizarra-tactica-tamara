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
  localStorage.removeItem('udt-owner');
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
/* merge:true para no barrer nada más del documento del usuario si algún día
   guarda algo aparte de la lista. */
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
    const raw=d.data();
    const s=JSON.parse(raw.data);
    return {
      club:s.club||'',crest:s.crest||'',jugadores:(s.players||[]).length,
      // Sin `owner` la pizarra es heredada: aún no la ha reclamado nadie.
      duenio:raw.owner||null,
      miembros:Array.isArray(raw.miembros)?raw.miembros:[],
      ref:d.ref
    };
  }catch(e){ return null }
}

const ESCUDO_GENERICO='../escudos/escudo-generico.svg';

const MAX_AYUDANTES=10;

/* ===== Cuerpo técnico de una pizarra =====
   Sustituye a "pásale tu clave al ayudante", que deja de funcionar en cuanto la
   pizarra tiene dueño. Los invitados se guardan por CORREO en el propio
   documento de la pizarra, así que se puede invitar a alguien que todavía no
   tenga cuenta: entrará en cuanto la cree con ese correo y lo confirme. */
function panelAyudantes(p,info,nombre){
  const caja=document.createElement('div');
  caja.className='ayudantes';

  const abrirCerrar=document.createElement('button');
  abrirCerrar.type='button';abrirCerrar.className='enlace';
  const rotulo=()=>'Cuerpo técnico ('+lista.length+')';
  let lista=info.miembros.slice();
  abrirCerrar.textContent=rotulo();

  const panel=document.createElement('div');
  panel.className='panel-ayudantes';panel.hidden=true;
  abrirCerrar.onclick=()=>{panel.hidden=!panel.hidden};

  const ul=document.createElement('ul');ul.className='ayudantes-lista';
  const aviso=document.createElement('p');aviso.className='error';

  async function guardar(nueva){
    // merge:true: se toca SOLO la lista de invitados y no se roza el campo
    // `data`, que es la pizarra entera.
    await info.ref.set({miembros:nueva},{merge:true});
    lista=nueva;
    abrirCerrar.textContent=rotulo();
    pintar();
  }

  function pintar(){
    ul.innerHTML='';
    if(!lista.length){
      const vacio=document.createElement('li');
      vacio.className='vacio';
      vacio.textContent='Todavía no has invitado a nadie. Solo tú entras en esta pizarra.';
      ul.append(vacio);
      return;
    }
    lista.forEach(correo=>{
      const li=document.createElement('li');
      const txt=document.createElement('span');txt.textContent=correo;
      const quitar=document.createElement('button');
      quitar.type='button';quitar.className='quitar';
      quitar.textContent='×';
      quitar.title='Quitar del cuerpo técnico';
      quitar.setAttribute('aria-label','Quitar a '+correo+' de '+nombre);
      quitar.onclick=async()=>{
        if(!confirm('¿Quitar a '+correo+' de "'+nombre+'"?\n\nDejará de ver y de editar esta pizarra al momento.'))return;
        aviso.textContent='';
        try{ await guardar(lista.filter(c=>c!==correo)) }
        catch(e){ aviso.textContent=mensajeError(e) }
      };
      li.append(txt,quitar);
      ul.append(li);
    });
  }
  pintar();

  const form=document.createElement('form');
  form.className='invitar';
  const campo=document.createElement('input');
  campo.type='email';campo.placeholder='correo@delayudante.es';
  campo.autocapitalize='none';campo.spellcheck=false;campo.required=true;
  campo.setAttribute('aria-label','Correo del ayudante');
  const enviar=document.createElement('button');
  enviar.type='submit';enviar.className='btn';enviar.textContent='Invitar';

  form.onsubmit=async e=>{
    e.preventDefault();aviso.textContent='';
    // En minúsculas porque las reglas comparan contra el correo del token en
    // minúsculas: "Ana@x.es" y "ana@x.es" son la misma persona para Firebase.
    const correo=campo.value.trim().toLowerCase();
    if(!correo||!correo.includes('@')){aviso.textContent='Escribe un correo válido.';return}
    if(correo===(usuario.email||'').toLowerCase()){aviso.textContent='Esa pizarra ya es tuya.';return}
    if(lista.includes(correo)){aviso.textContent='Ya está en el cuerpo técnico.';return}
    if(lista.length>=MAX_AYUDANTES){aviso.textContent='Máximo '+MAX_AYUDANTES+' personas por pizarra.';return}
    ocupado(enviar,'Invitando…');
    try{ await guardar(lista.concat([correo]));campo.value='' }
    catch(err){ aviso.textContent=mensajeError(err) }
    finally{ libre(enviar) }
  };
  form.append(campo,enviar);

  const nota=document.createElement('p');
  nota.className='nota';
  nota.textContent='Entrarán con su propia cuenta, no con tu clave. Si aún no tienen cuenta, podrán crearla con ese mismo correo y les aparecerá esta pizarra.';

  panel.append(ul,form,aviso,nota);
  caja.append(abrirCerrar,panel);
  return caja;
}

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

    /* La clave, a la vista.
       Al crear una pizarra desde aquí se genera una clave al azar y se entra
       directamente, así que el usuario nunca llegaba a verla: solo aparecía
       dentro del aviso de QUITAR la pizarra, o sea que había que intentar
       borrarla para enterarse de cuál era la suya. La pizarra no se perdía
       —está guardada en la cuenta— pero sin la clave no se puede abrir en un
       dispositivo sin sesión ni pasársela a nadie. */
    const fila=document.createElement('div');
    fila.className='fila';
    fila.append(btn,quitar);

    const pieClave=document.createElement('div');
    pieClave.className='clave-fila';
    const cod=document.createElement('code');
    cod.textContent=p.clave;
    const copiar=document.createElement('button');
    copiar.type='button';copiar.className='copiar';
    copiar.textContent='Copiar';
    copiar.setAttribute('aria-label','Copiar la clave de '+nombre);
    copiar.onclick=async()=>{
      try{
        await navigator.clipboard.writeText(p.clave);
        copiar.textContent='Copiada';
      }catch(e){
        // Sin permiso de portapapeles (o sin HTTPS): al menos se deja
        // seleccionada para copiarla a mano.
        copiar.textContent='Selecciónala';
        const r=document.createRange();r.selectNodeContents(cod);
        const s=getSelection();s.removeAllRanges();s.addRange(r);
      }
      setTimeout(()=>{copiar.textContent='Copiar'},2000);
    };
    pieClave.append(document.createTextNode('Clave: '),cod,copiar);

    li.append(fila,pieClave);
    // El cuerpo técnico solo lo gestiona el dueño. En una pizarra heredada
    // (todavía sin reclamar) no se ofrece: no hay a quién dar permiso porque
    // ahí sigue entrando cualquiera con la clave.
    if(info&&info.duenio&&info.duenio===usuario.uid)li.append(panelAyudantes(p,info,nombre));
    ul.append(li);
  }

  // Dos motivos distintos para no poder añadir, y conviene decir cuál es: si se
  // deshabilitan los botones sin explicar por qué, parece que la app está rota.
  const sinConfirmar=!verificado();
  $('#avisoVerificar').hidden=!sinConfirmar;
  $('#avisoEmail').textContent=usuario.email||'';
  if(sinConfirmar){$('#formVincular').hidden=true;$('#formNueva').hidden=true}

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
  /* La marca que autoriza a la app a reclamar esta pizarra si aún no tiene
     dueño. Solo se pone al abrir desde ESTA lista: así se distingue "es mía"
     de "he tecleado una clave que me han pasado", y el ayudante que abra la
     clave compartida no se queda con la pizarra del entrenador. */
  localStorage.setItem('udt-owner',usuario.uid);
  location.href='/';
}

async function desvincular(clave,nombre){
  if(!confirm('¿Quitar "'+nombre+'" de tu cuenta?\n\nLa pizarra NO se borra: sigue existiendo y se puede volver a añadir con su clave de acceso.\n\nClave: '+clave))return;
  pizarras=pizarras.filter(p=>p.clave!==clave);
  try{ await guardarPizarras();await pintarPizarras() }
  catch(e){ $('#errPizarras').textContent=mensajeError(e);await cargarPizarras();await pintarPizarras() }
}

/* ===== Crear una pizarra =====
   La clave la elige el usuario. No es solo comodidad: la clave es lo que se
   dicta por teléfono para que entre el segundo entrenador, y una cadena al azar
   como `dtc-k7m3npq2rs` no hay quien la dicte. La aleatoria sigue disponible
   para quien no quiera pensarla. */

/* Minúsculas SIEMPRE, y se le enseña ya convertida. La clave se convierte en el
   ID del documento tal cual se escriba, así que "MiClub-2026" y "miclub-2026"
   son dos pizarras distintas y vacías la una para la otra; como el teclado del
   móvil pone mayúscula en la primera letra por su cuenta, quien la eligiese con
   mayúsculas se quedaría fuera de su propia pizarra al teclearla luego.
   Fuera también espacios y acentos: son los que se pierden al dictar. */
const normalizarClave=s=>s.trim().toLowerCase();
const CLAVE_OK=/^[a-z0-9-]+$/;

/* "¿Está libre esta clave?" no es lo mismo que "¿existe el documento?".
   `allow get: if autorizado(resource)`: una pizarra YA RECLAMADA por otro no se
   puede ni leer, así que el get() no devuelve "no existe", revienta con
   permission-denied. Con claves al azar esto no pasaba nunca; en cuanto la
   eligen las personas, "atletico-2026" choca el primer día. Para lo que aquí se
   pregunta, no poder mirarla es tan definitivo como encontrarla ocupada. El
   resto de errores (sin red, por ejemplo) sí tienen que subir: decir "libre"
   porque se ha caído la conexión metería al usuario en la pizarra de otro. */
async function claveLibre(clave){
  try{
    const d=await db.collection('pizarras').doc(await hashDeClave(clave)).get();
    return !d.exists;
  }catch(e){
    if(e&&e.code==='permission-denied')return false;
    throw e;
  }
}

$('#btnNueva').onclick=()=>{
  limpiarAvisos();
  if(pizarras.length>=MAX_PIZARRAS)return;
  $('#formVincular').hidden=true;
  $('#formNueva').hidden=false;
  $('#nvaClave').value='';
  $('#nvaClave').focus();
};
$('#btnNuevaNo').onclick=()=>{limpiarAvisos();$('#formNueva').hidden=true};
$('#btnClaveAzar').onclick=()=>{$('#nvaClave').value=claveNueva();$('#nvaClave').focus()};

$('#formNueva').onsubmit=async e=>{
  e.preventDefault();limpiarAvisos();
  const clave=normalizarClave($('#nvaClave').value);
  const err=$('#errNueva');
  if(clave.length<6){err.textContent='La clave debe tener al menos 6 caracteres.';return}
  if(clave.length>60){err.textContent='La clave no puede pasar de 60 caracteres.';return}
  if(!CLAVE_OK.test(clave)){err.textContent='Solo letras sin acentos, números y guiones. Sin espacios ni eñes: son los que se pierden al dictarla.';return}
  if(pizarras.some(p=>normalizarClave(p.clave)===clave)){err.textContent='Ya tienes una pizarra con esa clave.';return}
  if(pizarras.length>=MAX_PIZARRAS){err.textContent='Ya tienes '+MAX_PIZARRAS+' pizarras.';return}

  const b=$('#btnNuevaOk');ocupado(b,'Creando…');
  try{
    if(!await claveLibre(clave)){
      err.textContent='Esa clave ya está en uso. Prueba con otra: añadirle el año o la categoría suele bastar.';
      return;
    }
    pizarras=pizarras.concat([{clave,nombre:'Pizarra nueva',creada:Date.now()}]);
    await guardarPizarras();
    abrir(clave);
  }catch(ex){
    err.textContent=mensajeError(ex);
    await cargarPizarras();await pintarPizarras();
  }finally{ libre(b) }
};

/* ===== Vincular una pizarra que ya existe ===== */
$('#btnVincular').onclick=()=>{
  limpiarAvisos();
  $('#formNueva').hidden=true;
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
