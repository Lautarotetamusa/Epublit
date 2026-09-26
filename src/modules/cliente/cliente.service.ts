import { ClienteRepository } from "./cliente.repository";
import { Client, ClienteInsert, ClienteUpdate, tipoCliente } from "./cliente.validator";
import { AfipService } from "../../lib/afip/Afip";
import { Duplicated } from "bradb";
import { ValidationError } from "../../lib/http/errors";

export type ClienteServiceDeps = {
    repository: ClienteRepository;
    afipService: AfipService;
};

export function createClienteService({ repository, afipService }: ClienteServiceDeps) {
    // Regla de negocio compartida por `create`/`update`: no puede haber dos
    // clientes "inscripto" con el mismo cuit para el mismo usuario.
    const assertCuitDisponible = async (cuit: string, userId: number): Promise<void> => {
        if (await repository.existsByCuit(cuit, userId)) {
            throw new Duplicated(`El cliente con cuit ${cuit} ya existe`);
        }
    };

    // Resuelve los campos que vienen de AFIP (compartidos por `create`/`update`),
    // en el shape que necesita `ClienteInsert`/`ClienteUpdate`.
    const resolveDatosAfip = async (cuit: string) => {
        const afipData = await afipService.getAfipData(cuit);
        return {
            cond_fiscal: afipData.cond_fiscal,
            razon_social: afipData.razon_social,
            domicilio: afipData.domicilio
        };
    };

    // Reglas de negocio (antes vivían en el controller): no se puede cargar
    // a uno mismo como cliente. Fuerza `tipo: "inscripto"` acá replica
    // `Cliente.insert` actual: no se puede crear un cliente que no sea
    // inscripto por este endpoint.
    const create = async (body: ClienteInsert, userId: number, ownerCuit: string): Promise<Client> => {
        if (body.cuit === ownerCuit) {
            throw new ValidationError("No podes cargarte a vos mismo como cliente");
        }
        await assertCuitDisponible(body.cuit, userId);
        const datosAfip = await resolveDatosAfip(body.cuit);

        return repository.insert({
            ...body,
            ...datosAfip,
            user: userId,
            tipo: tipoCliente.inscripto
        });
    };

    const update = async (id: number, userId: number, body: ClienteUpdate): Promise<Client> => {
        const cliente = await repository.findOne({ id, user: userId });

        if (cliente.tipo === tipoCliente.particular) {
            throw new ValidationError("No se puede actualizar un cliente CONSUMIDOR FINAL");
        }

        if (body.cuit && body.cuit !== cliente.cuit) {
            await assertCuitDisponible(body.cuit, userId);
            const datosAfip = await resolveDatosAfip(body.cuit);

            return repository.update({ id, user: userId }, { ...body, ...datosAfip });
        }

        return repository.update({ id, user: userId }, body);
    };

    // Bloquea tanto CONSUMIDOR FINAL como MOSTRADOR chequeando sólo `tipo` (ver
    // plan, "Decisiones y trade-offs": hoy son equivalentes porque `create`
    // siempre fuerza `tipo: "inscripto"`).
    const remove = async (id: number, userId: number): Promise<void> => {
        const cliente = await repository.findOne({ id, user: userId });

        if (cliente.tipo === tipoCliente.particular || cliente.tipo === tipoCliente.negro) {
            throw new ValidationError("No se puede eliminar el cliente CONSUMIDOR FINAL ni MOSTRADOR");
        }

        await repository.remove({ id, user: userId });
    };

    return {
        findOne: repository.findOne,
        findAll: repository.findAll,
        existsByCuit: repository.existsByCuit,
        create,
        update,
        remove
    };
}

export type ClienteService = ReturnType<typeof createClienteService>;

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
