import { FilterMap } from "bradb";
import { eq } from "drizzle-orm";
import { coleccionesTable } from "./coleccion.schema";
import { coleccionValidator } from "./coleccion.validator";

export const coleccionFilterMap: FilterMap<typeof coleccionValidator.filter> = {
    user: (val) => eq(coleccionesTable.user, val)
};
