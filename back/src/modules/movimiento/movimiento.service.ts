import { Database } from "../../db/client";
import { StockInsuficiente } from "../../lib/http/errors";
import { Storage } from "../../lib/storage";
import { DepositoRepository } from "../deposito";
import { LibroRepository } from "../libro";
import { MovimientoConDetalle, MovimientoRepository, VentaDeMovimiento } from "./movimiento.repository";
import { ListMovimientosFilter, MovimientoInsert, MovimientoTipo } from "./movimiento.validator";

// Extremo tal como sale en la respuesta: `exterior` no tiene nombre; un
// `deposito` siempre lo tiene resuelto (incluso si fue dado de baja).
export type ExtremoPublico =
    | { tipo: "deposito"; id: number; nombre: string }
    | { tipo: "exterior" };

export type PublicMovimiento = {
    id: number;
    fecha: Date;
    tipo: MovimientoTipo;
    origen: ExtremoPublico;
    destino: ExtremoPublico;
    // `precio` sólo lo exponen los movimientos comerciales.
    libros: { isbn: string; titulo: string; cantidad: number; precio?: number }[];
    cliente: { id: number; nombre: string } | null;
    file_path: string | null;
    venta: VentaDeMovimiento | null;
};

export type MovimientoServiceDeps = {
    db: Database;
    repository: MovimientoRepository;
    depositoRepository: DepositoRepository;
    libroRepository: Pick<LibroRepository, "findOne">;
    storage: Storage;
};

