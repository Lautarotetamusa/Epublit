---
version: 1
slug: "admin"
primary_target: "front/src/features/admin"
related_targets:
  - "front/src/layout/AdminLayout.tsx"
---

# Administración del SaaS (área `/admin`)

Scope: `front/src/features/admin/`, `front/src/layout/AdminLayout.tsx`, ruta
`/admin` en `App.tsx`. Mode: Operate. Audiencia: operador de Epublit (no el
dueño de una editorial). Trabajo: leer si la campaña de captación está
funcionando sobre las cuentas del panel, en qué escalón se frena la
activación, cuántas tienen ARCA conectado y qué cuentas necesitan atención.
Datos de muestra rotulados; no hay endpoints todavía.

## Direction contract

THESIS: El panel del operador es un libro de cuentas de la campaña: un solo
recorrido de veredicto → fuga de activación → registro de cuentas, con la tabla
como destino real y sin la barra lateral del producto editorial.
OWN-WORLD: Papel cálido y tinta del sistema Epublit; Spectral para cifras y
títulos, Manrope para interfaz, JetBrains Mono para cantidades; franja de
navegación verde pino con un único ítem, tarjetas blancas con hairlines y el
violeta reservado a la conversión de la tienda y a la primera venta.
STORY: En diez segundos el operador entiende cuántas cuentas hay,
cuántas operaron en 30 días, cuántas vendieron alguna vez, cuántas tienen ARCA
conectado, dónde se pierde la mayoría y cómo se compone la base por etapa de
adquisición; después identifica cuentas por nombre, estado o ARCA y exporta el
recorte.
FIRST VIEWPORT: Franja oscura con marca y "Usuarios"; título y definición de
activo; una tarjeta de seis cifras con el pulso de la campaña; debajo, el
embudo a la izquierda y la evolución de seis meses a la derecha.
FORM: "tres actos" (veredicto → embudo/evolución → registro), candidato 5 de la
tirada ordenada; seed 51f86833.
FINISH: unreviewed and undocumented is unfinished; this build ends with the
finish review, the verdict, DESIGN.md, and every shipping raster carrying its
provenance
