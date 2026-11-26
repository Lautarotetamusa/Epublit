import { Database } from "../../db/client";
import { UserRepository } from "./user.repository";
import { UserInsert, UserUpdate, User } from "./user.validator";
import { erroresDeAcceso } from "./user.errors";
import { CertificadoDeLaCuenta, EstadoFacturacion, evaluarFacturacion } from "./user.facturacion";
import { ValidationError } from "../../lib/http/errors";
import { DepositoRepository, NOMBRE_DEPOSITO_PRINCIPAL } from "../deposito";
import { MedioPagoRepository } from "../medioPago";
import { RolRepository } from "../rol";
import { TipoEdicionRepository } from "../tipoEdicion";
import {
    createUserFolder,
    createKey,
    createCSR,
    readCSR,
    asegurarCSR,
    eliminarClaves,
    parseCertificado,
    certificadoCorrespondeALaCuenta,
    guardarCertificadoProduccion,
    leerCertificado,
    AfipService
} from "../../lib/afip/Afip";

export type UserServiceDeps = {
    db: Database;
    repository: UserRepository;
    afipService: AfipService;
    // Alta y baja definitiva del depósito principal y los de los clientes
    // por defecto (ver specs/008-movimientos-deposito y 026-registro-email).
    depositoRepository: Pick<DepositoRepository, "insert" | "removeAllOfUser">;
    // Alta y baja definitiva de los 5 medios de pago por defecto (ver
    // specs/010-medios-pago).
    medioPagoRepository: Pick<MedioPagoRepository, "insertDefaults" | "removeAllOfUser">;
    // Alta y baja definitiva de los roles por defecto (autor, ilustrador; ver
    // specs/011-roles).
    rolRepository: Pick<RolRepository, "insertDefaults" | "removeAllOfUser">;
    // Alta y baja definitiva de los tipos de edición por defecto (Normal,
    // Pop up, Cartoné; ver módulo TipoEdición).
    tipoEdicionRepository: Pick<TipoEdicionRepository, "insertDefaults" | "removeAllOfUser">;
};

