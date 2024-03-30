import { getAfipClient, getAfipData } from "../src/afip/Afip";
import Afip from "../src/afip/afip.js/src/Afip";
import { User } from "../src/models/user.model";

(async function main(){
    const cuitProd = "27249804024";
    const afip = new Afip({
        CUIT: cuitProd,
        ta_folder: `./src/afip/Claves/${cuitProd}Tokens/`,
        res_folder: `./src/afip/Claves/${cuitProd}/`,
        key: 'private_key.key',
        cert: 'FacturadorLibrosSilvestres_773cb8c416f11552.crt',
        //cert: 'cert.pem',
        production: true,
    });

    afip.ElectronicBilling?.getVoucherTypes().then(data => console.log(data));
})();
