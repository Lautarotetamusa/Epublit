import { Database } from "../../db/client";
import { StockInsuficiente } from "../../lib/http/errors";
import { DepositoRepository } from "../deposito";
import { LibroRepository } from "../libro";
import { MovimientoConNombres, MovimientoRepository } from "./movimiento.repository";
import { MovimientoInsert } from "./movimiento.validator";

// Extremo tal como sale en la respuesta: `exterior` no tiene nombre; un
// `deposito` siempre lo tiene resuelto (incluso si fue dado de baja).
export type ExtremoPublico =
    | { tipo: "deposito"; id: number; nombre: string }
    | { tipo: "exterior" };

export type PublicMovimiento = {
    id: number;
    fecha: Date;
    origen: ExtremoPublico;
    destino: ExtremoPublico;
    libros: { isbn: string; titulo: string; cantidad: number }[];
};

export type MovimientoServiceDeps = {
    db: Database;
    repository: MovimientoRepository;
    depositoRepository: DepositoRepository;
    libroRepository: Pick<LibroRepository, "findOne">;
};

export function createMovimientoService({ db, repository, depositoRepository, libroRepository }: MovimientoServiceDeps) {
    const formatearExtremo = (tipo: string, depositoId: number | null, nombre: string | null): ExtremoPublico =>
        tipo === "deposito"
            ? { tipo: "deposito", id: depositoId as number, nombre: nombre as string }
            : { tipo: "exterior" };

    const formatear = (movimiento: MovimientoConNombres): PublicMovimiento => ({
        id: movimiento.id,
        fecha: movimiento.fecha,
        origen: formatearExtremo(movimiento.origen_tipo, movimiento.origen_deposito_id, movimiento.origen_nombre),
        destino: formatearExtremo(movimiento.destino_tipo, movimiento.destino_deposito_id, movimiento.destino_nombre),
        libros: movimiento.libros.map((libro) => ({ isbn: libro.isbn, titulo: libro.titulo, cantidad: libro.cantidad }))
    });

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
    const registrar = async (data: MovimientoInsert, userId: number): Promise<PublicMovimiento> => {
        const origen = data.origen.tipo === "deposito"
            ? await depositoRepository.findOne({ id: data.origen.id, user: userId })
            : null;
        const destino = data.destino.tipo === "deposito"
            ? await depositoRepository.findOne({ id: data.destino.id, user: userId })
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

        const movimiento = await db.transaction(async (tx) => {
            const row = await repository.insert(
                {
                    origen_tipo: data.origen.tipo,
                    origen_deposito_id: origen?.id ?? null,
                    destino_tipo: data.destino.tipo,
                    destino_deposito_id: destino?.id ?? null,
                    user: userId
                },
                tx
            );

            await repository.insertLibros(row.id, userId, libros.map((l) => ({ id_libro: l.id_libro, cantidad: l.cantidad })), tx);

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
            ...movimiento,
            origen_nombre: origen?.nombre ?? null,
            destino_nombre: destino?.nombre ?? null,
            libros
        });
    };

    const listar = async (userId: number, pagina: number, porPagina: number) => {
        const offset = (pagina - 1) * porPagina;
        const { movimientos, total } = await repository.getAll(userId, offset, porPagina);

        return {
            movimientos: movimientos.map(formatear),
            total,
            pagina,
            porPagina,
            totalPaginas: Math.ceil(total / porPagina)
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
