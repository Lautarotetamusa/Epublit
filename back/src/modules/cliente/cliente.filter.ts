import { FilterMap } from "bradb";
import { eq } from "drizzle-orm";
import { clientesTable } from "./cliente.schema";
import { clienteValidator } from "./cliente.validator";

export const clienteFilterMap: FilterMap<typeof clienteValidator.filter> = {
    user: (val) => eq(clientesTable.user, val),
    tipo: (val) => eq(clientesTable.tipo, val)
};