export function createUserService({ db, repository, afipService, depositoRepository, medioPagoRepository, rolRepository, tipoEdicionRepository }: UserServiceDeps) {
    // Alta completa del usuario, sus clientes por defecto (MOSTRADOR,
    // CONSUMIDOR FINAL), su depósito principal, sus medios de pago por
    // defecto y sus roles por defecto en una única transacción Postgres: la
    // transacción es responsabilidad del service, el repository sólo expone
    // los inserts crudos.
    const createUser = async (data: UserInsert): Promise<User> => {
        return db.transaction(async (tx) => {
            const user = await repository.insertUser(data, tx);
            const clientesPorDefecto = await repository.insertDefaultClientes(user.id, tx);
            await depositoRepository.insert(
                { nombre: NOMBRE_DEPOSITO_PRINCIPAL, principal: true, user: user.id },
                tx
            );
            await medioPagoRepository.insertDefaults(user.id, tx);
            await rolRepository.insertDefaults(user.id, tx);
            await tipoEdicionRepository.insertDefaults(user.id, tx);

            // Cada cliente tiene su depósito real propio (ver
            // specs/009-ledger-unificado).
            for (const cliente of clientesPorDefecto) {
                await depositoRepository.insert(
                    { nombre: cliente.nombre, principal: false, user: user.id, id_cliente: cliente.id },
                    tx
                );
            }

            return repository.stripPassword(user);
        });
    };

    // Borra todo lo que crea `createUser` (los tokens de la cuenta caen en
    // cascada). Sólo sirve para cuentas que nunca se usaron: con ventas,
    // libros, etc. las FKs lo impiden. Los depósitos van antes que los
    // clientes porque los de cliente los referencian.
    const eliminarCuenta = async (user: Pick<User, "id" | "cuit">): Promise<void> => {
        await db.transaction(async (tx) => {
            await depositoRepository.removeAllOfUser(user.id, tx);
            await repository.removeDefaultClientes(user.id, tx);
            await medioPagoRepository.removeAllOfUser(user.id, tx);
            await rolRepository.removeAllOfUser(user.id, tx);
            await tipoEdicionRepository.removeAllOfUser(user.id, tx);
            await repository.removeUser(user.id, tx);
        });

        // Las claves son por CUIT, no por cuenta: si otra cuenta usa el mismo
        // CUIT, son suyas.
        if ((await repository.findByCuit(user.cuit)).length === 0) {
            await eliminarClaves(user.cuit);
        }
    };

    // Alta en Postgres + clave y CSR en el filesystem. Si el paso de
    // filesystem falla, revierte el alta ya confirmada (de ahí el try/catch).
    const darDeAlta = async (data: UserInsert): Promise<User> => {
        const user = await createUser(data);

        try {
            await createUserFolder(user.cuit);
            await createKey(user.cuit);
            await createCSR(user);
        } catch (err) {
            await eliminarCuenta(user);
            throw err;
        }

        return user;
    };

    // Guardar el propio email con otras mayúsculas no es un cambio de dueño.
    const asegurarEmailLibre = async (id: number, email: string | undefined): Promise<void> => {
        if (!email) return;

        const duena = await repository.findByEmail(email);
        if (duena && duena.id !== id) throw erroresDeAcceso.emailTomado();
    };

    // `changed` en `false` cuando no hay nada que actualizar (bradb tira si
    // `data` viene vacío): el controller decide con eso qué mensaje
    // devolver, sin tener que conocer la regla en sí.
    const update = async (id: number, data: UserUpdate): Promise<{ user: User; changed: boolean }> => {
        if (Object.keys(data).length === 0) {
            return { user: await repository.findOne({ id }), changed: false };
        }

        await asegurarEmailLibre(id, data.email);

        const updated = await repository.persistUpdate({ id }, data);
        return { user: repository.stripPassword(updated), changed: true };
    };

    const refreshAfipData = async (id: number): Promise<User> => {
        const current = await repository.findOne({ id });
        const afipData = await afipService.getAfipData(current.cuit);
        const updated = await repository.persistUpdate({ id }, afipData);

        return repository.stripPassword(updated);
    };

    // Se valida el contenido y no el mimetype: según el navegador, un `.crt`
    // o `.pem` llega con tipos distintos. El certificado que genera el
    // instructivo es de producción, así que subirlo pasa la cuenta a producción.
    const uploadCert = async (id: number, cuit: string, contenido: Buffer): Promise<void> => {
        const certificado = parseCertificado(contenido);
        if (!certificado) throw new ValidationError("El archivo no es un certificado válido");

        if (!(await certificadoCorrespondeALaCuenta(certificado, cuit))) {
            throw new ValidationError(
                "El certificado no corresponde a tu cuenta: generalo en ARCA con el CSR que descargás desde tu perfil"
            );
        }
        if (new Date(certificado.validTo) <= new Date()) {
            throw new ValidationError("El certificado está vencido: generá uno nuevo en ARCA");
        }

        await guardarCertificadoProduccion(cuit, contenido);
        await repository.persistUpdate({ id }, { production: true });
    };

    const certificadoDe = async (user: User): Promise<CertificadoDeLaCuenta | null> => {
        const certificado = await leerCertificado(user.cuit, user.production);
        if (!certificado) return null;

        return { certificado, correspondeALaCuenta: await certificadoCorrespondeALaCuenta(certificado, user.cuit) };
    };

    const getEstadoFacturacion = async (id: number): Promise<EstadoFacturacion> => {
        const user = await repository.findOne({ id });
        return evaluarFacturacion(user, await certificadoDe(user), new Date());
    };

    // El usuario lo necesita para generar su certificado en ARCA, que después
    // sube con `uploadCert`.
    const getCSR = async (id: number): Promise<{ data: Buffer; filename: string }> => {
        const user = await repository.findOne({ id });
        await asegurarCSR(user);

        return { data: await readCSR(user.cuit), filename: `${user.cuit}.csr` };
    };

    return {
        findOne: repository.findOne,
        createUser,
        darDeAlta,
        eliminarCuenta,
        update,
        refreshAfipData,
        uploadCert,
        getEstadoFacturacion,
        getCSR
    };
}

export type UserService = ReturnType<typeof createUserService>;
