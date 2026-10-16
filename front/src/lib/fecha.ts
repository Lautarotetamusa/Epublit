// Formateo de fechas es-AR compartido (`dd/mm/yyyy`, ver
// design-system/readme.md#fundamentos-de-contenido, "Números"). El backend
// manda fechas ISO (`YYYY-MM-DD`); la interfaz nunca las muestra crudas.
export function formatFecha(iso: string): string {
    return new Date(`${iso}T00:00:00`).toLocaleDateString("es-AR");
}

// Rango de un período, con guion medio: "01/06/2026 – 30/06/2026".
export function formatRango(desde: string, hasta: string): string {
    return `${formatFecha(desde)} – ${formatFecha(hasta)}`;
}
