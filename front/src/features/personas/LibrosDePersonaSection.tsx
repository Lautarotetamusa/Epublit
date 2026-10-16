import { Badge, Card, EmptyState, Table } from "../../design-system";
import type { LibroDePersona } from "../../api/persona";
import { nombreVisible, tonoDeRol } from "../roles/presentacionRol";

type Props = {
    libros: LibroDePersona[];
    onAbrirLibro: (isbn: string) => void;
};

// Los libros en los que participa la persona, cada uno con el rol de la cuenta
// con el que participa (plan 011, tarea 12). La misma persona puede aparecer
// dos veces si tiene dos roles distintos en el mismo libro.
export function LibrosDePersonaSection({ libros, onAbrirLibro }: Props) {
    return (
        <Card title="Libros en los que participa" padded={false}>
            <Table
                columns={[
                    { header: "Título", key: "titulo", wrap: true },
                    {
                        header: "Rol",
                        cell: (row: LibroDePersona) => <Badge tone={tonoDeRol(row.rol)}>{nombreVisible(row.rol.nombre)}</Badge>
                    }
                ]}
                rows={libros}
                onRowClick={(row: LibroDePersona) => onAbrirLibro(row.isbn)}
                empty={
                    <EmptyState
                        icon="library"
                        title="Todavía no participa de ningún libro"
                        description="Cuando le asignes un rol en un libro, aparece acá."
                    />
                }
            />
        </Card>
    );
}
