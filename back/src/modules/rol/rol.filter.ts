import { FilterMap } from "bradb";
import { eq } from "drizzle-orm";
import { rolesTable } from "./rol.schema";
import { rolValidator } from "./rol.validator";

export const rolFilterMap: FilterMap<typeof rolValidator.filter> = {
    user: (val) => eq(rolesTable.user, val)
};
