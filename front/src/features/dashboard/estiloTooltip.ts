// El tooltip por defecto de recharts trae tipografía y bordes ajenos al sistema
// de diseño. Con el mismo criterio que el resto de las superficies (papel
// blanco, borde de 1 px, sombra corta) el panel deja de parecer dos productos
// pegados. Vive acá y no en cada gráfico para que los cuatro se vean igual.
export const ESTILO_TOOLTIP = {
    background: "var(--surface-card)",
    border: "1px solid var(--border-subtle)",
    borderRadius: "var(--radius-sm)",
    boxShadow: "var(--shadow-md)",
    fontFamily: "var(--font-body)",
    fontSize: "var(--text-xs)",
    padding: "var(--space-2) var(--space-3)",
    maxWidth: 320
};
