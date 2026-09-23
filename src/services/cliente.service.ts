import { and, eq, isNull } from "drizzle-orm";
import { ServiceBuilder } from "bradb";
import { db } from "../pgDb";
import { clientesTable } from "../schemas/clientes.schema";
import { clienteFilterMap } from "../filters/cliente.filter";
import { Client, ClienteInsert, ClienteUpdate, TipoCliente, tipoCliente } from "../validators/cliente.validator";
import { getAfipData } from "../afip/Afip";
import { ValidationError } from "../models/errors";

const builder = new ServiceBuilder(db, clientesTable, clienteFilterMap);

const findOne = builder.findOne();
const create = builder.create();
const update = builder.update();
const remove = builder.delete();

// Ordenado por nombre: mismo `ORDER BY nombre ASC` del `Cliente.getAll` actual.
const selectOrderedByNombre = () => db.select().from(clientesTable).orderBy(clientesTable.nombre).$dynamic();
const findAllRaw = builder.findAll(selectOrderedByNombre, false);
const findAll = async (userId: number, tipo?: TipoCliente) => {
    return findAllRaw({ user: userId, ...(tipo ? { tipo } : {}) });
};

const existsByCuit = async (cuit: string, userId: number): Promise<boolean> => {
    const rows = await db
        .select({ id: clientesTable.id })
        .from(clientesTable)
        .where(
            and(
                eq(clientesTable.cuit, cuit),
                eq(clientesTable.user, userId),
                eq(clientesTable.tipo, tipoCliente.inscripto),
                isNull(clientesTable.deletedAt)
            )
        )
        .limit(1);

    return rows.length > 0;
};

// Forzar `tipo: "inscripto"` acá replica `Cliente.insert` actual: no se puede
// crear un cliente que no sea inscripto por este endpoint.
const createCliente = async (body: ClienteInsert, userId: number): Promise<Client> => {
    const afipData = await getAfipData(body.cuit);

    return create({
        ...body,
        cond_fiscal: afipData.cond_fiscal,
        razon_social: afipData.razon_social,
        domicilio: afipData.domicilio,
        user: userId,
        tipo: tipoCliente.inscripto
    });
};

const updateCliente = async (id: number, userId: number, body: ClienteUpdate): Promise<Client> => {
    const cliente = await findOne({ id, user: userId });

    if (cliente.tipo === tipoCliente.particular) {
        throw new ValidationError("No se puede actualizar un cliente CONSUMIDOR FINAL");
    }

    if (body.cuit && body.cuit !== cliente.cuit) {
        const afipData = await getAfipData(body.cuit);
        return update(
            { id, user: userId },
            {
                ...body,
                cond_fiscal: afipData.cond_fiscal,
                razon_social: afipData.razon_social,
                domicilio: afipData.domicilio
            }
        );
    }

    return update({ id, user: userId }, body);
};

// Bloquea tanto CONSUMIDOR FINAL como MOSTRADOR chequeando sólo `tipo` (ver
// plan, "Decisiones y trade-offs": hoy son equivalentes porque `create`
// siempre fuerza `tipo: "inscripto"`).
const removeCliente = async (id: number, userId: number): Promise<void> => {
    const cliente = await findOne({ id, user: userId });

    if (cliente.tipo === tipoCliente.particular || cliente.tipo === tipoCliente.negro) {
        throw new ValidationError("No se puede eliminar el cliente CONSUMIDOR FINAL ni MOSTRADOR");
    }

    await remove({ id, user: userId });
};

export function generateClientPath(razonSocial: string): string {
    const dateStr = new Date()
        .toISOString()
        .replace(/\..+/, '')     // delete the . and everything after;
        .replaceAll('-', '')
        .replaceAll(':', '')
        .replace('T', '-')       // replace T with a '-'

    return razonSocial
        .replaceAll('-', '')
        .replaceAll(' ', '')+'-'+dateStr+'.pdf';
}

export const clienteService = {
    findOne,
    findAll,
    existsByCuit,
    create: createCliente,
    update: updateCliente,
    remove: removeCliente,
    generateClientPath
};
