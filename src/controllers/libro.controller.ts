import { Request, Response } from "express";
import fs from "fs";

import { libroService } from "../services/libro.service";
import { libroValidator } from "../validators/libro.validator";
import { Duplicated } from "../models/errors";

const create = async (req: Request, res: Response) => {
    const userId = res.locals.user.id;
    const libroBody = libroValidator.insert.parse(req.body);

    if (await libroService.exists(libroBody.isbn, userId)) {
        throw new Duplicated(`El libro con isbn ${libroBody.isbn} ya existe`);
    }

    const libro = await libroService.create(libroBody, userId);

    return res.status(201).json({
        success: true,
        message: `Libro con isbn ${libroBody.isbn} creado correctamente`,
        data: libro
    });
};

const update = async (req: Request, res: Response) => {
    const isbn = String(req.params.isbn);
    const userId = res.locals.user.id;
    const body = libroValidator.update.parse(req.body);

    const libro = await libroService.update(isbn, userId, body);

    return res.status(201).json({
        success: true,
        message: `Libro con isbn ${isbn} actualizado correctamente`,
        data: libro
    });
};

const remove = async (req: Request, res: Response) => {
    const isbn = String(req.params.isbn);
    await libroService.remove(isbn, res.locals.user.id);

    return res.json({
        success: true,
        message: `Libro con isbn ${isbn} eliminado correctamente`
    });
};

const getPrecios = async (req: Request, res: Response) => {
    const precios = await libroService.getPrecios(String(req.params.isbn), res.locals.user.id);
    return res.json(precios);
};

const getOne = async (req: Request, res: Response) => {
    const isbn = String(req.params.isbn);
    const userId = res.locals.user.id;

    const libro = await libroService.findOne(isbn, userId);
    const { autores, ilustradores } = await libroService.getPersonas(isbn, userId);

    return res.json({
        ...libro,
        autores,
        ilustradores
    });
};

const listaLibros = async (req: Request, res: Response) => {
    const libros = await libroService.findAllFiltered({ user: res.locals.user.id });

    const len = Object.keys(libros[0]).length;
    const header = "LISTA DE LIBROS" + ",".repeat(len) + "\r\n";
    const headers = Object.keys(libros[0]).join(",") + "\r\n";
    const data = libros.map((l) => Object.values(l).join(",")).join("\r\n");

    const filePath = "lista_libros.csv";
    fs.writeFileSync(filePath, header + headers + data);
    return res.download(filePath);
};

const getAll = async (req: Request, res: Response) => {
    const userId = res.locals.user.id;

    if ("page" in req.query) {
        const libros = await libroService.findAllPaginated(userId, Number(req.query.page) || 0);
        return res.json(libros);
    }

    const filters = libroValidator.filter.parse({ ...req.query, user: userId });
    const libros = await libroService.findAllFiltered(filters);
    return res.json(libros);
};

export default {
    getAll,
    getOne,
    getPrecios,
    create,
    remove,
    update,
    listaLibros
};
