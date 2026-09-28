# Reglas de estilo (front)

Estas reglas son la traducción a React de las de `/CLAUDE.md` (raíz): misma
filosofía (DI > herencia, DRY, comentarios que expliquen el *por qué*, una
responsabilidad por unidad, evitar try/catch innecesario), aplicada acá a
componentes y hooks en vez de a servicios de backend.

## Sistema de diseño primero
Nunca se crea un primitivo de UI (botón, input, card, badge, tabla, modal,
etc.) desde cero si ya existe uno en `src/design-system/`. Es código fuente
del proyecto (no una skill externa ni algo vendored/copiado): se importa
siempre desde el barrel `src/design-system` (`import { Button } from
"../design-system"`), nunca apuntando directo a un archivo dentro de
`design-system/components/**` (regla reforzada por
`design-system/adherence.oxlintrc.json`). Si un componente existente no
alcanza, se extiende por props/composición ahí mismo; no se reimplementa en
paralelo. Antes de escribir un componente nuevo, revisar
`src/design-system/readme.md` y el `.prompt.md` del componente candidato —
y si de verdad hace falta un componente nuevo, agregarlo a
`src/design-system/` (siguiendo sus mismos tokens) y sumarlo al barrel, no
crearlo suelto en otro lado.

## Composición e inyección de dependencias > herencia / prop-drilling
Sin clases ni HOCs: sólo componentes función y hooks. Lógica compartida se
extrae a un hook (`useAlgo`), no a una clase base ni a un wrapper que
reenvíe props sin agregar nada. Un hook recibe sus dependencias explícitas
por parámetro (ej. el cliente de API, un id) en vez de importar un singleton
- mismo criterio que los `create*Service`/`create*Repository` del backend.
Context sólo para estado realmente transversal (sesión, tema): si el
prop-drilling no pasa de 2-3 niveles, no hace falta Context.

## DRY
Si una llamada a la API, un formateo (moneda es-AR, fechas `dd/mm/yyyy`) o
una validación se repite en más de un lugar, se extrae a un hook o helper
compartido (`src/api/`, `src/lib/`) en vez de copiarla.

## Comentarios y documentación
Igual que el backend: sólo explican el *por qué*. Lo que hace un componente
o un hook tiene que quedar claro con su nombre y el de sus props/parámetros.

## Un componente/hook, una responsabilidad
Si un componente mezcla fetch de datos + lógica de negocio + presentación,
se separa: un hook (`useLibros`, `useVenta`) para el estado/lógica, un
componente de presentación puro para el render. No crear wrappers que sólo
reenvíen props sin agregar comportamiento.

## Evitar try/catch innecesario
Los errores de fetch se manejan en el lugar que realmente puede reaccionar a
ellos (un boundary, un estado de error mostrable), no con try/catch
disperso "por las dudas" en cada llamada.

## Tipado
Proyecto en TypeScript. Los componentes del sistema de diseño vienen como
`.jsx` + `.d.ts` (contrato de props ya tipado): se consumen con ese tipado,
nunca se les agrega `any` para forzar el import. Evitar `any` en general,
salvo en el borde con una librería sin tipos.
