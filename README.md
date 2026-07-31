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

## Copias de seguridad

- Desde la app: **Descargar copia** y **Restaurar copia** en la barra lateral (archivo `.json`).
- Desde el PC: `powershell -ExecutionPolicy Bypass -File copia-pizarras.ps1` descarga todas las pizarras a `backups\`, omite las que no han cambiado y conserva las 10 últimas versiones de cada una.
- La carpeta `backups/` está excluida del repositorio: contiene nombres, notas y fotos reales de jugadores.

## Sincronización

- Los datos se guardan en Firestore (proyecto `pizarra-tamara-2026`) en un documento por clave (`pizarras/{hash de la clave}`).
- También se guarda una copia local en el navegador, que permite seguir trabajando sin conexión.
- Las fotos se reducen automáticamente antes de guardarse para no superar el límite de tamaño.
- Las reglas de seguridad están en `firestore.rules`; se despliegan con `firebase deploy --only firestore:rules`.
