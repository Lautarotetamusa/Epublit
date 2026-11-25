#!/usr/bin/env bash
# Regenera la demo completa en el orden correcto.
#
# Uso:
#   ./generar_demo.sh                  # catálogo, operaciones, fuentes y SQL
#   ./generar_demo.sh --con-fotos      # además descarga retratos de Wikimedia
#   ./generar_demo.sh --con-portadas   # además regenera las portadas (Chromium + magick)
#   ./generar_demo.sh --todo           # fotos + portadas
#   ./generar_demo.sh --solo-sql       # no toca los JSON; sólo SQL y files/demo
#
# Después de generar:
#   ./cargar_demo.sh --reset       # carga local (lee back/.env)
#   SSH_HOST=... ./desplegar_demo.sh --reset   # carga remota por SSH/Docker

set -euo pipefail

BASE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$BASE"

CON_FOTOS=0
CON_PORTADAS=0
SOLO_SQL=0

for arg in "$@"; do
    case "$arg" in
        --con-fotos) CON_FOTOS=1 ;;
        --con-portadas) CON_PORTADAS=1 ;;
        --todo) CON_FOTOS=1; CON_PORTADAS=1 ;;
        --solo-sql) SOLO_SQL=1 ;;
        --help|-h)
            sed -n '2,13p' "$0" | sed 's/^# \{0,1\}//'
            exit 0
            ;;
        *)
            echo "Opción desconocida: $arg" >&2
            echo "Probá con --help." >&2
            exit 1
            ;;
    esac
done

paso() {
    echo ""
    echo "==> $*"
}

PORTADAS="$BASE/../imagenes/portadas"
if [[ "$SOLO_SQL" == "0" && "$CON_PORTADAS" == "0" && -z "$(find "$PORTADAS" -maxdepth 1 -name '*.jpg' -print -quit 2>/dev/null)" ]]; then
    echo "No hay portadas en $PORTADAS."
    echo "En un clon limpio corré: ./generar_demo.sh --todo"
    exit 1
fi

if [[ "$SOLO_SQL" == "0" ]]; then
    paso "1/6 Catálogo desde fuentes/*.json"
    python3 generar_catalogo.py

    if [[ "$CON_FOTOS" == "1" ]]; then
        paso "2/6 Retratos de autores (Wikimedia Commons)"
        python3 descargar_fotos.py
    else
        paso "2/6 Retratos: se conservan los de imagenes/personas y fotos.json"
    fi

    if [[ "$CON_PORTADAS" == "1" ]]; then
        paso "3/6 Portadas (requiere chromium y magick)"
        node generar_portadas.js
    else
        paso "3/6 Portadas: se conservan las de imagenes/portadas"
    fi

    paso "4/6 Operación: movimientos, ventas, liquidaciones y tienda"
    python3 generar_operaciones.py

    paso "5/6 Documento de atribuciones y licencias (ATRIBUCIONES.md)"
    python3 generar_atribuciones.py
else
    paso "Sólo SQL (--solo-sql): no se regeneran los JSON"
fi

if [[ "$SOLO_SQL" == "1" ]]; then
    paso "SQL e imágenes para la app"
else
    paso "6/6 SQL e imágenes para la app"
fi
python3 generar_sql.py

echo ""
echo "Listo."
echo "  SQL:      sql/cargar_demo.sql"
echo "  Limpieza: sql/limpiar_demo.sql"
echo "  Imágenes: files/demo/"
echo ""
echo "Carga local:  ./cargar_demo.sh --reset"
echo "Carga remota: SSH_HOST=... SSH_USER=... ./desplegar_demo.sh --reset"
