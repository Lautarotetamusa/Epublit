import { TokenUser } from "../src/schemas/user.schema";

declare global {
    namespace Express {
        interface Locals {
            user: TokenUser 
        }
    }
}
