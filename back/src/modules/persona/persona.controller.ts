import { RequestHandler } from "express"
import { newPagination } from "bradb";
import { personaValidator } from "./persona.validator";
import { libroPersonaSchema } from "../libro/libroPersona.validator";
import { PersonaService } from "./persona.service";
import { created, ok, updated, deleted, list } from "../../lib/http/responses";
import { ValidationError } from "../../lib/http/errors";

// El controller sólo adapta HTTP: parsea/valida con zod, le pasa los datos
// al service y elige qué helper de respuesta usar. Las reglas de negocio
// (ej. no duplicar dni) viven en persona.service.ts.
export type PersonaControllerDeps = {
    service: PersonaService;
};

export function createPersonaController({ service }: PersonaControllerDeps) {
    const create: RequestHandler = async (req, res) => {
        const body = personaValidator.insert.parse(req.body);
        const userId = res.locals.user.id;

        const persona = await service.create({
            ...body,
            user: userId
        });

        created(res, persona, "Persona creada correctamente");
    }

    const update: RequestHandler = async (req, res) => {
        const {id} = personaValidator.pk.parse(req.params);
        const userId = res.locals.user.id;
        const body = personaValidator.update.parse(req.body);

        const persistedPersona = await service.update({id, user: userId}, body);

        // Antes devolvía 201 (heredado del endpoint viejo, no un alta
        // real). `updated()` estandariza en 200, que es lo correcto para
        // un PUT — cambia el status code respecto al de antes.
        updated(res, persistedPersona, "Persona actualizada correctamente");
    }

    const remove: RequestHandler = async (req, res) => {
        const {id} = personaValidator.pk.parse(req.params);
        const userId = res.locals.user.id;

        await service.remove({id, user: userId});

        deleted(res, `Persona con id ${id} eliminada correctamente`);
    }

    const getAll: RequestHandler = async (req, res) => {
        const userId = res.locals.user.id;
        const pagination = newPagination(req.query);

        const personas = 'tipo' in req.query
            ? await service.getAllByTipo(libroPersonaSchema.shape.tipo.parse(req.query.tipo), userId, pagination)
            : await service.findAll(userId, pagination);

        list(res, personas, pagination);
    }

    const getOne: RequestHandler = async (req, res) => {
        const {id} = personaValidator.pk.parse(req.params);
        const userId = res.locals.user.id;

        const persona = await service.findOneWithLibros({id, user: userId});

        ok(res, persona);
    }

    // Multipart de un único archivo (ver persona.routes.ts, `upload.single`):
    // las reglas de tipo/tamaño/resolución viven en el service, acá sólo se
    // valida que haya llegado algún archivo.
    const uploadFoto: RequestHandler = async (req, res) => {
        if (!req.file) throw new ValidationError("El campo 'foto' es necesario");

        const { id } = personaValidator.pk.parse(req.params);
        const userId = res.locals.user.id;

        const persona = await service.uploadFoto({ id, user: userId }, req.file);

        ok(res, persona, `Foto de la persona con id ${id} actualizada correctamente`);
    }

    const removeFoto: RequestHandler = async (req, res) => {
        const { id } = personaValidator.pk.parse(req.params);
        const userId = res.locals.user.id;

        const persona = await service.removeFoto({ id, user: userId });

        ok(res, persona, `Foto de la persona con id ${id} eliminada correctamente`);
    }

    return {
        create,
        update,
        remove,
        getAll,
        getOne,
        uploadFoto,
        removeFoto
    };
}

export type PersonaController = ReturnType<typeof createPersonaController>;
