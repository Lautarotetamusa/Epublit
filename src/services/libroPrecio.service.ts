import { and, desc, eq } from "drizzle-orm";
import { ServiceBuilder, FilterMap } from "bradb";
import { z } from "zod";
import { db } from "../pgDb";
import { precioLibrosTable } from "../schemas/precioLibros.schema";

// Sin filtros propios: `getByIsbn` resuelve su propio WHERE, pero
// `ServiceBuilder` exige un `FilterMap` en su constructor.
const emptyFilter = z.object({}).partial();
const emptyFilterMap: FilterMap<typeof emptyFilter> = {};

const builder = new ServiceBuilder(db, precioLibrosTable, emptyFilterMap);
const insert = builder.create();

const getByIsbn = async (isbn: string, userId: number) => {
    return db
        .select()
        .from(precioLibrosTable)
        .where(and(eq(precioLibrosTable.isbn, isbn), eq(precioLibrosTable.user, userId)))
        .orderBy(desc(precioLibrosTable.created_at));
};

export const libroPrecioService = {
    insert,
    getByIsbn
};
