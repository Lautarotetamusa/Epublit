#!/usr/bin/env bash
# PreToolUse hook: antes de dejar arrancar a "front-implementer" o
# "front-designer" (ambos dependen de front/src/design-system/, ver
# front/CLAUDE.md y los dos agentes), garantiza que el sistema de diseño
# del proyecto exista. A diferencia de impeccable (ver
# ensure-impeccable-skill.sh), acá no hay una fuente canónica de la que
# copiarlo: es contenido propio del proyecto, así que si falta, se bloquea
# con un mensaje accionable en vez de inventarlo.
set -euo pipefail

input="$(cat)"
subagent_type="$(echo "$input" | jq -r '.tool_input.subagent_type // ""')"

if [[ "$subagent_type" != "front-implementer" && "$subagent_type" != "front-designer" ]]; then
    exit 0
fi

cwd="$(echo "$input" | jq -r '.cwd // ""')"
design_system="$cwd/front/src/design-system"

deny() {
    echo "{\"hookSpecificOutput\": {\"hookEventName\": \"PreToolUse\", \"permissionDecision\": \"deny\", \"permissionDecisionReason\": \"$1\"}}"
    exit 0
}

if [[ ! -f "$design_system/index.ts" || ! -f "$design_system/readme.md" ]]; then
    deny "$subagent_type necesita front/src/design-system/ (con su barrel index.ts y readme.md) y no está, o está incompleto. Generá/restaurá el sistema de diseño del proyecto antes de correr este agente."
fi
