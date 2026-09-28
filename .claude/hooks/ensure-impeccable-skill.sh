#!/usr/bin/env bash
# PreToolUse hook: antes de dejar arrancar al subagente "front-designer"
# (que depende del set de skills de impeccable.style, ver
# .claude/agents/front-designer.md), garantiza que la skill "impeccable"
# esté instalada a nivel de PROYECTO (`.claude/skills/impeccable/`), no
# sólo a nivel de usuario (`~/.claude/skills/impeccable/`) — la skill
# resuelve sus propios scripts con paths relativos al proyecto
# (`.claude/skills/impeccable/scripts/impeccable`), así que si sólo está
# instalada en `~/.claude`, esos comandos fallan apenas el agente intenta
# usarlos.
#
# Si falta, se copia una sola vez desde la instalación de usuario (fuente
# canónica en esta máquina). Nunca la fabrica desde cero: si tampoco existe
# ahí, bloquea con un mensaje accionable.
set -euo pipefail

input="$(cat)"
subagent_type="$(echo "$input" | jq -r '.tool_input.subagent_type // ""')"

# Sólo aplica cuando se está por spawnear front-designer; cualquier otro
# Agent call sigue sin restricciones de este hook.
if [[ "$subagent_type" != "front-designer" ]]; then
    exit 0
fi

cwd="$(echo "$input" | jq -r '.cwd // ""')"
project_skill="$cwd/.claude/skills/impeccable"
user_skill="$HOME/.claude/skills/impeccable"

deny() {
    echo "{\"hookSpecificOutput\": {\"hookEventName\": \"PreToolUse\", \"permissionDecision\": \"deny\", \"permissionDecisionReason\": \"$1\"}}"
    exit 0
}

if [[ -f "$project_skill/SKILL.md" ]]; then
    exit 0
fi

if [[ -f "$user_skill/SKILL.md" ]]; then
    mkdir -p "$cwd/.claude/skills"
    cp -r "$user_skill" "$project_skill"
    exit 0
fi

deny "front-designer necesita la skill 'impeccable' (impeccable.style) instalada en .claude/skills/impeccable/ y no se encontró ni en el proyecto ni en ~/.claude/skills/impeccable. Instalala antes de correr este agente."
