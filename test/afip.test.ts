process.env.DB_NAME = "epublit_test";

import {test} from '@jest/globals';

import { createCSR, facturar, getAfipClient } from "../src/afip/Afip";
import { User } from '../src/models/user.model';
import { Venta } from '../src/models/venta.model';
import { Transaccion } from '../src/models/transaccion.model';
import { Cliente } from '../src/models/cliente.model';

//(1,'teti','$2b$10$VJTcN/./VCEOYQgnfCXebOItX9Ky/iz3nHOMvqOZNMW00BsOy5oz6','20434919798',' - ','LAUTARO TETA MUSA','URQUIZA 1159 Piso:4 Dpto:4 - ROSARIO NORTE SANTA FE',0,'',0,'01/10/2021', 9),
//(23,'admin','$2b$10$NKL/PmGA1aXGEfalHYGA7OVRUMxmveMeaAaop.eLEF/idptD/GdyO','27249804024','IVA EXENTO','MARIA CAROLINA MUSA','URQUIZA 1159 Piso:4 Dpto:4 - ROSARIO NORTE SANTA FE',1,'info@librosilvestres.com',1,'01/01/2021', NULL),
//(44,'martinpdisalvo','$2b$10$1qjXOsregmYZp7WoNFeBE.aFSXeZpSswcD2DSzPA5dMuUaVURgYgq','20173080329',' - ','CARLOS FABIAN GALASSI','FALCON 58 - SAN NICOLAS - BUENOS AIRES',0,'lauti@gmail.com',0,'01/11/2013', NULL);

/*!40000 ALTER TABLE `users` ENABLE KEYS */;
test("Crear CSR file", async () => {
    try {
        const user = await User.getById(44);
        createCSR(user);
    } catch(e) {
        expect(e).toBeNull();
    }
});

test("Facturar", async () => {
    try {
        const user = await User.getById(1);
        expect(user.punto_venta).not.toBeNull();

        const afip = getAfipClient(user).ElectronicBilling;
        expect(afip).not.toBeNull();
        if (afip === undefined) {
            return
        }

        // ventas id 5 => (1,247500,'mercadopago',11,38),
        // transaccion id 38 => (38,'2023-07-27 21:29:32',82,'NEGRO_2023_07_27_212932.pdf','venta',1),
        const venta = await Venta.getById(38); // id transaccion
        const transaction = await Transaccion.getById(38);
        const cliente = await Cliente.getById(transaction.id_cliente, user.id);

        const comprobante = await facturar((user.punto_venta || 1), venta, cliente, afip);
        //console.log(comprobante);
        expect(comprobante).not.toBeNull();

    } catch(e) {
        expect(e).toBeNull();
    }
}, 20000);
