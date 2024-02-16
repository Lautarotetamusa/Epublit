import fs from 'fs';
import puppeteer from 'puppeteer';
import { Venta } from '../models/venta.model';
import { Consignacion } from '../models/consignacion.model';
import { medio_pago } from '../schemas/venta.schema';
import { User } from '../models/user.model';

const path = './src/comprobantes';

type args = {
    data: Venta & {qr_data: string, comprobante: any},
    user: User,
    tipo: "factura"
} | {
    data: Consignacion,
    user: User,
    tipo: "remito"
}

export async function emitir_comprobante({data, user, tipo}: args){
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

    if (tipo == "factura"){
        html = factura(html, data);
    }else if(data instanceof Consignacion){
        html = remito(html, data);
    }
    
    await page.setContent(html);
  
    if (data instanceof Consignacion){
        console.log(tipo+"s/"+data.remito_path);
        const pdf = await page.pdf({
          path: tipo+"s/"+data.remito_path,
          printBackground: true,
          format: 'A4',
        });
    }else{
        console.log(tipo+"s/"+data.file_path);
        const pdf = await page.pdf({
          path: tipo+"s/"+data.file_path,
          printBackground: true,
          format: 'A4',
        });
    }
  
    // Close the browser instance
    await browser.close();
  
    console.log(tipo+" generado correctamente");
  };

function factura(html: string, venta: Venta & {qr_data: string, comprobante: any}){
    /*Parse venta.libros*/
    var table = '';
    console.log("generando factura");

    for (let libro of venta.libros) {
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

    html = html.replace('{{cond_venta}}', String(medio_pago[venta.medio_pago]));

    //QR
    html = html.replace('<img class="qr" src="">', `<img class="qr" src="${venta.qr_data}">`)

    html = html.replace(/\{\{TOTAL\}\}/g, String(venta.total));
    
    /*parse clientes*/
    html = html.replace('{{cliente_cond}}', venta.cliente.cond_fiscal);
    html = html.replace('{{cliente_cuit}}', venta.cliente.cuit);
    html = html.replace('{{cliente_nombre}}', venta.cliente.razon_social);
    html = html.replace('{{cliente_domicilio}}', venta.cliente.domicilio);
    /**/

    /*parse comprobante*/
    html = html.replace('{{tipo_factura}}', 'C');
    html = html.replace('{{cod_factura}}', venta.comprobante.CbteTipo);
    html = html.replace('{{punto_venta}}', String(venta.comprobante.PtoVta).padStart(5, '0'));
    html = html.replace('{{cae}}', venta.comprobante.CodAutorizacion);
    html = html.replace('{{fecha_vto}}', venta.comprobante.FchVto);
    html = html.replace('{{fecha_emision}}', venta.comprobante.CbteFch);
    html = html.replace('{{nro_comprobante}}', String(venta.comprobante.nro).padStart(8, '0'));
    /**/
    return html;
}

function remito(html: string, consignacion: Consignacion){
    //parse libros
    var table = '';

    for (let libro of consignacion.libros) {
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
    html = html.replace('{{cliente.cuit}}', consignacion.cliente.cuit);
    html = html.replace('{{cliente.razon_social}}', consignacion.cliente.razon_social);
    html = html.replace('{{cliente.domicilio}}', consignacion.cliente.domicilio);
    //
    const date = new Date().toISOString().
      replace(/T/, ' '). 
      replace(/\..+/, '');
    html = html.replace("{{fecha}}", date);
    //
    return html;
}
