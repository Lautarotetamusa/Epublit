# Design: Landing pública de Epublit en el monorepo

Estado: aprobado por el usuario (2026-11-18)

## Historia
Reemplazar la landing de epublit.com.ar (repo aparte, Next) por una que viva en
este repo y muestre de verdad todo lo que Epublit hace hoy, sin testimonios ni
promesas inventadas.

## Qué se construyó

Sitio estático nuevo en `landing/` (Vite + React 19), prerenderizado a HTML en
el build y que después se hidrata.

- Comandos (en `landing/`): `npm run dev`, `npm run build` (genera `dist/` con
  `index.html` ya renderizado), `npm run preview`.
- Prerender: `npm run build` hace build de cliente, build SSR de
  `src/entry-server.tsx` y `scripts/prerender.mjs` reemplaza `<!--app-html-->`
  en `dist/index.html` con `renderToString`. Sin dependencias extra. Verificado:
  el `index.html` del build trae todas las secciones, precios y enlaces.
- Sistema de diseño: se importan como fuente (alias `@ds` →
  `front/src/design-system`, `@front-lib` → `front/src/lib`) los tokens de a
  uno (sin `fonts.css`) y los componentes (`Button`, `Card`, `Badge`, `Icon`).
  `resolve.dedupe` de React para que los `.jsx` usen el React de la landing.
  El build de la landing necesita el repo completo, no sólo `landing/`.
- Cambio en el sistema de diseño: `Button` acepta `href` y en ese caso
  renderiza un `<a>` con el mismo estilo (`Button.jsx`, `Button.d.ts`,
  `Button.prompt.md`). No rompe nada existente; `front` sigue compilando.

### Segunda pasada (feedback: "la anterior es más amigable y más limpia")
Se descartó el planteo "libro" (serif Spectral, índice con líneas de puntos,
numerales romanos, índice lateral). Estilo nuevo, tomando como referencia la
landing anterior:

- **Tipografía Geist / Geist Mono** (Google Fonts) para todo. Tinta `#212529`,
  marca `#215f5c`, fondos blanco y verde muy claro. Se sobreescriben sólo esas
  variables en `landing/src/landing.css`; colores, espaciado, radios y
  componentes siguen siendo los del sistema. **Divergencia a propósito**: el
  sistema de diseño de la app sigue en Spectral/Manrope; si se aprueba, hay que
  decidir si la app también pasa a Geist o si la landing queda distinta.
- Estructura:
  1. Encabezado blanco: logo, Funcionalidades / Planes / Preguntas / Ayuda,
     Iniciar sesión, Registrarse.
  2. Hero centrado: "Gestioná tu editorial en un solo lugar", bajada,
     "Crear cuenta gratis" y "Ver planes", y abajo una **captura real** del
     catálogo de libros.
  3. "Todo lo que necesita tu editorial": 7 tarjetas (ícono, nombre, una
     línea) que llevan a cada sección.
  4. **Video demo** ("Mirá Epublit funcionando"): `<video controls
     preload="none">` con poster, sin autoplay.
  5. Siete secciones de funcionalidades, alternadas texto + imagen. Capturas
     reales en catálogo (ficha de libro), stock (nuevo movimiento), derechos
     de autor (ficha de liquidación, sólo totales) y métricas (panel de
     inicio). Muestras con datos de ejemplo rotuladas en consignaciones
     (remito), facturación (factura A) y tienda (pedido), porque no había
     captura publicable sin datos personales.
  6. Planes (3, mismos precios y límites), preguntas frecuentes, cierre verde
     con CTA, pie con enlaces (crear cuenta, iniciar sesión, centro de ayuda,
     Thorque).
- Material: capturas en `landing/public/capturas/` (webp, 11 a 35 KB cada
  una, `loading="lazy"` salvo la del hero, `alt` descriptivo), recortadas
  de `demo/` sin moverlas. **No se usaron** las de Personas ni Clientes
  (muestran mails, DNI y CUIT de personas reales) ni el diálogo de
  liquidación de una persona (muestra lo que cobra).
- Video: `landing/public/video/epublit-demo.mp4` (demo final del usuario,
  1:01, 1280×720, 2,8 MB; recomprimido de `demo/n9QqfPa3.mp4` con
  `ffmpeg -crf 27 -movflags +faststart`). Poster: cuadro de los 16,5 s
  (`epublit-demo-poster.webp`), no el cierre, que dice "Conocelo en
  epublit.com.ar" y sobra en el propio sitio.

