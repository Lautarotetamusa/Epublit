import { and, asc, desc, eq, isNull } from "drizzle-orm";
import { Database } from "../../../db/client";
import { librosTable } from "../../libro/libro.schema";
import { librosPersonasTable } from "../../libro/libroPersona.schema";
import { personasTable } from "../../persona/persona.schema";
import { rolesTable } from "../../rol/rol.schema";
import { shippingConfigTable } from "../shipping/shippingConfig.schema";
import { mercadoPagoTable } from "../payment/mercadopago.schema";

export type CatalogRepositoryDeps = {
    db: Database;
};

export function createCatalogRepository({ db }: CatalogRepositoryDeps) {
    const getConfiguration = async (userId: number) => {
        const [envio, mercadopago] = await Promise.all([
            db.select().from(shippingConfigTable).where(eq(shippingConfigTable.user, userId)).limit(1),
            db
                .select({ estado: mercadoPagoTable.estado })
                .from(mercadoPagoTable)
                .where(and(eq(mercadoPagoTable.user, userId), eq(mercadoPagoTable.estado, "conectado")))
                .limit(1)
        ]);

        return {
            envio: envio[0] ?? null,
            mercadoPagoConnected: mercadopago.length > 0
        };
    };

    // Los “novedades” son los últimos libros dados de alta: `id_libro` es una
    // identity y crece en el orden de creación. Se calcula acá, del lado del
    // servidor, para no exponer el id interno ni depender de la fecha de edición.
    const findUltimosIds = async (userId: number, cantidad: number): Promise<number[]> => {
        const filas = await db
            .select({ id: librosTable.id_libro })
            .from(librosTable)
            .where(and(eq(librosTable.user, userId), isNull(librosTable.deletedAt)))
            .orderBy(desc(librosTable.id_libro))
            .limit(cantidad);

        return filas.map((fila) => fila.id);
    };

    // Personas con al menos un libro activo de la cuenta, con sus roles y sus
    // libros. Se agrupa en el service: una misma persona puede tener varios
    // roles en el mismo libro (ver specs/011-roles).
    const findPersonas = async (userId: number) =>
        db
            .select({
                id_persona: personasTable.id,
                nombre: personasTable.nombre,
                bio: personasTable.bio,
                foto_key: personasTable.foto_key,
                rol: rolesTable.nombre,
                isbn: librosTable.isbn,
                titulo: librosTable.titulo,
                portada_key: librosTable.portada_key,
                fecha_edicion: librosTable.fecha_edicion
            })
            .from(personasTable)
            .innerJoin(
                librosPersonasTable,
                eq(librosPersonasTable.id_persona, personasTable.id)
            )
            .innerJoin(
                librosTable,
                and(
                    eq(librosTable.id_libro, librosPersonasTable.id_libro),
                    eq(librosTable.user, userId),
                    isNull(librosTable.deletedAt)
                )
            )
            .innerJoin(
                rolesTable,
                and(
                    eq(rolesTable.id, librosPersonasTable.id_rol),
                    eq(rolesTable.user, userId),
                    isNull(rolesTable.deletedAt)
                )
            )
            .where(
                and(
                    eq(personasTable.user, userId),
                    isNull(personasTable.deletedAt)
                )
            )
            .orderBy(
                asc(personasTable.nombre),
                asc(librosTable.titulo),
                asc(rolesTable.nombre)
            );

    return {
        getConfiguration,
        findUltimosIds,
        findPersonas
    };
}

export type CatalogRepository = ReturnType<typeof createCatalogRepository>;
