import { getAfipClient, getAfipData } from "../src/afip/Afip";
import Afip from "../src/afip/afip.js/src/Afip";
import {afip_madre} from "../src/afip/Afip";
import { User } from "../src/models/user.model";

let cuit = "20434919798";

(async function main(){
    const user = await User.getOne("teti");
    const afip = getAfipClient(user);

    afip.ElectronicBilling?.getVoucherTypes().then(data => console.log(data));
})();
