import { FilterMap } from "bradb";
import { eq } from "drizzle-orm";
import { depositosTable } from "./deposito.schema";
import { depositoValidator } from "./deposito.validator";

export const depositoFilterMap: FilterMap<typeof depositoValidator.filter> = {
    user: (val) => eq(depositosTable.user, val)
};
