import { FilterMap } from "bradb";
import { eq } from "drizzle-orm";
import { mediosPagoTable } from "./medioPago.schema";
import { medioPagoValidator } from "./medioPago.validator";

export const medioPagoFilterMap: FilterMap<typeof medioPagoValidator.filter> = {
    user: (val) => eq(mediosPagoTable.user, val)
};
