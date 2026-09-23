import { FilterMap } from "bradb";
import { z } from "zod";

// Sin filtros: no hay endpoint de listado (`User.getAll` es código muerto y
// no se migra), pero `ServiceBuilder` exige un `FilterMap` en su constructor.
const emptyFilter = z.object({}).partial();

export const userFilterMap: FilterMap<typeof emptyFilter> = {};
