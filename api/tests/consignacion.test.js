import request from 'supertest';
import chai from 'chai';
import fs from 'fs';

import {conn} from '../src/db.js'
import {expect_err_code, expect_success_code} from './util.js';

const app = 'http://localhost:3001'

let cliente = {
    cuit: 20442317632,
    nombre: "ClienteTest",
    email: "clientetest@gmail.com",
    tipo: 1
}
let consignacion = {
    libros: []
}
/*
    - Crear un cliente nuevo
    - Seleccionar 3 libros de la pagina 5 de libros /libros?page=5
    - Setear el stock de esos 3 libros en 3
    - Chequear errores de bad request
    - Realizar la consignacion
    - Revisar que los 3 libros tenga ahora stock 0
    - Revisar que la factura haya sido emitida (que exista el archivo)
    - Revisar que el total de la consignacion sea correcto
    - Revisar que el cliente tenga la consignacion en /cliente/{id}/consignacions
*/

describe('CONSIGNACION', () => {
    before('delete cliente', async () => {
        let res = (await conn.query(`
            SELECT id FROM clientes
            WHERE cuit=${cliente.cuit}`
        ))[0][0];

        /*Buscar los ids de los datos cargados*/
        if ('id' in res){
            let id_cliente = res.id;

            res = (await conn.query(`
                SELECT id FROM consignaciones
                WHERE id_cliente=${id_cliente};
            `))[0][0];

            if (res){
                let id_consignacion = res.id;
                await conn.query(`
                    DELETE FROM libros_consignaciones
                    WHERE id_consignacion=${id_consignacion};
                `);
            }

            /*Borrar de la base de datos*/
            await conn.query(`
                DELETE FROM stock_cliente
                WHERE id_cliente=${id_cliente};
            `);

            await conn.query(`
                DELETE FROM consignaciones
                WHERE id_cliente=${id_cliente};
            `);
            await conn.query(`
                DELETE FROM clientes
                WHERE id=${id_cliente};
            `);
        }else {
            await conn.query(`
                DELETE FROM clientes
                WHERE cuit=${cliente.cuit};
            `);
        }
        
    });

    describe('Cargar datos para la consignacion', () => {
        it('Crear nuevo cliente', async () => {
            const res = await request(app)
                .post('/cliente/')
                .send(cliente);

            expect_success_code(201, res);

            cliente.id = res.body.data.id;
            consignacion.cliente = cliente.id;
        });

        it('Seleccionar libros para la consignacion', async () => {
            let isbn_libros = ["9876543217", "98765432176", "97898712345"];            
            for (const isbn of isbn_libros) {
                let res = await request(app).get(`/libro/${isbn}`);
                chai.expect(res.status).to.equal(200);
                consignacion.libros.push(res.body);
            }
        });

        it('Agregar stock a los libros', async () => {

            let stock = 3;
            
            for (const libro of consignacion.libros) {
                let res = await request(app).put(`/libro/${libro.isbn}`)
                    .send({
                        stock: 0
                    });

                res = await request(app).put(`/libro/${libro.isbn}`)
                    .send({
                        stock: stock
                    });

                libro.cantidad = stock;

                expect_success_code(201, res);
            }

            for (const libro of consignacion.libros) {
                const res = await request(app).get(`/libro/${libro.isbn}`);

                chai.expect(res.status).to.equal(200);

                chai.expect(res.body.stock).to.equal(stock);
            }    
        });
    });

    describe('POST /consignacion', () => {
        describe('Bad request', () => {
            it('Consignacion no tiene cliente', async () => {
                let aux_cliente = consignacion.cliente;
                delete consignacion.cliente;

                const res = await request(app).post('/consignacion/').send(consignacion);
                expect_err_code(404, res);

                consignacion.cliente = aux_cliente;
            });
            it('Un libro no tiene suficiente stock', async () => {
                consignacion.libros[2].cantidad = 5;

                const res = await request(app).post('/consignacion/').send(consignacion);
                expect_err_code(400, res);

                consignacion.libros[2].cantidad = 3;
            });
        });

        describe('consignacion exitosa', () => {
            it('Consignar', async () => {
                const res = await request(app).post('/consignacion/').send(consignacion);
            
                expect_success_code(201, res);

                consignacion = res.body;
            });
            it('Los libros reducieron su stock', async () => {
                for (const libro of consignacion.libros) {
                    const res = await request(app).get(`/libro/${libro.isbn}`);
        
                    chai.expect(res.status).to.equal(200);
                    chai.expect(res.body.stock).to.equal(0);
                }
            });
            it('El cliente tiene el stock cargado', async () => {
                
                const res = await request(app).get(`/cliente/${cliente.id}/stock/`);
                chai.expect(res.status).to.equal(200);

                for (const libro of res.body) {
                    chai.expect(libro.stock).to.equal(3);
                }
            
            });
            it('El remito existe y el nombre coincide', async () => {       
                //console.log("consignacion:", consignacion);
                //await delay(250);         
                fs.readFile(`remitos/${consignacion.path}`, 'utf8', (err, data) => {
                    if(err){
                        console.error(err);
                    }
                    chai.expect(err).to.not.exist;
                });
            });
        });
    });
});

function delay(time) {
    return new Promise(resolve => setTimeout(resolve, time));
  }