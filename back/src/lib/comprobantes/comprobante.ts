import fs from 'fs';
import puppeteer from 'puppeteer';
import { VentaRow } from '../../modules/transaccion/venta.validator';
import { User } from '../../modules/user/user.validator';
import { Client as Cliente } from '../../modules/cliente/cliente.validator';
import { Comprobante } from '../afip/Afip';
import { join } from 'path';
import { tiposComprobantes } from '../../modules/transaccion/venta.validator';
import { LibroOperacion, TransaccionConCliente } from '../../modules/transaccion/operacion.types';
import { Storage } from '../storage/storage';

// Plantillas HTML/CSS bundleadas con el código (no son un archivo de
// negocio generado ni subido por nadie), por eso se siguen leyendo del
// filesystem local directo, sin pasar por `storage`.
const templatesPath = './src/lib/comprobantes';

// `filesFolder` reemplaza a `Venta.filesFolder`/`Consignacion.filesFolder`
// (propiedades estáticas de la jerarquía vieja, ya no existen): ahora viaja
// como dato explícito, resuelto por la `OperacionConfig` de quien llama
// (`src/modules/transaccion/operacion.config.ts`).
type CreateFactura = {
    venta: VentaRow
    // `file_path` vive en la transacción (no en la venta): `ventasTable` no
    // tiene esa columna, ver `src/modules/transaccion/venta.schema.ts`.
    transaction: TransaccionConCliente
    comprobante: Comprobante
    cliente: Cliente,
    libros: LibroOperacion[],
    filesFolder: string
};

type CreateRemito = {
    consignacion: TransaccionConCliente,
    cliente: Cliente,
    libros: LibroOperacion[],
    filesFolder: string
};

type args = {
    data: CreateFactura | CreateRemito
    user: User,
}

export type ComprobanteServiceDeps = {
    storage: Storage;
};

export function createComprobanteService({ storage }: ComprobanteServiceDeps) {
    const emitirComprobante = async ({ data, user }: args): Promise<void> => {
        const tipo = 'venta' in data ? 'factura' : 'remito';

        const browser = await puppeteer.launch({
            executablePath: '/usr/bin/google-chrome',
            args: ['--no-sandbox'],
            headless: true
        });
        const page = await browser.newPage();

        let html    = fs.readFileSync(`${templatesPath}/${tipo}/${tipo}.html`, 'utf8');
        const css   = fs.readFileSync(`${templatesPath}/${tipo}/style.css`,    'utf8');
        html = html.replace('<style></style>', `<style>${css}</style>`);

        if (tipo == 'remito'){
            const logoKey = `logos/${user.cuit}.png`;
            const haveLogo = await storage.exists(logoKey);

            if (haveLogo){
                const logo = (await storage.read(logoKey)).toString('base64');
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
        html = html.replace('{{user_email}}', user.email ?? "");

        let key: string;
        if ('venta' in data){
            key = join(data.filesFolder, data.transaction.file_path);
            html = factura(html, data);
        }else{
            key = join(data.filesFolder, data.consignacion.file_path);
            html = remito(html, data);
        }

        await page.setContent(html);
        const pdf = await page.pdf({
            printBackground: true,
            format: 'A4',
        });

        await browser.close();

        await storage.write(key, Buffer.from(pdf));
    };

    return { emitirComprobante };
}

export type ComprobanteService = ReturnType<typeof createComprobanteService>;

function factura(html: string, {venta, cliente, libros, comprobante}: CreateFactura){
    let table = '';
    const logoAfip = fs.readFileSync(`${templatesPath}/factura/logoAfip.png`, 'base64');
    html = html.replace('{{logo}}', `<img class="logo" src="data:image/jpeg;base64,${logoAfip}">`);

    /*Parse venta.libros*/
    // `descuento` es nullable a nivel de columna (`ventasTable`), pero
    // `createVenta` siempre lo manda con default 0 al insertar, así que acá
    // nunca llega null en la práctica.
    const descuento = venta.descuento ?? 0;
    for (const libro of libros) {
        const bonif = descuento * 0.01;
        const imp_bonif = (libro.precio * libro.cantidad * bonif).toFixed(2);
        const subtotal  = (libro.precio * libro.cantidad * (1 - bonif)).toFixed(2);

        table +=
            `<tr>
            <td style="text-align:left">${libro.isbn}</td>
            <td style="text-align:left">${libro.titulo}</td>
            <td>${libro.cantidad}</td>
            <td>${libro.precio}</td>
            <td>${descuento}</td>
            <td>${imp_bonif}</td>
            <td>${subtotal}</td>
            </tr>`;
    }
    html = html.replace('{{LIBROS}}', table);
    /**/

    html = html.replace('{{cond_venta}}', venta.medio_pago ?? '');

    //QR
    html = html.replace('<img class="qr" src="">', `<img class="qr" src="${comprobante.qr}">`)

    html = html.replace(/\{\{TOTAL\}\}/g, String(venta.total));
    
    /*parse clientes*/
    html = html.replace('{{cliente_cond}}', cliente.cond_fiscal);
    html = html.replace('{{cliente_cuit}}', cliente.cuit || '');
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
    html = html.replace('{{cliente.cuit}}', cliente.cuit || '');
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
