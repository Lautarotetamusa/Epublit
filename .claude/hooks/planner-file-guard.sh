#!/usr/bin/env bash
# PreToolUse hook: restringe al subagente "planner" a leer sólo docs/ y
# db/migrations/ (ni el resto de src/, ni nada más). Es una restricción real
# (bloquea el tool call), no una instrucción de prompt que el modelo pueda
# olvidar o ignorar.
set -euo pipefail

input="$(cat)"
agent_type="$(echo "$input" | jq -r '.agent_type // ""')"

# Sólo aplica al planner; el resto de los agentes (incluida la sesión
# principal) sigue sin restricciones de este hook.
if [[ "$agent_type" != "planner" ]]; then
    exit 0
fi

cwd="$(echo "$input" | jq -r '.cwd // ""')"
path="$(echo "$input" | jq -r '.tool_input.file_path // .tool_input.path // ""')"

deny() {
    echo "{\"hookSpecificOutput\": {\"hookEventName\": \"PreToolUse\", \"permissionDecision\": \"deny\", \"permissionDecisionReason\": \"$1\"}}"
    exit 0
}

# Sin path explícito (ej. Grep/Glob buscando desde cwd, todo el repo): no
# hay forma de saber qué va a leer, así que se deniega directamente.
if [[ -z "$path" ]]; then
    deny "El planner sólo puede leer docs/ y db/migrations/. Especificá un path dentro de esas carpetas."
fi

# Normaliza a ruta relativa al proyecto para comparar contra el allowlist.
rel_path="${path#"$cwd"/}"

if [[ "$rel_path" == docs/* || "$rel_path" == db/migrations/* ]]; then
    exit 0
fi

deny "El planner sólo puede leer docs/ y db/migrations/, no '$rel_path'."
