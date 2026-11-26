import { FilterMap } from "bradb";
import { eq } from "drizzle-orm";
import { tiposEdicionTable } from "./tipoEdicion.schema";
import { tipoEdicionValidator } from "./tipoEdicion.validator";

export const tipoEdicionFilterMap: FilterMap<typeof tipoEdicionValidator.filter> = {
    user: (val) => eq(tiposEdicionTable.user, val)
};
