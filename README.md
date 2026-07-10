# Támara · Pizarra técnica

Aplicación web local para gestionar la plantilla y preparar variantes tácticas de la UD Tamaraceite.

Incluye plantilla propia y rival, jugadores arrastrables, formaciones, flechas rectas y curvas, círculos, resaltado de jugadores, dibujo libre y anotaciones de texto.

## Uso

Aplicación publicada en: https://sergiolopfer84.github.io/pizarra-tactica-tamara/

Al entrar se pide una **clave de acceso**. Cada clave tiene su propia pizarra guardada en la nube (Firebase Firestore): usando la misma clave en PC, tablet o móvil se ven y sincronizan los mismos datos en tiempo real. Si la clave es nueva, se crea una pizarra vacía.

Para exportar, pulsa **Exportar PDF** y elige **Guardar como PDF** en el diálogo de impresión.

## Sincronización

- Los datos se guardan en Firestore (proyecto `pizarra-tamara-2026`) en un documento por clave (`pizarras/{hash de la clave}`).
- También se guarda una copia local en el navegador, que permite seguir trabajando sin conexión.
- Las fotos se reducen automáticamente antes de guardarse para no superar el límite de tamaño.
- Las reglas de seguridad están en `firestore.rules`; se despliegan con `firebase deploy --only firestore:rules`.
