# Támara · Pizarra técnica

Aplicación web local para gestionar la plantilla y preparar variantes tácticas de la UD Tamaraceite.

Incluye plantilla propia y rival, jugadores arrastrables, formaciones, flechas rectas y curvas, círculos, resaltado de jugadores, dibujo libre y anotaciones de texto.

## Uso

Aplicación publicada en: https://sergiolopfer84.github.io/pizarra-tactica-tamara/

Al entrar se pide una **clave de acceso**. Cada clave tiene su propia pizarra guardada en la nube (Firebase Firestore): usando la misma clave en PC, tablet o móvil se ven y sincronizan los mismos datos en tiempo real. Si la clave es nueva, se crea una pizarra vacía.

Para exportar, pulsa **Exportar PDF** y elige **Guardar como PDF** en el diálogo de impresión.

## Escudo y nombre del club

En **Datos del club** (botón de la barra lateral, o pulsando el escudo) se cambia el nombre y se sube el escudo. El escudo se guarda dentro de los datos de la pizarra, así que **cada clave tiene el suyo** y se sincroniza con el resto de dispositivos. Se reduce a 220 px y se guarda en PNG para conservar el fondo transparente.

Aparece en la barra lateral, en la tarjeta del partido y en el PDF exportado.

Para una **versión personalizada** (vender la app a otro club con su imagen), basta con sustituir el archivo de `escudos/` y cambiar la constante `DEFAULT_CREST` en `app.js`: ese será el escudo que vean quienes no hayan subido ninguno, incluida la pantalla de acceso.

## Convocatoria por WhatsApp

El botón **Convocatoria** compone el mensaje del partido (fecha, hora, rival, campo, lista de convocados, hora de citación y un aviso libre) y lo abre en WhatsApp para elegir el grupo del equipo.

La aplicación **no envía nada por su cuenta**: no usa la API de Meta, no tiene coste por mensaje y los datos de los jugadores no salen del móvil del entrenador. Por defecto propone a todos los jugadores disponibles; la selección se puede ajustar y queda guardada con el partido.

## Estadísticas por zonas del campo

Con el partido en directo, cada acción se registra con la **zona del campo** en la que ocurre: una rejilla de 3×3 (defensa / medio / ataque × izquierda / centro / derecha).

La rejilla es **siempre relativa al equipo propio**: `def_*` junto a la portería propia y `ata_*` junto a la rival, con la izquierda y la derecha vistas desde el equipo propio atacando. El cambio de campo del descanso no afecta al dato: el entrenador ve siempre el mismo campo.

| Zona | DFI | DFC | DFD | MCI | MCC | MCD | DLI | DLC | DLD |
|---|---|---|---|---|---|---|---|---|---|
| Id interno | `def_izq` | `def_cen` | `def_der` | `med_izq` | `med_cen` | `med_der` | `ata_izq` | `ata_cen` | `ata_der` |

Los ids internos no se cambian nunca; las etiquetas de tres letras están en la constante `ZONA_ETI` de `app.js` por si otro cuerpo técnico prefiere otras.

### Registrar: tres toques

- **Acciones de jugador**: pulsación larga sobre el jugador → menú con dos pestañas (Ofensivo / Defensivo) → el mismo popup se transforma en el selector de zona → un toque en el cuadrante. Los cuatro eventos originales (regate exitoso y fallido, recuperación y pérdida) encabezan cada pestaña.
- **Acciones de equipo** (llegada al área, llegada del rival, 2x1 con centro al área): botón ⚑ flotante, siempre visible durante el partido, sin pasar por ningún jugador. Cada una lleva su contador; una pulsación larga sobre el contador resta uno.
- **"Sin zona"** guarda el evento igual, con `zona: null`. El informe los cuenta aparte. Nunca se pierde un evento por no saber la zona.
- Tras registrar aparece **Deshacer** durante unos segundos. Desde el informe y desde la ficha del jugador se puede **cambiar la zona o borrar** cualquier evento ya guardado.

`Tiro a puerta` registra **solo ocasión clara de gol**, no cualquier disparo; el propio menú lo recuerda para que entrenador y asistente registren con el mismo criterio.

Las **pérdidas en inicio de juego, en zona media y en campo rival** no tienen botón: se calculan en el informe a partir de la zona de cada pérdida.

### Informe

Sección propia en el menú lateral. Muestra el campo en SVG con el mapa de calor por zonas (número absoluto y porcentaje en cada cuadrante), un selector de métrica agrupado en Ataque / Defensa / Combinadas —incluido el **balance defensivo** (recuperaciones − pérdidas) y el **% de acierto en regate**—, filtros por jugador, parte y tramo de minutos, la tabla de equipo con los ratios de dominio y eficacia, la tabla individual y el resumen redactado.

Al tocar un cuadrante se listan sus eventos, con opción de corregirlos. **Campo PNG** y **Resumen PNG** generan una imagen para compartir en el grupo del cuerpo técnico (en el móvil se abre el menú de compartir; en el PC se descarga).

### Dos dispositivos a la vez

Los eventos se guardan en una **subcolección** de Firestore (`pizarras/{clave}/eventos`), un documento por evento. Así el documento de la pizarra no se acerca al límite de 1 MB y dos dispositivos con la misma clave pueden registrar a la vez sin pisarse: cada uno escribe sus documentos y todo se mezcla por marca de tiempo. En cada evento se guarda el `origen` (rol del dispositivo) para poder depurar duplicados.

El ajuste de **rol** (Individual / Equipo) es de cada dispositivo, no de la pizarra: solo cambia con qué panel se trabaja y qué origen se anota.

Todo funciona **en modo avión**: se escribe primero en el navegador y Firestore sube los eventos pendientes al recuperar cobertura.

### Partidos anteriores

Los partidos guardados antes de esta versión se abren con normalidad. Sus eventos no tenían zona ni ámbito: se leen como "sin zona" y como acciones de jugador, y los tipos antiguos (`loss`, `recovery`, `dribble_ok`, `dribble_ko`, `shot`) se traducen a los nuevos. No se migra ni se borra nada.

## Copias de seguridad

- Desde la app: **Descargar copia** y **Restaurar copia** en la barra lateral (archivo `.json`).
- Desde el PC: `powershell -ExecutionPolicy Bypass -File copia-pizarras.ps1` descarga todas las pizarras a `backups\`, omite las que no han cambiado y conserva las 10 últimas versiones de cada una.
- La carpeta `backups/` está excluida del repositorio: contiene nombres, notas y fotos reales de jugadores.

## Sincronización

- Los datos se guardan en Firestore (proyecto `pizarra-tamara-2026`) en un documento por clave (`pizarras/{hash de la clave}`).
- También se guarda una copia local en el navegador, que permite seguir trabajando sin conexión.
- Las fotos se reducen automáticamente antes de guardarse para no superar el límite de tamaño.
- Los eventos del partido van en la subcolección `pizarras/{hash}/eventos`, un documento por evento.
- Las reglas de seguridad están en `firestore.rules`; se despliegan con `firebase deploy --only firestore:rules`. **Esta versión añade reglas para la subcolección de eventos: hay que volver a desplegarlas o los eventos no se sincronizarán entre dispositivos.**
