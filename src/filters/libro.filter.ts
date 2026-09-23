import { FilterMap } from "bradb";
import { eq, ilike } from "drizzle-orm";
import { librosTable } from "../schemas/libros.schema";
import { libroValidator } from "../validators/libro.validator";

export const libroFilterMap: FilterMap<typeof libroValidator.filter> = {
    user: (val) => eq(librosTable.user, val),
    isbn: (val) => eq(librosTable.isbn, val),
    titulo: (val) => ilike(librosTable.titulo, `%${val}%`),
    precio: (val) => eq(librosTable.precio, val),
    stock: (val) => eq(librosTable.stock, val)
};
