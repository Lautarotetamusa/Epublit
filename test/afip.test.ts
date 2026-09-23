process.env.DB_NAME = "epublit_test";

import {test, expect, vi} from 'vitest';
import request from "supertest";
import { inArray } from 'drizzle-orm';

vi.mock('../src/afip/afip.js/src/Class/ElectronicBilling', () => {
    return vi.fn().mockImplementation(() => ({
        createNextVoucher: vi.fn().mockResolvedValue({
          CAE: '123456789',
          CAEFchVto: '20250201',
          voucherNumber: "1001",
        }),
        getVoucherInfo: vi.fn().mockResolvedValue({
            nro: "1001",
            qr: "",
            CbteTipo: "1",
            PtoVta: "1",
            CodAutorizacion: "qwert12345",
            FchVto: "20250222",
            CbteFch: "20250222",
      })
    }))
});
vi.mock('../src/comprobantes/comprobante', () => ({
    emitirComprobante: vi.fn().mockResolvedValue(undefined)
}));

import { app, server } from '../src/app';
import { conn } from '../src/db';
import { db } from '../src/pgDb';
import { librosTable } from '../src/schemas/libros.schema';
import { facturar, getAfipClient } from "../src/afip/Afip";
import { userService } from '../src/services/user.service';
import { ventaService } from '../src/services/venta.service';
import { transaccionService } from '../src/services/transaccion.service';
import { clienteService } from '../src/services/cliente.service';

const isbn = "9300000000001";

afterAll(async () => {
    await db.delete(librosTable).where(inArray(librosTable.isbn, [isbn]));
    conn.end();
    server.close();
});

test("Facturar", async () => {
    const login = await request(app).post('/user/login').send({ username: 'teti', password: 'Lautaro123.' });
    expect(login.status).toBe(200);
    const token = login.body.token;

    const user = await userService.findOne({id: 1});
    expect(user.punto_venta).not.toBeNull();

    const afip = getAfipClient(user).ElectronicBilling;
    expect(afip).not.toBeNull();
    if (afip === undefined) {
        return;
    }

    const resLibro = await request(app)
        .post('/libro/')
        .set('Authorization', `Bearer ${token}`)
        .send({ isbn, titulo: 'Test afip', fecha_edicion: '2020-01-01', precio: 1000, stock: 5 });
    expect(resLibro.status).toBe(201);

    const resClientes = await request(app).get('/cliente?tipo=particular').set('Authorization', `Bearer ${token}`);
    const cliente = resClientes.body[0];

    const resVenta = await request(app)
        .post('/venta/')
        .set('Authorization', `Bearer ${token}`)
        .send({ cliente: cliente.id, medio_pago: 'efectivo', tipo_cbte: 11, libros: [{ isbn, cantidad: 1 }] });
    expect(resVenta.status).toBe(201);
    const id = resVenta.body.data.id;

    // Reemplaza `Venta.getById`/`Transaccion.getById`/`User.getById` (MySQL)
    // por sus equivalentes Postgres (ver plan, "Capas afectadas").
    const venta = await ventaService.getById(id, user.id);
    const transaction = await transaccionService.getById(id, user.id);
    const clienteRow = await clienteService.findOne({id: transaction.id_cliente, user: user.id});

    const comprobante = await facturar((user.punto_venta || 1), venta, clienteRow, afip);
    expect(comprobante).not.toBeNull();
}, 20000);
