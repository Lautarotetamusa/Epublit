import request from 'supertest';
import chai from 'chai';
import fs from 'fs';

process.env.DB_HOST = "localhost",
process.env.DB_USER = "teti",
process.env.DB_PASS = "Lautaro123.",
process.env.DB_NAME = "librossilvestres"
import {conn} from '../src/db.js'
import {expect_err_code, expect_success_code} from './util.js';
import { Venta } from '../src/models/venta.model.js';

const app = 'http://localhost:3001'
let token;

let cliente = {
    cuit: 30500007539,
    nombre: "ClienteTest",
    email: "clientetest@gmail.com",
    tipo: 1
}
let venta = {
    libros: [],
    medio_pago: Venta.str_medios_pago.length+1,
    descuento: 10
}

/*
    - Crear un cliente nuevo
    - Seleccionar 3 libros de la pagina 5 de libros /libros?page=5
    - Setear el stock de esos 3 libros en 3
    - Chequear errores de bad request
    - Realizar la venta
    - Revisar que los 3 libros tenga ahora stock 0
    - Revisar que la factura haya sido emitida (que exista el archivo)
    - Revisar que el total de la venta sea correcto
    - Revisar que el cliente tenga la venta en /cliente/{id}/ventas
*/

it('login', async () => {
    let data = {
        username: 'teti',
        password: '$2b$10$CJ4a/b08JS9EfyvWKht6QOSRKuT4kb2CUvkRwEIzwdCuOmFyrYTdK'
    }
    const res = await request(app)
        .post('/user/login')
        .send(data)

    expect_success_code(200, res);
    token = res.body.token;
});

