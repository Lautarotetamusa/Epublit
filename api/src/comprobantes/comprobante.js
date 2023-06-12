import fs from 'fs';
import puppeteer from 'puppeteer';

const path = './src/comprobantes';

export async function emitir_comprobante(data, tipo="factura"){

    //Create a browser instance
    const browser = await puppeteer.launch({
      executablePath: '/usr/bin/google-chrome',
      args: ['--no-sandbox']
    });
  
    // Create a new page
    const page = await browser.newPage();
  
    var html = fs.readFileSync(`${path}/${tipo}/${tipo}.html`, 'utf8');
    var css  = fs.readFileSync(`${path}/${tipo}/style.css`,    'utf8');
    var logo = fs.readFileSync(`${path}/${tipo}/Logo.png`,   'base64');
    
    html = html.replace('<style></style>', `<style>${css}</style>`);
    html = html.replace('{{logo}}', `<img class="logo" src="data:image/jpeg;base64,${logo}">`);

    if (tipo == "factura"){
        html = factura(html, data);
    }
    else if(tipo == "remito"){
        html = remito(html, data);
    }
    
    await page.setContent(html);
  
    console.log(tipo+"s/"+data.path);
    const pdf = await page.pdf({
      path: tipo+"s/"+data.path,
      printBackground: true,
      format: 'A4',
    });
  
    // Close the browser instance
    await browser.close();
  
    console.log(tipo+" generado correctamente");
  };

function factura(html, venta){
    /*Parse venta.libros*/
    var table = '';

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

    html = html.replace('{{cond_venta}}', venta.tipo);

    //QR
    html = html.replace('<img class="qr" src="">', `<img class="qr" src="${venta.qr_data}">`)

    html = html.replaceAll('{{TOTAL}}', venta.total);
    
    /*parse clientes*/
    html = html.replace('{{cliente_cond}}', venta.cliente.cond_fiscal);
    html = html.replace('{{cliente_cuit}}', venta.cliente.cuit);
    html = html.replace('{{cliente_tipo_venta}}', venta.cliente.tipo_venta);
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

function remito(html, consignacion){
    //parse libros
    var table = '';

    for (let libro of consignacion.libros) {
        table += 
            `<tr>
            <td>${libro.titulo}</td>
            <td>${libro.autores[0].nombre}</td>
            <td>${libro.isbn}</td>
            <td>${libro.cantidad}</td>
            <td>${libro.precio}</td>
            </tr>`;
    }

    html = html.replace('{{LIBROS}}', table);
    //
    
    //parse_clientes
    html = html.replace('{{cliente.cuit}}', consignacion.cliente.cuit);
    html = html.replace('{{cliente.razon_social}}', consignacion.cliente.razon_social);
    html = html.replace('{{cliente.domicilio}}', consignacion.cliente.domicilio);
    //
    html = html.replace("{{fecha}}", new Date());
    //
    return html;
}