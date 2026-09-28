import { TokenUser } from "../modules/user/user.validator";

declare global {
    namespace Express {
        interface Locals {
            user: TokenUser 
        }
    }
}