export function createMovimientoService({ db, repository, depositoRepository, libroRepository, storage }: MovimientoServiceDeps) {
    const formatearExtremo = (tipo: string, depositoId: number | null, nombre: string | null): ExtremoPublico =>
        tipo === "deposito"
            ? { tipo: "deposito", id: depositoId as number, nombre: nombre as string }
            : { tipo: "exterior" };

    const formatear = (movimiento: MovimientoConDetalle): PublicMovimiento => ({
        id: movimiento.id,
        fecha: movimiento.fecha,
        tipo: movimiento.tipo,
        origen: formatearExtremo(movimiento.origen_tipo, movimiento.origen_deposito_id, movimiento.origen_nombre),
        destino: formatearExtremo(movimiento.destino_tipo, movimiento.destino_deposito_id, movimiento.destino_nombre),
        libros: movimiento.libros.map((libro) =>
            libro.precio === null
                ? { isbn: libro.isbn, titulo: libro.titulo, cantidad: libro.cantidad }
                : { isbn: libro.isbn, titulo: libro.titulo, cantidad: libro.cantidad, precio: libro.precio }
        ),
        cliente:
            movimiento.id_cliente === null || movimiento.nombre_cliente === null
                ? null
                : { id: movimiento.id_cliente, nombre: movimiento.nombre_cliente },
        file_path: movimiento.file_path === null ? null : storage.getUrl(movimiento.file_path),
        venta: movimiento.venta
    });

    // El `tipo` de un movimiento manual se deriva del par de extremos al
    // registrarlo (el validator ya descartó exterior→exterior y mismo depósito).
    const derivarTipo = (origenTipo: string, destinoTipo: string): MovimientoTipo => {
        if (origenTipo === "exterior") return "ingreso";
        if (destinoTipo === "exterior") return "baja";
        return "transferencia";
    };

    // Detalle libro por libro de los que no alcanzan en el origen: se calcula
    // sin aplicar nada, para que el rechazo no deje stock a medio mover.
    const resolverFaltantes = async (
        origenId: number,
        userId: number,
        libros: { id_libro: number; isbn: string; titulo: string; cantidad: number }[]
    ) => {
        const cantidades = await depositoRepository.getCantidades(origenId, userId, libros.map((l) => l.id_libro));
        const disponiblePorId = new Map(cantidades.map((c) => [c.id_libro, c.cantidad]));

        return libros
            .filter((libro) => (disponiblePorId.get(libro.id_libro) ?? 0) < libro.cantidad)
            .map((libro) => ({
                isbn: libro.isbn,
                titulo: libro.titulo,
                pedido: libro.cantidad,
                disponible: disponiblePorId.get(libro.id_libro) ?? 0
            }));
    };

    // Atómico: todos los libros se aplican en una única transacción o ninguno
    // (un 409 por stock se tira antes de abrirla, así que no persiste nada).
    // Sólo cubre ingreso, baja y transferencia: nunca cliente, archivo ni venta.
    const registrar = async (data: MovimientoInsert, userId: number): Promise<PublicMovimiento> => {
        // `findPropio` da 404 si el id no es del usuario o es el depósito de un
        // cliente (no puede ser extremo de un movimiento manual).
        const origen = data.origen.tipo === "deposito"
            ? await depositoRepository.findPropio(data.origen.id, userId)
            : null;
        const destino = data.destino.tipo === "deposito"
            ? await depositoRepository.findPropio(data.destino.id, userId)
            : null;

        const libros = await Promise.all(
            data.libros.map(async (item) => {
                const libro = await libroRepository.findOne(item.isbn, userId);

                return { id_libro: libro.id_libro, isbn: libro.isbn, titulo: libro.titulo, cantidad: item.cantidad };
            })
        );

        if (origen) {
            const faltantes = await resolverFaltantes(origen.id, userId, libros);
            if (faltantes.length > 0) {
                throw new StockInsuficiente(`No hay stock suficiente en el depósito ${origen.nombre}`, faltantes);
            }
        }

        const tipo = derivarTipo(data.origen.tipo, data.destino.tipo);

        const movimiento = await db.transaction(async (tx) => {
            const row = await repository.insert(
                {
                    tipo,
                    origen_tipo: data.origen.tipo,
                    origen_deposito_id: origen?.id ?? null,
                    destino_tipo: data.destino.tipo,
                    destino_deposito_id: destino?.id ?? null,
                    user: userId
                },
                tx
            );

            await repository.insertLibros(
                row.id,
                userId,
                libros.map((l) => ({ id_libro: l.id_libro, cantidad: l.cantidad, precio: null })),
                tx
            );

            if (origen) {
                for (const libro of libros) {
                    await depositoRepository.moveStock(origen.id, libro.id_libro, userId, -libro.cantidad, tx);
                }
            }
            if (destino) {
                for (const libro of libros) {
                    await depositoRepository.moveStock(destino.id, libro.id_libro, userId, libro.cantidad, tx);
                }
            }

            return row;
        });

        return formatear({
            id: movimiento.id,
            fecha: movimiento.fecha,
            tipo: movimiento.tipo,
            origen_tipo: movimiento.origen_tipo,
            origen_deposito_id: movimiento.origen_deposito_id,
            destino_tipo: movimiento.destino_tipo,
            destino_deposito_id: movimiento.destino_deposito_id,
            id_cliente: null,
            file_path: null,
            user: movimiento.user,
            origen_nombre: origen?.nombre ?? null,
            destino_nombre: destino?.nombre ?? null,
            nombre_cliente: null,
            cuit: null,
            email: null,
            cond_fiscal: null,
            tipo_cliente: null,
            venta: null,
            libros: libros.map((libro) => ({ ...libro, precio: null, stock: 0 }))
        });
    };

    const listar = async (userId: number, filter: ListMovimientosFilter) => {
        const { movimientos, total } = await repository.getAll(userId, filter);

        return {
            movimientos: movimientos.map(formatear),
            total,
            pagina: filter.pagina,
            porPagina: filter.porPagina,
            totalPaginas: Math.ceil(total / filter.porPagina)
        };
    };

    const obtener = async (id: number, userId: number): Promise<PublicMovimiento> =>
        formatear(await repository.getById(id, userId));

    return {
        registrar,
        listar,
        obtener
    };
}

export type MovimientoService = ReturnType<typeof createMovimientoService>;