describe('VENTA', () => {
    it('delete cliente', async () => {
        /*Buscar los ids de los datos cargados*/
        let _cliente = (await conn.query(`
            SELECT id FROM clientes
            WHERE cuit=${cliente.cuit}`
        ))[0];

        if (_cliente.length == 0)
            return;

        let id_cliente = _cliente[0].id;
        console.log("id cliente: ", id_cliente);

        let venta = (await conn.query(`
            SELECT id FROM ventas
            WHERE id_cliente=${id_cliente};
        `))[0];

        if(venta.length == 0){
            await conn.query(`
                DELETE FROM clientes
                WHERE id=${id_cliente};
            `);
            return;
        }

        let id_venta = venta[0].id;

        /*Borrar de la base de datos*/
        await conn.query(`
            DELETE FROM libros_ventas
            WHERE id_venta=${id_venta};
        `);

        await conn.query(`
            DELETE FROM ventas
            WHERE id_cliente=${id_cliente};
        `);

        await conn.query(`
            DELETE FROM clientes
            WHERE id=${id_cliente};
        `);
    });

    describe('Cargar datos para la venta', () => {
        it('Crear nuevo cliente', async () => {
            const res = await request(app)
                .post('/cliente/')
                .set('Authorization', `Bearer ${token}`)
                .send(cliente);

            //console.log(res.body);

            expect_success_code(201, res);

            cliente.id = res.body.data.id;
            venta.cliente = cliente.id;
        });

        /*it('Buscar cliente', async () => {
            const res = await request(app)
                .get('/cliente/4')
                .set('Authorization', `Bearer ${token}`);

            chai.expect(res.status).to.equal(200);

            cliente = res.body;
            venta.cliente = cliente.id;
        });*/

        it('Seleccionar libros para la venta', async () => {
            const res = await request(app)
                .get('/libro')
                .set('Authorization', `Bearer ${token}`);

            chai.expect(res.status).to.equal(200);
            venta.libros = [ res.body[3], res.body[5], res.body[8] ];
            //console.log("VENTA:", venta);
        });

        it('Agregar stock a los libros', async () => {

            let stock = 3;
            
            for (const libro of venta.libros) {
                let res = await request(app)
                    .put(`/libro/${libro.isbn}`)
                    .set('Authorization', `Bearer ${token}`)
                    .send({
                        stock: 0
                    });

                res = await request(app)
                    .put(`/libro/${libro.isbn}`)
                    .set('Authorization', `Bearer ${token}`)
                    .send({
                        stock: stock
                    });

                libro.cantidad = stock;

                expect_success_code(201, res);
            }

            for (const libro of venta.libros) {
                const res = await request(app)
                    .get(`/libro/${libro.isbn}`)
                    .set('Authorization', `Bearer ${token}`);

                chai.expect(res.status).to.equal(200);

                chai.expect(res.body.stock).to.equal(stock);
            }    
        });
    });

    describe('POST /venta', () => {
        describe('Bad request', () => {
            it('Venta no tiene cliente', async () => {
                let aux_cliente = venta.cliente;
                delete venta.cliente;

                const res = await request(app)
                    .post('/venta/')
                    .set('Authorization', `Bearer ${token}`)
                    .send(venta);
                expect_err_code(400, res);

                venta.cliente = aux_cliente;
            });
            it('Medio de pago incorrecto', async () => {
                const res = await request(app)
                    .post('/venta/')
                    .set('Authorization', `Bearer ${token}`)
                    .send(venta);
                expect_err_code(400, res);
        
                venta.medio_pago = 0;
            });
            it('Un libro no tiene suficiente stock', async () => {
                venta.libros[2].cantidad = 5;

                const res = await request(app)
                    .post('/venta/')
                    .set('Authorization', `Bearer ${token}`)
                    .send(venta);
                expect_err_code(400, res);

                venta.libros[2].cantidad = 3;
            });
        });
        describe('Venta exitosa', () => {
            it('vender', async () => {
                const res = await request(app)
                    .post('/venta/')
                    .set('Authorization', `Bearer ${token}`)
                    .send(venta);

                expect_success_code(201, res);

                //console.log("data:", res.body);
                venta.id = res.body.id;
                venta.file_path = res.body.path;
                //console.log("VENTA:", venta);
            });
            
            it('Los libros reducieron su stock', async () => {
                for (const libro of venta.libros) {
                    const res = await request(app)
                        .get(`/libro/${libro.isbn}`)
                        .set('Authorization', `Bearer ${token}`);
        
                    chai.expect(res.status).to.equal(200);
                    chai.expect(res.body.stock).to.equal(0);
                }
            });
            it('El cliente tiene la venta cargada', async () => {
                
                const res = await request(app)
                    .get(`/cliente/${cliente.id}/ventas/`)
                    .set('Authorization', `Bearer ${token}`);
            
                chai.expect(res.status).to.equal(200);
                chai.expect(res.body[0]).to.exist;
            });
            it('El total de la venta está bien', async () => {
                let total = 0;
                for (const libro of venta.libros) {
                    total += libro.cantidad * libro.precio;
                }
                total -= total * venta.descuento * 0.01;
                total = parseFloat(total.toFixed(2));
                
                const res = await request(app)
                    .get(`/cliente/${cliente.id}/ventas/`)
                    .set('Authorization', `Bearer ${token}`);
            
                chai.expect(res.status).to.equal(200);
                let venta_aux = res.body[0];

                chai.expect(venta_aux.total).to.equal(total);
            });
            it('La factura existe y el nombre coincide', async () => {   
                await delay(400);         
                fs.readFile(`../facturas/${venta.file_path}`, 'utf8', (err, data) => {
                    if(err){
                        console.error(err);
                    }
                    chai.expect(err).to.not.exist;
                });
            });
            it('Se puede descargar la factura', async () => {
                await delay(400);
                //console.log("VENTA:", venta);
                //console.log(`/venta/${venta.id}/factura`); 

                const res = await request(app)
                    .get(`/venta/${venta.id}/factura`)
                    .set('Authorization', `Bearer ${token}`); 

                chai.expect(res.status).to.equal(200);
            });
        });
    });
});

function delay(time) {
    return new Promise(resolve => setTimeout(resolve, time));
  } 