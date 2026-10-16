import { NotFound } from "bradb";
import { Tx } from "../../db/client";
import { Conflict } from "../../lib/http/errors";
import { aFechaISO } from "../../lib/fecha";
import { AnticipoConDatos, AnticipoRepository } from "./anticipo.repository";
import { AnticipoPagar } from "./anticipo.validator";

export type AnticipoServiceDeps = {
    repository: AnticipoRepository;
};

export type PublicAnticipo = {
    id: number;
    id_libro: number;
    isbn: string;
    titulo: string;
    id_persona: number;
    nombre: string;
    id_rol: number;
    rol: string;
    monto: number;
    fecha_lanzamiento: string;
    reimpresiones: number;
    pagado: boolean;
    fecha_pago: string | null;
};

const hoyISO = (): string => new Date().toISOString().slice(0, 10);

export function createAnticipoService({ repository }: AnticipoServiceDeps) {
    const toPublic = (anticipo: AnticipoConDatos, incorporaciones: number): PublicAnticipo => ({
        id: anticipo.id,
        id_libro: anticipo.id_libro,
        isbn: anticipo.isbn,
        titulo: anticipo.titulo,
        id_persona: anticipo.id_persona,
        nombre: anticipo.nombre,
        id_rol: anticipo.id_rol,
        rol: anticipo.rol,
        monto: anticipo.monto,
        fecha_lanzamiento: aFechaISO(anticipo.fecha_lanzamiento),
        // La primera incorporación es el lanzamiento: cada una posterior es
        // una reimpresión.
        reimpresiones: Math.max(0, incorporaciones - 1),
        pagado: anticipo.pagado,
        fecha_pago: anticipo.fecha_pago === null ? null : aFechaISO(anticipo.fecha_pago)
    });

    // Genera (o intenta generar) los anticipos de un libro: es idempotente, así
    // que se puede llamar en el lanzamiento, en cada reimpresión y al definir
    // un monto acordado después de lanzado. Sin lanzamiento o sin montos
    // acordados no hace nada.
    const generarDeLibro = async (idLibro: number, userId: number, tx?: Tx): Promise<void> => {
        const fechaLanzamiento = await repository.getFechaLanzamiento(idLibro, userId, tx);
        if (!fechaLanzamiento) return;

        const acuerdos = await repository.getAcuerdosConMonto(idLibro, userId, tx);
        if (acuerdos.length === 0) return;

        await repository.insertMany(
            acuerdos.map((acuerdo) => ({
                id_libro: idLibro,
                id_persona: acuerdo.id_persona,
                id_rol: acuerdo.id_rol,
                monto: acuerdo.monto_acordado as number,
                fecha_lanzamiento: aFechaISO(fechaLanzamiento),
                user: userId
            })),
            tx
        );
    };

    const listar = async (userId: number): Promise<PublicAnticipo[]> => {
        const [anticipos, incorporaciones] = await Promise.all([
            repository.findActivos(userId),
            repository.getIncorporacionesPorLibro(userId)
        ]);

        const porLibro = new Map(incorporaciones.map((fila) => [fila.id_libro, fila.cantidad]));

        return anticipos.map((anticipo) => toPublic(anticipo, porLibro.get(anticipo.id_libro) ?? 0));
    };

    // Pago único del anticipo entero: no hay monto ni parciales (ver
    // specs/012-liquidaciones-pagos, tarea 12).
    const pagar = async (id: number, userId: number, data: AnticipoPagar): Promise<PublicAnticipo> => {
        const anticipo = await repository.findOne(id, userId);
        if (!anticipo) throw new NotFound(`No se encontró el anticipo con id ${id}`);
        if (anticipo.pagado) throw new Conflict("El anticipo ya está pagado");

        await repository.marcarPagado(id, userId, data.fecha ?? hoyISO());

        const actualizado = await repository.findOne(id, userId);
        const incorporaciones = await repository.getIncorporacionesPorLibro(userId);
        const cantidad = incorporaciones.find((fila) => fila.id_libro === anticipo.id_libro)?.cantidad ?? 0;

        return toPublic(actualizado as AnticipoConDatos, cantidad);
    };

    return {
        generarDeLibro,
        listar,
        pagar
    };
}

export type AnticipoService = ReturnType<typeof createAnticipoService>;
