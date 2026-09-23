import { Request, Response } from "express"
import { personaService } from "../services/persona.service";
import { Duplicated } from '../models/errors';
import { personaValidator } from "../validators/persona.validator";
import { libroPersonaSchema } from "../validators/libro_persona.validator";

const create = async (req: Request, res: Response): Promise<Response> => {
    const body = personaValidator.insert.parse(req.body);
    const userId = res.locals.user.id;

    if (await personaService.exists(body.dni, userId)){
        throw new Duplicated(`La persona con dni ${body.dni} ya se encuentra cargada`);
    }

    const persona = await personaService.create({
        ...body,
        user: userId
    });

    return res.status(201).json({
        success: true,
        message: "Persona creada correctamente",
        data: persona
    });
}

const update = async (req: Request, res: Response): Promise<Response> => {
    const {id} = personaValidator.pk.parse(req.params);
    const userId = res.locals.user.id;

    const body = personaValidator.update.parse(req.body);

    const persona = await personaService.findOne({id, user: userId});

    if (body.dni && body.dni != persona.dni && await personaService.exists(body.dni, userId)){
        throw new Duplicated(`La persona con id ${body.dni} ya se encuentra cargada`);
    }

    const updated = await personaService.update({id, user: userId}, body);

    return res.status(201).json({
        success: true,
        message: "Persona actualizada correctamente",
        data: updated
    });
}

const remove = async (req: Request, res: Response): Promise<Response> => {
    const {id} = personaValidator.pk.parse(req.params);
    const userId = res.locals.user.id;

    // La PK compuesta (id, user) hace que esto tire NotFound si la persona
    // no existe o es de otro usuario, sin necesidad de un chequeo aparte.
    await personaService.remove({id, user: userId});

    return res.json({
        success: true,
        message: `Persona con id ${id} eliminada correctamente`
    });
}

const getAll = async (req: Request, res: Response): Promise<Response>  => {
    const userId = res.locals.user.id;

    if ('tipo' in req.query){
        const tipo = libroPersonaSchema.shape.tipo.parse(req.query.tipo);
        const personas = await personaService.getAllByTipo(tipo, userId);
        return res.json(personas);
    }

    const personas = await personaService.findAll(userId);
    return res.json(personas);
}

const getOne = async (req: Request, res: Response): Promise<Response> => {
    const {id} = personaValidator.pk.parse(req.params);
    const userId = res.locals.user.id;

    const persona = await personaService.findOne({id, user: userId});
    const libros = await personaService.getLibros(id, userId);

    return res.json({
        ...persona,
        libros: libros
    });
}

export default {
    create,
    update,
    remove,
    getAll,
    getOne
}
