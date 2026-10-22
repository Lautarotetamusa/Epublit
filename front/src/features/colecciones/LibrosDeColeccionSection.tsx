import { useState } from "react";
import { Button, Card, Dialog, EmptyState, IconButton, Input, Pagination, Table } from "../../design-system";
import type { ColeccionLibro } from "../../api/coleccion";
import type { Libro } from "../../api/libro";
import { useToast } from "../../notifications/ToastProvider";
import { getErrorMessage } from "../../lib/errors";
import { useBusquedaLibros } from "./useBusquedaLibros";

type Props = {
    libros: ColeccionLibro[];
    loading: boolean;
    onAgregar: (isbns: string[]) => Promise<void>;
    onQuitar: (isbn: string) => Promise<void>;
    onAbrirLibro: (isbn: string) => void;
};

// Los libros de la colección se agregan y se quitan desde acá; para mover un
// libro de una colección a otra, la ficha del libro (ver specs/007-colecciones).
export function LibrosDeColeccionSection({ libros, loading, onAgregar, onQuitar, onAbrirLibro }: Props) {
    const { showToast } = useToast();
    const [showAgregar, setShowAgregar] = useState(false);

    const handleQuitar = async (isbn: string) => {
        try {
            await onQuitar(isbn);
        } catch (err) {
            showToast("error", getErrorMessage(err));
        }
    };

    return (
        <Card
            title="Libros de la colección"
            padded={false}
            actions={
                <Button variant="secondary" size="sm" onClick={() => setShowAgregar(true)}>
                    Agregar libros
                </Button>
            }
        >
            <Table
                columns={[
                    {
                        header: "",
                        width: 40,
                        cell: (row: ColeccionLibro) => (
                            <div
                                style={{
                                    width: 32,
                                    height: 44,
                                    borderRadius: "var(--radius-sm)",
                                    overflow: "hidden",
                                    background: "var(--pino-800)",
                                    boxShadow: "var(--shadow-xs)"
                                }}
                            >
                                {row.portada_url ? (
                                    <img src={row.portada_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                                ) : null}
                            </div>
                        )
                    },
                    { header: "Título", key: "titulo" },
                    { header: "ISBN", key: "isbn", mono: true },
                    { header: "Precio", align: "right", cell: (row: ColeccionLibro) => row.precio.toLocaleString("es-AR") },
                    {
                        header: "",
                        align: "right",
                        width: 48,
                        cell: (row: ColeccionLibro) => (
                            <IconButton
                                icon="x"
                                label={`Quitar ${row.titulo} de la colección`}
                                variant="ghost"
                                onClick={(event) => {
                                    event.stopPropagation();
                                    handleQuitar(row.isbn);
                                }}
                            />
                        )
                    }
                ]}
                rows={libros}
                onRowClick={(row: ColeccionLibro) => onAbrirLibro(row.isbn)}
                empty={loading ? "Cargando..." : "Todavía no hay libros en esta colección. Agregalos con el botón de arriba."}
            />

            {showAgregar ? (
                <AgregarLibrosDialog
                    onClose={() => setShowAgregar(false)}
                    onAgregar={async (isbns) => {
                        try {
                            await onAgregar(isbns);
                        } catch (err) {
                            showToast("error", getErrorMessage(err));
                        }
                    }}
                />
            ) : null}
        </Card>
    );
}

// Buscador en vez de listado: el catálogo no se puede traer entero, así que el
// diálogo arranca pidiendo un término y consulta la API de a una página
// acotada (ver useBusquedaLibros). Para elegir varios de una vez se usa el
// mismo patrón que el catálogo para armar una venta (Table `selectable` + una
// acción en el pie).
function AgregarLibrosDialog({ onClose, onAgregar }: { onClose: () => void; onAgregar: (isbns: string[]) => Promise<void> }) {
    const { termino, setTermino, page, setPage, items, pagination, loading, buscando } = useBusquedaLibros();
    const [seleccionados, setSeleccionados] = useState<Set<string | number>>(new Set());
    const [saving, setSaving] = useState(false);

    const pageCount = pagination ? Math.max(1, Math.ceil(pagination.total / pagination.pageSize)) : 1;
    const cantidad = seleccionados.size;

    const toggle = (isbn: string) => {
        setSeleccionados((actual) => {
            const siguiente = new Set(actual);
            if (siguiente.has(isbn)) siguiente.delete(isbn);
            else siguiente.add(isbn);
            return siguiente;
        });
    };

    const handleAgregar = async () => {
        setSaving(true);
        await onAgregar([...seleccionados].map(String));
        setSaving(false);
        onClose();
    };

    return (
        <Dialog
            open
            title="Agregar libros"
            description="Buscá por título o por ISBN completo. Sólo se pueden agregar libros que no estén en otra colección."
            width={720}
            onClose={onClose}
            footer={
                <>
                    <Button variant="secondary" onClick={onClose}>
                        Cancelar
                    </Button>
                    <Button onClick={handleAgregar} loading={saving} disabled={cantidad === 0}>
                        {cantidad === 0 ? "Agregar libros" : cantidad === 1 ? "Agregar 1 libro" : `Agregar ${cantidad} libros`}
                    </Button>
                </>
            }
        >
            <Input
                iconStart="search"
                placeholder="Buscar por título o ISBN completo..."
                value={termino}
                onChange={(event) => setTermino(event.target.value)}
            />

            {buscando ? (
                <>
                    {/* El alto acotado es sólo para la lista con resultados: el
                        estado vacío no tiene por qué scrollear. */}
                    <div
                        style={{
                            marginTop: "var(--space-4)",
                            maxHeight: items.length > 0 ? "min(38vh, 420px)" : undefined,
                            overflowY: items.length > 0 ? "auto" : undefined
                        }}
                    >
                        <Table
                            selectable
                            selectedKeys={seleccionados}
                            onSelectionChange={setSeleccionados}
                            rowKey={(row: Libro) => row.isbn}
                            columns={[
                                { header: "Título", key: "titulo" },
                                { header: "ISBN", key: "isbn", mono: true },
                                { header: "Precio", align: "right", cell: (row: Libro) => row.precio.toLocaleString("es-AR") }
                            ]}
                            rows={items}
                            onRowClick={(row: Libro) => toggle(row.isbn)}
                            empty={
                                loading ? (
                                    "Buscando..."
                                ) : (
                                    <EmptyState
                                        icon="search"
                                        title="Ningún libro coincide"
                                        description="Probá con otra parte del título, o con el ISBN completo. Sólo aparecen libros sin colección."
                                    />
                                )
                            }
                        />
                    </div>
                    {pagination && items.length > 0 ? (
                        <Pagination
                            style={{ marginTop: "var(--space-3)" }}
                            page={page}
                            pageCount={pageCount}
                            total={pagination.total}
                            onChange={setPage}
                        />
                    ) : null}
                </>
            ) : (
                <div style={{ marginTop: "var(--space-4)" }}>
                    <EmptyState
                        icon="search"
                        title="Buscá un libro"
                        description="Escribí parte del título o el ISBN completo y te mostramos los que coinciden."
                    />
                </div>
            )}
        </Dialog>
    );
}
