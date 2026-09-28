import { Duplicated } from "bradb";
import { PersonaRepository } from "./persona.repository";
import { Persona, PersonaInsert, PersonaUpdate } from "./persona.validator";
import { Storage } from "../../lib/storage";
import { UnsupportedMediaType, PayloadTooLarge, UnprocessableEntity } from "../../lib/http/errors";
import { getImageSize } from "../../lib/image/imageSize";
import { UserRepository } from "../user";

// Sólo estos dos tipos de imagen (ver plan specs/004-persona-foto-bio).
const ALLOWED_FOTO_MIME: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png"
};

export type FotoFile = {
    buffer: Buffer;
    mimetype: string;
    size: number;
};

// Shape que efectivamente devuelve el service (y por lo tanto la API):
// `foto_key` (detalle de storage) nunca sale de este archivo.
export type PublicPersona = Omit<Persona, "foto_key"> & { foto_url: string | null };

export type PersonaServiceDeps = {
    repository: PersonaRepository;
    storage: Storage;
    // Sólo se necesita `findOne` para leer las restricciones de foto
    // configuradas por el usuario dueño de la persona.
    userRepository: Pick<UserRepository, "findOne">;
};

export function createPersonaService({ repository, storage, userRepository }: PersonaServiceDeps) {
    // Shape público de una persona: cambia `foto_key` (detalle de storage)
    // por `foto_url` (utilizable directo por el front), igual que
    // `libro.service.ts` con la portada.
    const toPublic = (persona: Persona): PublicPersona => {
        const { foto_key, ...rest } = persona;
        return { ...rest, foto_url: foto_key ? storage.getUrl(foto_key) : null };
    };
    const toPublicList = (personas: Persona[]): PublicPersona[] => personas.map(toPublic);

    // Regla de negocio (no puede haber dos personas con el mismo dni para
    // el mismo usuario): antes vivía en el controller, ahora es
    // responsabilidad del service, que es quien conoce la regla.
    const create = async (data: PersonaInsert & { user: number }) => {
        if (await repository.exists(data.dni, data.user)) {
            throw new Duplicated(`La persona con dni ${data.dni} ya se encuentra cargada`);
        }

        return toPublic(await repository.insert(data));
    };

    // Misma regla que `create`, pero sólo se chequea si el dni realmente
    // cambia (actualizar sin tocar el dni no puede chocar consigo misma).
    const update = async (pk: { id: number; user: number }, data: PersonaUpdate) => {
        const persona = await repository.findOne(pk);

        if (data.dni && data.dni !== persona.dni && (await repository.exists(data.dni, pk.user))) {
            throw new Duplicated(`La persona con dni ${data.dni} ya se encuentra cargada`);
        }

        return toPublic(await repository.update(pk, data));
    };

    // Compone `findOne` + `getLibros`: antes el controller hacía las dos
    // llamadas y las combinaba a mano, que es lógica que le corresponde al
    // service, no al adapter HTTP.
    const findOneWithLibros = async (pk: { id: number; user: number }) => {
        const persona = await repository.findOne(pk);
        const libros = await repository.getLibros(pk.id, pk.user);

        return { ...toPublic(persona), libros };
    };

    const findAll = async (
        userId: Parameters<PersonaRepository["findAll"]>[0],
        pagination: Parameters<PersonaRepository["findAll"]>[1]
    ) => toPublicList(await repository.findAll(userId, pagination));

    // Valida contra las restricciones configuradas por el usuario dueño de
    // la persona (specs/004-persona-foto-bio, tarea 6): tamaño máximo y
    // resolución mínima, cada una opcional e independiente.
    const assertFotoWithinLimits = async (userId: number, file: FotoFile) => {
        const user = await userRepository.findOne({ id: userId });

        const maxSizeBytes = user.foto_persona_max_size_mb ? user.foto_persona_max_size_mb * 1024 * 1024 : null;
        if (maxSizeBytes !== null && file.size > maxSizeBytes) {
            throw new PayloadTooLarge(`La foto no puede pesar más de ${user.foto_persona_max_size_mb} MB`);
        }

        const minAncho = user.foto_persona_min_ancho_px;
        const minAlto = user.foto_persona_min_alto_px;
        if (!minAncho && !minAlto) return;

        const size = getImageSize(file.buffer, file.mimetype);
        const cumpleAncho = !minAncho || (size && size.width >= minAncho);
        const cumpleAlto = !minAlto || (size && size.height >= minAlto);
        if (!size || !cumpleAncho || !cumpleAlto) {
            throw new UnprocessableEntity("La foto no cumple la resolución mínima requerida");
        }
    };

    // Subida/reemplazo de foto (ver plan specs/004-persona-foto-bio): valida
    // tipo/tamaño/resolución, escribe el archivo nuevo y recién después
    // borra el anterior, para no dejar la persona sin foto si `storage.write`
    // fallara.
    const uploadFoto = async (pk: { id: number; user: number }, file: FotoFile) => {
        const persona = await repository.findOne(pk);

        const extension = ALLOWED_FOTO_MIME[file.mimetype];
        if (!extension) {
            throw new UnsupportedMediaType("La foto debe ser una imagen JPG o PNG");
        }

        await assertFotoWithinLimits(pk.user, file);

        const key = `personas/fotos/${persona.id}-${Date.now()}.${extension}`;
        await storage.write(key, file.buffer);

        const updated = await repository.update(pk, { foto_key: key });

        if (persona.foto_key) {
            await storage.remove(persona.foto_key);
        }

        return toPublic(updated);
    };

    // Idempotente: quitar la foto de una persona que ya no tenía ninguna
    // sigue devolviendo 200 con `foto_url` en null (ver plan, tarea 7).
    const removeFoto = async (pk: { id: number; user: number }) => {
        const persona = await repository.findOne(pk);
        if (!persona.foto_key) return toPublic(persona);

        const updated = await repository.update(pk, { foto_key: null });
        await storage.remove(persona.foto_key);

        return toPublic(updated);
    };

    return {
        findOne: repository.findOne,
        findOneWithLibros,
        findAll,
        create,
        update,
        remove: repository.remove,
        getAllByTipo: repository.getAllByTipo,
        getLibros: repository.getLibros,
        uploadFoto,
        removeFoto
    };
}

export type PersonaService = ReturnType<typeof createPersonaService>;
