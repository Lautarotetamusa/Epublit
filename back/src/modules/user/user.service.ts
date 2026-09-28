import bcrypt from "bcrypt";
import { Database } from "../../db/client";
import { UserRepository } from "./user.repository";
import { UserInsert, UserUpdate, User, CreateUserInput } from "./user.validator";
import { Unauthorized } from "bradb";
import { ValidationError } from "../../lib/http/errors";
import {
    createUserFolder,
    createKey,
    createCSR,
    getCertPath,
    isValidCert,
    saveCert,
    removeCert,
    AfipService
} from "../../lib/afip/Afip";

export type UserServiceDeps = {
    db: Database;
    repository: UserRepository;
    afipService: AfipService;
};

export function createUserService({ db, repository, afipService }: UserServiceDeps) {
    // Alta completa del usuario y sus clientes por defecto (MOSTRADOR,
    // CONSUMIDOR FINAL) en una única transacción Postgres: la transacción
    // es responsabilidad del service, el repository sólo expone los
    // inserts crudos.
    const createUser = async (data: UserInsert): Promise<User> => {
        return db.transaction(async (tx) => {
            const user = await repository.insertUser(data, tx);
            await repository.insertDefaultClientes(user.id, tx);

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

        return user;
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

    const uploadCert = async (cuit: string, file: { buffer: Buffer; mimetype: string }): Promise<void> => {
        if (file.mimetype !== "application/x-x509-ca-cert") {
            throw new ValidationError("El tipo de archivo del certificado es invalido");
        }

        const certPath = getCertPath(cuit);
        await saveCert(certPath, file.buffer);

        const isValid = await isValidCert(certPath);
        if (!isValid) {
            await removeCert(certPath);
            throw new ValidationError("El certificado no es valido");
        }
    };

    return {
        findOne: repository.findOne,
        createUser,
        register,
        update,
        refreshAfipData,
        authenticate,
        uploadCert,
        remove
    };
}

export type UserService = ReturnType<typeof createUserService>;
