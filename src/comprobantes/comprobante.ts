import fs from 'fs';
import puppeteer from 'puppeteer';
import { Venta } from '../models/venta.model';
import { Consignacion } from '../models/transaccion.model';
import { User } from '../models/user.model';
import { Cliente } from '../models/cliente.model';
import { Comprobante } from '../afip/Afip';
import { filesPath } from '../app';
import { join } from 'path';
import { tiposComprobantes } from '../schemas/venta.schema';
import { LibroTransaccion, Transaccion } from '../models/transaccion.model';

const path = './src/comprobantes';

type CreateFactura = {
    venta: Venta
    comprobante: Comprobante
    cliente: Cliente,
    libros: LibroTransaccion[] 
};

type CreateRemito = {
    consignacion: Transaccion,
    cliente: Cliente,
    libros: LibroTransaccion[]
};

type args = {
    data: CreateFactura | CreateRemito
    user: User,
} 
export async function emitirComprobante({data, user}: args){
    const tipo = 'venta' in data ? 'factura' : 'remito';

    const browser = await puppeteer.launch({
        executablePath: '/usr/bin/google-chrome',
        args: ['--no-sandbox'],
        headless: "new"
    });
    const page = await browser.newPage();

    let html    = fs.readFileSync(`${path}/${tipo}/${tipo}.html`, 'utf8');
    const css   = fs.readFileSync(`${path}/${tipo}/style.css`,    'utf8');
    html = html.replace('<style></style>', `<style>${css}</style>`);

    if (tipo == 'remito'){
        const logoPath = join(filesPath, `logos/${user.cuit}.png`);
        const haveLogo = fs.existsSync(logoPath);

        if (haveLogo){
            const logo = fs.readFileSync(logoPath, 'base64');
            html = html.replace('{{logo}}', `<img class="logo" src="data:image/jpeg;base64,${logo}">`);
            html = html.replace('{{name}}', "");
        }else{
            html = html.replace('{{logo}}', "");
            html = html.replace('{{name}}', `<span><h2>${user.username.toUpperCase()}<h2></span>`);
        }
    }

    html = html.replace(/\{\{user_razon_social\}\}/g, user.razon_social);
    html = html.replace(/\{\{user_cuit\}\}/g, user.cuit);

    if (user.ingresos_brutos){
        const initials = user.razon_social.split(' ').map(word => word.charAt(0).toUpperCase()).join('');
        html = html.replace('{{user_name_initials}}', initials);
        html = html.replace('{{user_cuit_iibb}}', user.cuit);
    }else{
        html = html.replace('{{user_name_initials}}', " - ");
        html = html.replace('{{user_cuit_iibb}}', "");
    }

    html = html.replace('{{user_activity_init_date}}', user.fecha_inicio); //dd/mm/yyyy
    html = html.replace('{{user_domicilio}}', user.domicilio);
    html = html.replace('{{user_cond_fiscal}}', user.cond_fiscal);
    html = html.replace('{{user_email}}', user.email);

    let filePath: string;
    if ('venta' in data){
        filePath = join(filesPath, Venta.filesFolder, data.venta.file_path);
        html = factura(html, data);
    }else{
        filePath = data.consignacion.file_path
        filePath = join(filesPath, Consignacion.filesFolder, data.consignacion.file_path);
        html = remito(html, data);
    }

    await page.setContent(html);
    await page.pdf({
        path: filePath,
        printBackground: true,
        format: 'A4',
    });

    await browser.close();
};

function factura(html: string, {venta, cliente, libros, comprobante}: CreateFactura){
    let table = '';
    console.log("generando factura");
    const logoAfip = fs.readFileSync(`${path}/factura/logoAfip.png`, 'base64');
    html = html.replace('{{logo}}', `<img class="logo" src="data:image/jpeg;base64,${logoAfip}">`);

    /*Parse venta.libros*/
    for (const libro of libros) {
        const bonif = venta.descuento * 0.01;
        const imp_bonif = (libro.precio * libro.cantidad * bonif).toFixed(2);
        const subtotal  = (libro.precio * libro.cantidad * (1 - bonif)).toFixed(2);

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

    html = html.replace('{{cond_venta}}', venta.medio_pago);

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
    html = html.replace('{{tipo_factura}}', tiposComprobantes[comprobante.CbteTipo as any as keyof typeof tiposComprobantes].cod);
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
    let table = '';

    for (const libro of libros) {
        table += 
            `<tr>
        <td>${libro.titulo}</td>
        <td> - </td>
        <td>${libro.isbn}</td>
        <td>${libro.cantidad}</td>
        <td>${libro.precio}</td>
        </tr>`;
    }

    html = html.replace('{{LIBROS}}', table);
    //TODO:
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
