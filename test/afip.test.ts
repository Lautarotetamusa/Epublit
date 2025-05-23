process.env.DB_NAME = "epublit_test";

import {test} from '@jest/globals';

import { facturar, getAfipClient } from "../src/afip/Afip";
import { User } from '../src/models/user.model';
import { Venta } from '../src/models/venta.model';
import { Transaccion } from '../src/models/transaccion.model';
import { Cliente } from '../src/models/cliente.model';

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
