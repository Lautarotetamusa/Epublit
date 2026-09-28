#!/usr/bin/env bash
# PreToolUse hook: restringe al subagente "planner". Lectura (Read/Grep/
# Glob) sólo en back/docs/, back/db/migrations/ y specs/ (el design.md que
# dejó front-designer + los planes ya escritos); escritura (Write) sólo
# dentro de specs/ (su propio plan.md, nunca código). Es una restricción
# real (bloquea el tool call), no una instrucción de prompt que el modelo
# pueda olvidar o ignorar.
set -euo pipefail

input="$(cat)"
agent_type="$(echo "$input" | jq -r '.agent_type // ""')"

# Sólo aplica al planner; el resto de los agentes (incluida la sesión
# principal) sigue sin restricciones de este hook.
if [[ "$agent_type" != "planner" ]]; then
    exit 0
fi

cwd="$(echo "$input" | jq -r '.cwd // ""')"
tool_name="$(echo "$input" | jq -r '.tool_name // ""')"
path="$(echo "$input" | jq -r '.tool_input.file_path // .tool_input.path // ""')"

deny() {
    echo "{\"hookSpecificOutput\": {\"hookEventName\": \"PreToolUse\", \"permissionDecision\": \"deny\", \"permissionDecisionReason\": \"$1\"}}"
    exit 0
}

# Sin path explícito (ej. Grep/Glob buscando desde cwd, todo el repo): no
# hay forma de saber qué va a leer/escribir, así que se deniega directamente.
if [[ -z "$path" ]]; then
    deny "El planner tiene que especificar un path explícito dentro de las carpetas permitidas."
fi

# Normaliza a ruta relativa al proyecto para comparar contra el allowlist.
rel_path="${path#"$cwd"/}"

if [[ "$tool_name" == "Write" ]]; then
    if [[ "$rel_path" == specs/* ]]; then
        exit 0
    fi
    deny "El planner sólo puede escribir dentro de specs/ (su propio plan.md), no '$rel_path'."
fi

if [[ "$rel_path" == back/docs/* || "$rel_path" == back/db/migrations/* || "$rel_path" == specs/* || "$rel_path" == specs ]]; then
    exit 0
fi

deny "El planner sólo puede leer back/docs/, back/db/migrations/ y specs/, no '$rel_path'."
