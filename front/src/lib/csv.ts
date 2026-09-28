// Exportación a CSV genérica (no específica de liquidaciones): cualquier tabla del front
// que necesite "Descargar CSV" pasa por acá en vez de reimplementar el escape/blob.
function escapeCsvValue(value: string | number): string {
    const str = String(value);
    return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

export function downloadCsv(filename: string, headers: string[], rows: (string | number)[][]): void {
    const csv = [headers, ...rows].map((row) => row.map(escapeCsvValue).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();

    URL.revokeObjectURL(url);
}
