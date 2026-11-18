import type { ReactNode } from "react";

export function Detalle({ label, value }: { label: string; value: ReactNode }) {
    return (
        <div>
            <dt style={{ fontSize: "var(--text-2xs)", textTransform: "uppercase", letterSpacing: "var(--tracking-caps)", color: "var(--text-muted)" }}>
                {label}
            </dt>
            <dd style={{ margin: "4px 0 0" }}>{value}</dd>
        </div>
    );
}
