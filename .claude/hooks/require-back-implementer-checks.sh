#!/usr/bin/env bash
# SubagentStop hook: antes de dejar terminar al back-implementer, corre
# build + tests + chequeos de calidad (ciclos/duplicados) de /back, y el
# linter sólo sobre los archivos que tocó (no todo el repo: back ya tiene
# deuda de lint preexistente en archivos que el back-implementer no tocó,
# y no es su responsabilidad arreglarla). Si algo falla, bloquea el Stop y
# le devuelve la salida al agente para que corrija antes de darse por
# terminado — es un gate real, no una instrucción de prompt.
set -uo pipefail

input="$(cat)"
agent_type="$(echo "$input" | jq -r '.agent_type // .subagent_type // ""')"

if [[ "$agent_type" != "back-implementer" ]]; then
    exit 0
fi

cwd="$(echo "$input" | jq -r '.cwd // ""')"
back_dir="$cwd/back"

failures=""

add_failure() {
    local title="$1" output="$2"
    failures+=$'\n\n## '"$title"$'\n'"$(echo "$output" | tail -n 60)"
}

out="$(cd "$back_dir" && npm run build 2>&1)"
[[ $? -ne 0 ]] && add_failure "npm run build" "$out"

# Lint sólo de los .ts que el back-implementer agregó o modificó (tracked
# modificados + nuevos sin trackear), para no bloquear por deuda ajena.
# `--relative` es necesario: el repo real está un nivel arriba de /back, y
# sin eso git devuelve paths tipo "back/src/..." que no existen relativos
# a $back_dir.
changed_ts="$(
    {
        cd "$back_dir" && git diff --relative --name-only -- src/ 2>/dev/null
        cd "$back_dir" && git ls-files --others --exclude-standard -- src/ 2>/dev/null
    } | grep -E '\.ts$' | sort -u
)"
if [[ -n "$changed_ts" ]]; then
    out="$(cd "$back_dir" && npx eslint $changed_ts 2>&1)"
    [[ $? -ne 0 ]] && add_failure "npm run lint (archivos tocados)" "$out"
fi

out="$(cd "$back_dir" && npm run lint:cycles 2>&1)"
[[ $? -ne 0 ]] && add_failure "npm run lint:cycles" "$out"

out="$(cd "$back_dir" && npm run lint:duplicates 2>&1)"
[[ $? -ne 0 ]] && add_failure "npm run lint:duplicates" "$out"

# `npm test` sale con exit code != 0 en este repo incluso cuando todos los
# tests nombrados pasan, por una colisión de puerto preexistente (varios
# archivos de test importan src/index.ts, que levanta un server real en el
# mismo puerto) que no tiene que ver con lo que haya tocado el
# back-implementer. Por eso se lee el resumen real de vitest ("Tests N
# passed (N)") en vez de confiar ciegamente en el exit code; si esa línea
# no aparece (crash antes de correr ningún test), ahí sí se usa el exit code.
test_out="$(cd "$back_dir" && npm test 2>&1)"
test_exit=$?
test_summary="$(echo "$test_out" | grep -E '^[[:space:]]*Tests[[:space:]]' | tail -1)"
if [[ -n "$test_summary" ]]; then
    echo "$test_summary" | grep -qi "failed" && add_failure "npm test" "$test_out"
elif [[ $test_exit -ne 0 ]]; then
    add_failure "npm test" "$test_out"
fi

if [[ -n "$failures" ]]; then
    jq -n --arg reason "No podés terminar todavía: hay checks en rojo dentro de /back. Corregí esto y volvé a verificar antes de responder de nuevo:$failures" \
        '{"decision":"block","reason":$reason}'
    exit 0
fi

exit 0
