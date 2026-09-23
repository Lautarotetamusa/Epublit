---
name: specify
description: Primer paso del flujo SDD del proyecto. Usar cuando el usuario pide arrancar un feature o módulo nuevo con /specify, o dice "especifiquemos X" / "armemos el spec de X".
---

# /specify

Arranca el flujo SDD (ver `specs/README.md`) para un feature o módulo nuevo.

## Pasos

1. A partir de `args`, definí un slug corto en kebab-case y el próximo
   número correlativo mirando las carpetas que ya existen en `specs/`
   (`NNN-slug`, ej. `003-migrar-cliente`). Si `specs/<slug>/` ya existe para
   ese feature, reusá esa carpeta en vez de crear una nueva.
2. Lanzá el agente `sdd-spec-writer` (tool `Agent`, `subagent_type:
   "sdd-spec-writer"`) con un prompt que incluya: la descripción del feature
   tal cual la dio el usuario, el path de destino
   (`specs/<NNN-slug>/spec.md`), y que lea `specs/_template/spec.md` como
   base.
3. Cuando el agente termine, decile al usuario dónde quedó el spec y
   pedile que lo revise antes de correr `/plan`. No sigas vos solo con el
   plan.

## Notas

- No escribas el spec vos mismo en el hilo principal: siempre a través del
  agente, para mantener el contexto de esa fase separado del resto de la
  conversación.
- Si el usuario da muy poca información para arrancar, pasale igual lo que
  haya al agente — el spec-writer deja las ambigüedades en "Preguntas
  abiertas" en vez de bloquear.
