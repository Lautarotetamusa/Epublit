#!/bin/bash

# Check if CUIT argument is provided
if [ $# -ne 2 ]; then
    echo "Usage: $0 <ssh-key-file-path> <cuit>"
    exit 1
fi

ssh_key="$1"
cuit="$2"
local_csr="./cert.csr"
timeout_sec=15

# Check if HOST environment variable exists
if [ -z "$SV" ]; then
    echo "Error: HOST environment variable is not set."
    exit 1
fi

if [ ! -f "$ssh_key" ]; then
    echo "Error: Clave SSH en $ssh_key no encontrada"
    exit 1
fi

# Download the CSR file using scp
remote_path="root@$SV:/home/Epublit/afipkeys/$cuit/cert.csr"

if ! scp -i "$ssh_key" "$remote_path" "$cuit.csr"; then
    echo "Error: Fallo en transferencia SCP"
    exit 1
fi

echo "Successfully downloaded CSR file to: $local_csr"
