# Design: Centro de ayuda público de Epublit

Estado: aprobado por el usuario

## Historia
Como editorial que usa Epublit quiero un centro de ayuda público (tipo blog)
para seguir trámites paso a paso sin pedir ayuda, empezando por "Cómo generar
tu certificado de ARCA para facturar". El link va en el mail de bienvenida.

## Qué se construyó
- Rutas públicas, sin login y también navegables con sesión, fuera de
  `AppLayout`: `/ayuda` (índice) y `/ayuda/:slug` (artículo). En
  `front/src/App.tsx` se montan las mismas rutas (`rutasAyuda`) en el árbol
  con sesión y en el árbol sin sesión.
- `front/src/features/ayuda/AyudaLayout.tsx`: cabecera verde pino-900 con el
  lockup de Epublit + "Centro de ayuda"; a la derecha "Ingresar" (sin sesión)
  o "Volver a Epublit" (con sesión).
- `AyudaIndexPage.tsx`: título, bajada y artículos agrupados por tema, en una
  lista (título, resumen, cantidad de pasos, fecha de actualización).
- `ArticuloPage.tsx`: índice lateral fijo ("En esta guía", con el rango de
  pasos de cada parte y el avance), encabezado, "Antes de empezar"
  (requisitos), partes con pasos numerados de corrido, capturas que se abren
  en tamaño completo y un cierre con acción ("Ir a mi perfil"). El número de
  cada paso se puede marcar como hecho; el avance queda en el navegador
  (localStorage). Si el slug no existe, muestra un estado vacío con link al
  índice.
- Los artículos son datos versionados en el front:
  `front/src/features/ayuda/articulos/index.ts` (registro `ARTICULOS`) +
  un archivo por artículo (`certificadoArca.tsx`). Sumar un artículo es
  crear su archivo, agregarlo al registro y dejar sus capturas en
  `front/public/ayuda/<slug>/`; el índice y el layout del artículo salen
  solos. Formato inline compartido en `TextoArticulo.tsx` (`Etiqueta` para
  texto de pantalla, `Ruta` para menús encadenados, `Archivo`, `Nota`).
- Primer artículo `certificado-arca`: 3 partes y 14 pasos, 13 capturas de
  ARCA en `front/public/ayuda/certificado-arca/`. Texto actualizado: el
  `cert.csr` se descarga desde Perfil › Facturación electrónica › "Descargar
  CSR" (y llega adjunto en el mail de bienvenida); el `cert.pem` lo sube la
  propia editorial con "Subir certificado" en esa misma tarjeta.
- Barra lateral del panel: nueva sección "Soporte" › "Centro de ayuda"
  (`front/src/layout/AppLayout.tsx`).
- Sistema de diseño: icono `circle-help` (Lucide) en
  `design-system/assets/icons/` y `className` agregado al contrato de
  `Icon.d.ts` (el `.jsx` ya lo reenviaba).

## Datos necesarios
Ninguno. El contenido del centro de ayuda vive versionado en el código del
front y no necesita datos de la API.

Dependencia de otra historia en curso (no es un dato nuevo): el paso 11 del
artículo nombra el botón "Subir certificado" de la tarjeta "Facturación
electrónica" del perfil, que se está implementando en paralelo. Si ese botón
termina con otro nombre, hay que actualizar el texto del artículo.

Agent: afd271a21371c3160
