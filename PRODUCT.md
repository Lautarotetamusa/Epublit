# Product

<!-- impeccable:product-schema 1 -->

> Escrito sin ronda de entrevista: el agente que lo redactó (front-designer,
> spec 025) no tenía canal de preguntas con el usuario. Todo lo marcado
> "(inferido)" sale del brief de la historia, del código y de `specs/`, y
> conviene que el usuario lo confirme.

## Platform

web

## Users

Quien administra una editorial chica o mediana en Argentina: la editora o
dueña, el administrativo y quien maneja el depósito. Trabajan con un catálogo
de decenas a cientos de títulos, venden en firme y en consignación a
librerías, liquidan derechos a autores e ilustradores y facturan ante ARCA.
Hoy (inferido) lo resuelven con planillas paralelas.

## Product Purpose

Epublit es un sistema web de gestión editorial: se carga una vez cada título y
ese mismo registro alimenta stock, ventas, consignaciones, comprobantes,
liquidaciones de derechos, métricas y, si la editorial quiere, su tienda
online. Éxito: que la editorial deje las planillas y cierre el mes desde un
solo lugar.

## Positioning

Está hecho alrededor del circuito de una editorial argentina, no de un
comercio genérico: consignación en librerías con depósito propio por cliente,
liquidaciones de derechos con anticipos y reporte por autor, facturación
electrónica ARCA con la letra derivada de la condición frente al IVA, y una
tienda online que lee el mismo catálogo.

## Operating Context

- App en `app.epublit.com.ar` (SPA en `front/`), registro en `/register`.
- Centro de ayuda público en `app.epublit.com.ar/ayuda` (spec 024).
- Landing pública en `epublit.com.ar` (`landing/`, spec 025).
- Desarrollado y operado por Thorque Software.

## Capabilities and Constraints

Verificadas contra `front/src/features/*` y `specs/*`:

- Catálogo: ficha extendida (ISBN, precio, páginas, medidas, peso, edad
  recomendada en rango, tipo de edición normal/pop up/cartoné, brief, book
  trailer, portada), colecciones, visibilidad en el sitio, reseñas (links).
- Personas (autores, ilustradores y roles propios) con foto y biografía.
- Clientes (inscripto, consumidor final, mostrador) con ficha y stock en
  consignación.
- Stock por depósito en un ledger único: ingresos, bajas, transferencias,
  ventas, consignaciones, ventas sobre consignación y devoluciones.
- Medios de pago propios con comisión.
- Comprobantes: facturas electrónicas ARCA (A/B/C/M) y remitos, imprimibles;
  certificado ARCA subido desde el perfil.
- Liquidaciones de derechos con anticipos, pagos parciales y reporte por
  autor imprimible.
- Panel de métricas mensual (ingreso, medio de pago, top por título/cliente/
  depósito, comparación contra el mes anterior).
- Tienda online: pedidos, Mercado Pago, integraciones por API key, CMS de
  páginas institucionales.

No existe (no anunciar): notas de crédito, usuarios múltiples con permisos,
MiCorreo como servicio disponible (en evaluación), límites de títulos por
plan aplicados por el sistema.

## Brand Commitments

- Identidad en `front/src/design-system/` (pino, violeta, papel; Spectral,
  Manrope, JetBrains Mono; Lucide).
- La landing pública (`landing/`) usa Geist y tinta #212529 en lugar de
  Spectral/Manrope, por pedido explícito del usuario (spec 025): más
  amigable y limpia, como la landing anterior. El resto de los tokens es el
  del sistema de diseño.
- Voz: castellano rioplatense con voseo, formal pero llano, vocabulario del
  oficio, sin emoji, sin signos de exclamación, sin lenguaje de startup.

## Evidence on Hand

- Logos: `front/src/design-system/assets/`, y los de la landing anterior
  (`epublit_logo.png`, `epublit_logo_oscuro.png`).
- Precios de planes de la landing anterior (Básico $0, Profesional
  $27.000/mes, Empresarial $49.000/mes).
- No hay testimonios confirmados. No hay clientes, cifras de uso ni prensa
  publicables. No inventarlos.

## Product Principles

1. Un título se carga una vez y sirve en todo el circuito.
2. Hablar el idioma del oficio editorial, no el del software.
3. No prometer lo que el sistema no hace hoy.
4. Los números se ven como en el papel: formato es-AR, cifras alineadas.
