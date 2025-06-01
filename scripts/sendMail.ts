import { argv, exit } from "process";
import { sendWelcomeEmail } from "../src/controllers/mail.controller";

import * as dotenv from 'dotenv';
import { join } from "path";
dotenv.config({path: join(__dirname, "../.env")});

const to: string = argv[2];
if (to == "" || to === undefined){
    console.log("missing to")
    exit(1)
}
console.log("enviando correo a", to);

// Mi cuit
sendWelcomeEmail(to, "20434919798").then(() => {
    console.log("correo enviado con exito")
}).catch(err => {
    console.log(err);
});