Archivos principales: `landing/src/App.tsx`, `landing/src/contenido.ts`
(todo el texto de funcionalidades, planes y preguntas), `landing/src/enlaces.ts`,
`landing/src/secciones/*`, `landing/src/muestras/*` (`Captura`, `Marco`,
`Remito`, `Factura`, `Pedido`), `landing/src/landing.css`, `landing/index.html`
(title, description, Open Graph con imagen, canonical, fuentes Geist).
`PRODUCT.md` en la raíz.

Enlaces a la app (`landing/src/enlaces.ts`, base sobreescribible con
`VITE_APP_URL`): iniciar sesión `https://app.epublit.com.ar/`, registrarse
`/register`, centro de ayuda `/ayuda`.

### Inventario verificado de lo que se anuncia
Cada afirmación sale de `front/src/features/*` y `specs/*`: ficha extendida
(003, 022), personas con rol, foto y biografía (004, 005, 011), colecciones
(007), stock por depósito y ledger único (008, 009), depósito de origen en la
venta (018-venta), clientes y acciones en bloque (006), medios de pago con
comisión (010), facturas ARCA A/B/C/M y remitos imprimibles (017, 019),
certificado desde el perfil y guía en el centro de ayuda (024), liquidaciones
con anticipos, pagos y reporte por autor (001, 012, 019, 023), panel de
métricas y filtro de ventas (002, 014), tienda: pedidos, Mercado Pago, API key,
libros ocultos y CMS (016, 018, 020, 022).

Se dejó afuera a propósito: MiCorreo / PAQ.AR (en evaluación), notas de
crédito (no existen en el código), usuarios múltiples con permisos (no
existen), "migramos tu planilla" (no verificado), testimonios.

## Datos necesarios
Ninguno del back. La landing es estática y no consume la API. Las muestras de
remito, factura y pedido usan datos de ejemplo inventados
(`landing/src/muestras/datos.ts`), rotulados "Datos de ejemplo"; el resto son
capturas reales rotuladas "Captura del sistema". No hace falta que la API
provea nada nuevo.

## Pendientes fuera de este paso
- Deploy (no se tocó `infra/` ni `.github/workflows/`): hace falta servir
  `landing/dist/` en epublit.com.ar, y que el build corra con el repo
  completo porque importa `front/src/design-system`. Las fuentes siguen
  cargándose desde Google Fonts, igual que en front.
- No se corrió el finish review ni se escribió `DESIGN.md` de impeccable: este
  agente no tiene subagentes. La autoridad visual sigue siendo
  `front/src/design-system/readme.md`.

## Preguntas abiertas para el usuario
0. **Permiso para publicar las capturas**: muestran el catálogo real de una
   editorial (tapas, títulos, nombres de colecciones, totales de una
   liquidación). ¿Hay permiso de esa editorial? Si no, se reemplazan por
   capturas de la cuenta de prueba (`libreria_sur`) o por muestras.
1. **Carolina Musa / Libros Silvestres**: ¿el testimonio es real y se puede
   publicar? (spec 020 muestra que Libros Silvestres usa Epublit). Por ahora
   no aparece. La cita de la landing vieja comparaba con otro sistema; si
   vuelve, haría falta una cita nueva aprobada por ella.
2. **"Contactar ventas"** (plan Empresarial): no hay mail, WhatsApp ni
   formulario publicado. Hoy lleva al registro, igual que antes. ¿Cuál es el
   canal?
3. **Qué distingue a los planes**: en la app nada se limita por plan (ni
   cantidad de títulos ni facturación). Se dejaron los textos de la landing
   anterior tal cual. ¿"Reportes personalizados" son las métricas, el reporte
   por autor, o algo más? ¿La facturación electrónica es sólo del
   Profesional para arriba? Si es para todos, conviene sacarla de ahí.
4. **Nombre del plan superior**: en la landing vieja se llama "Empresarial";
   se mantuvo.
5. **Tienda online**: la pregunta frecuente dice "Si no tenés sitio,
   escribinos y lo vemos". ¿Thorque ofrece hacer la tienda a medida (como la
   de Libros Silvestres)? Si no, se saca esa frase.
6. **Página de Thorque y enlaces legales**: la landing vieja tenía
   Privacidad / Términos / Cookies sin destino; no se incluyeron. ¿Hay textos
   legales para enlazar?

Agent: a6e25b8709f5951d5
