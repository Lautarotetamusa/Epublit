import fs from 'fs';
import puppeteer from 'puppeteer';
import { LibroVenta, Venta } from '../models/venta.model';
import { Consignacion, LibroConsignacion } from '../models/consignacion.model';
import { medioPago } from '../schemas/venta.schema';
import { User } from '../models/user.model';
import { Cliente } from '../models/cliente.model';
import { Comprobante } from '../afip/Afip';

const path = './src/comprobantes';

type CreateFactura = {
    venta: Venta
    comprobante: Comprobante
    cliente: Cliente,
    libros: LibroVenta[] 
};

type CreateRemito = {
    consignacion: Consignacion,
    cliente: Cliente,
    libros: LibroConsignacion[]
};

type args = {
    data: CreateFactura | CreateRemito
    user: User,
} 
export async function emitirComprobante({data, user}: args){
    const tipo = 'venta' in data ? 'factura' : 'remito';

    const browser = await puppeteer.launch({
      executablePath: '/usr/bin/google-chrome',
      args: ['--no-sandbox']
    });
    const page = await browser.newPage();
  
    var html = fs.readFileSync(`${path}/${tipo}/${tipo}.html`, 'utf8');
    var css  = fs.readFileSync(`${path}/${tipo}/style.css`,    'utf8');
    var logo = fs.readFileSync(`${path}/${tipo}/Logo.png`,   'base64');
    
    html = html.replace('<style></style>', `<style>${css}</style>`);
    html = html.replace('{{logo}}', `<img class="logo" src="data:image/jpeg;base64,${logo}">`);

    html = html.replace(/\{\{user_razon_social\}\}/g, user.razon_social);
    html = html.replace('{{user_domicilio}}', user.domicilio);
    html = html.replace('{{user_cond_fiscal}}', user.cond_fiscal);
    html = html.replace('{{user_cuit}}', user.cuit);

    let filePath: string;
    if ('venta' in data){
        filePath = data.venta.file_path
        factura(html, data);
    }else{
        filePath = data.consignacion.remito_path
        remito(html, data);
    }
    
    await page.setContent(html);
    const pdf = await page.pdf({
      path: tipo+"s/"+filePath,
      printBackground: true,
      format: 'A4',
    });
  
    await browser.close();
};

function factura(html: string, {venta, cliente, libros, comprobante}: CreateFactura){
    /*Parse venta.libros*/
    var table = '';
    console.log("generando factura");

    for (let libro of libros) {
        let bonif = venta.descuento * 0.01;
        let imp_bonif = (libro.precio * libro.cantidad * bonif).toFixed(2);
        let subtotal  = (libro.precio * libro.cantidad * (1 - bonif)).toFixed(2);

        table += 
            `<tr>
            <td style="text-align:left">${libro.isbn}</td>
            <td style="text-align:left">${libro.titulo}</td>
            <td>${libro.cantidad}</td>
            <td>${libro.precio}</td>
            <td>${venta.descuento}</td>
            <td>${imp_bonif}</td>
            <td>${subtotal}</td>
            </tr>`;
    }
    html = html.replace('{{LIBROS}}', table); 
    /**/

    html = html.replace('{{cond_venta}}', String(medioPago[venta.medio_pago]));

    //QR
    html = html.replace('<img class="qr" src="">', `<img class="qr" src="${comprobante.qr}">`)

    html = html.replace(/\{\{TOTAL\}\}/g, String(venta.total));
    
    /*parse clientes*/
    html = html.replace('{{cliente_cond}}', cliente.cond_fiscal);
    html = html.replace('{{cliente_cuit}}', cliente.cuit);
    html = html.replace('{{cliente_nombre}}', cliente.razon_social);
    html = html.replace('{{cliente_domicilio}}', cliente.domicilio);
    /**/

    /*parse comprobante*/
    html = html.replace('{{tipo_factura}}', 'C');
    html = html.replace('{{cod_factura}}', comprobante.CbteTipo);
    html = html.replace('{{punto_venta}}', String(comprobante.PtoVta).padStart(5, '0'));
    html = html.replace('{{cae}}', comprobante.CodAutorizacion);
    html = html.replace('{{fecha_vto}}', comprobante.FchVto);
    html = html.replace('{{fecha_emision}}', comprobante.CbteFch);
    html = html.replace('{{nro_comprobante}}', String(comprobante.nro).padStart(8, '0'));
    /**/
    return html;
}

function remito(html: string, {consignacion, cliente, libros}: CreateRemito){
    //parse libros
    var table = '';

    for (let libro of libros) {
        if (libro.autores.length > 0){
            table += 
                `<tr>
                <td>${libro.titulo}</td>
                <td>${libro.autores[0].nombre}</td>
                <td>${libro.isbn}</td>
                <td>${libro.cantidad}</td>
                <td>${libro.precio}</td>
                </tr>`;
        }else{
            table += 
                `<tr>
                <td>${libro.titulo}</td>
                <td> - </td>
                <td>${libro.isbn}</td>
                <td>${libro.cantidad}</td>
                <td>${libro.precio}</td>
                </tr>`;
        }   
    }

    html = html.replace('{{LIBROS}}', table);
    //El 0003 es un numero igual para todos los remitos, esto obviamente habría que cambiarlo en un futuro para que no este hardescrito
    html = html.replace('{{remito.nro}}', '0003/'+String(consignacion.id).padStart(5, '0'));
    
    //parse_clientes
    html = html.replace('{{cliente.cuit}}', cliente.cuit);
    html = html.replace('{{cliente.razon_social}}', cliente.razon_social);
    html = html.replace('{{cliente.domicilio}}', cliente.domicilio);
    //
    const date = new Date().toISOString().
      replace(/T/, ' '). 
      replace(/\..+/, '');
    html = html.replace("{{fecha}}", date);
    //
    return html;
}
