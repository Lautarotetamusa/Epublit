import bcrypt from "bcrypt";
import { Database } from "../../db/client";
import { UserRepository } from "./user.repository";
import { UserInsert, UserUpdate, User, CreateUserInput } from "./user.validator";
import type { EmailService } from "../../lib/email";
import { CertificadoDeLaCuenta, EstadoFacturacion, evaluarFacturacion } from "./user.facturacion";
import { Unauthorized } from "bradb";
import { ValidationError } from "../../lib/http/errors";
import { DepositoRepository, NOMBRE_DEPOSITO_PRINCIPAL } from "../deposito";
import { MedioPagoRepository } from "../medioPago";
import { RolRepository } from "../rol";
import {
    createUserFolder,
    createKey,
    createCSR,
    readCSR,
    asegurarCSR,
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
    emailService: Pick<EmailService, "enviarBienvenida">;
    // Sólo escritura: crea el depósito principal del usuario en el mismo alta
    // (ver specs/008-movimientos-deposito).
    depositoRepository: Pick<DepositoRepository, "insert">;
    // Sólo escritura: crea los 5 medios de pago por defecto en el mismo alta
    // (ver specs/010-medios-pago).
    medioPagoRepository: Pick<MedioPagoRepository, "insertDefaults">;
    // Sólo escritura: crea los roles por defecto (autor, ilustrador) en el
    // mismo alta (ver specs/011-roles).
    rolRepository: Pick<RolRepository, "insertDefaults">;
};

export function createUserService({ db, repository, afipService, emailService, depositoRepository, medioPagoRepository, rolRepository }: UserServiceDeps) {
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

    // Compensación del alta: borra el usuario y sus clientes por defecto si
    // falla algún paso de filesystem/AFIP posterior a `createUser`.
    const remove = async (pk: { id: number }): Promise<void> => {
        await db.transaction(async (tx) => {
            await repository.removeDefaultClientes(pk.id, tx);
            await repository.removeUser(pk.id, tx);
        });
    };

    // Caso de uso completo del registro (antes vivía repartido en
    // user.controller.ts#create): valida unicidad de username/cuit, hashea
    // la password, resuelve los datos de AFIP, crea el usuario (+ clientes
    // por defecto) y genera su clave/CSR en el filesystem. Si el paso de
    // filesystem/AFIP falla, revierte el alta en Postgres (necesita el
    // try/catch para poder compensar la transacción ya confirmada).
    const register = async (body: CreateUserInput): Promise<User> => {
        if (await repository.existsByUsername(body.username)) {
            throw new ValidationError("Ya existe un usuario con este username");
        }
        if (await repository.existsByCuit(body.cuit)) {
            throw new ValidationError("Ya existe un usuario con este cuit");
        }

        const password = await bcrypt.hash(body.password, 10);
        const afipData = await afipService.getAfipData(body.cuit);

        const user = await createUser({
            ...body,
            password,
            ...afipData,
            production: false
        });

        try {
            await createUserFolder(user.cuit);
            await createKey(user.cuit);
            await createCSR(user);
        } catch (err) {
            await remove({ id: user.id });
            throw err;
        }

        await enviarBienvenida(user);

        return user;
    };

    // El alta ya está confirmada: si el mail no sale, se loguea y se sigue.
    // El CSR también se puede bajar desde el perfil.
    const enviarBienvenida = async (user: User): Promise<void> => {
        if (!user.email) return;

        await emailService
            .enviarBienvenida({ para: user.email, nombre: user.username, cuit: user.cuit, csr: await readCSR(user.cuit) })
            .catch((error: unknown) => console.error("[email] no se pudo enviar la bienvenida", { userId: user.id, error }));
    };

    // `changed` en `false` cuando no hay nada que actualizar (bradb tira si
    // `data` viene vacío): el controller decide con eso qué mensaje
    // devolver, sin tener que conocer la regla en sí.
    const update = async (id: number, data: UserUpdate): Promise<{ user: User; changed: boolean }> => {
        if (Object.keys(data).length === 0) {
            return { user: await repository.findOne({ id }), changed: false };
        }

        const updated = await repository.persistUpdate({ id }, data);
        return { user: repository.stripPassword(updated), changed: true };
    };

    const refreshAfipData = async (id: number): Promise<User> => {
        const current = await repository.findOne({ id });
        const afipData = await afipService.getAfipData(current.cuit);
        const updated = await repository.persistUpdate({ id }, afipData);

        return repository.stripPassword(updated);
    };

    const authenticate = async (username: string, password: string): Promise<User> => {
        const user = await repository.findByUsername(username);
        const hash = await repository.getPasswordHash(user.id);
        const match = await bcrypt.compare(password, hash);

        if (!match) throw new Unauthorized("Contraseña incorrecta");

        return user;
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
        register,
        update,
        refreshAfipData,
        authenticate,
        uploadCert,
        getEstadoFacturacion,
        getCSR,
        remove
    };
}

export type UserService = ReturnType<typeof createUserService>;
