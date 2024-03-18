import Afip from './afip.js/src/Afip';
import QRcode from 'qrcode';
import { Venta } from '../models/venta.model';
import { NotFound, ValidationError } from '../models/errors';
import { AfipData } from '../schemas/cliente.schema';
import { User } from '../models/user.model';
import { Cliente } from '../models/cliente.model';

import fs from "fs";

const date = new Date(Date.now() - ((new Date()).getTimezoneOffset() * 60000)).toISOString().split('T')[0];

export type Comprobante = {
    nro: string,
    qr: string,
	CbteTipo: string,
	PtoVta: string,
	CodAutorizacion: string,
	FchVto: string,
	CbteFch: string,
};

// cuenta madre
const afip_madre = new Afip({
	CUIT: 27249804024,
	ta_folder: './src/afip/ClavesLibrosSilvestres/Tokens/',
	res_folder: './src/afip/ClavesLibrosSilvestres/',
	key: 'private_key.key',
	cert: 'FacturadorLibrosSilvestres_773cb8c416f11552.crt',
	production: true,
});
//export default afip_madre;
/*const afip = new Afip({
	CUIT: 20434919798,
	ta_folder: './src/afip/Claves/Tokens/',
	res_folder: './src/afip/Claves',
	key: 'private_key.key',
	cert: 'cert.pem',
	production: false,
});*/

function getAfipClient(user: User){
    const path = `./src/afip/Claves/${user.cuit}/`;
    if (!(fs.existsSync(path+'private_key.key'))){
        throw new ValidationError(`El usuario ${user.username} no tiene la clave de afip`);
    }
    if (!(fs.existsSync(path+'cert.pem'))){
        throw new ValidationError(`El usuario ${user.username} no tiene el certificado de afip`);
    }

    return new Afip({
        CUIT: user.cuit,
        ta_folder:  `${path}/Tokens/`,
        res_folder: path,
        key: 'private_key.key',
        cert: 'cert.pem',
        production: false,
    });
}

function qr_url(voucher: any){
	const url = 'https://www.afip.gob.ar/fe/qr/?p=';

	const datos_comprobante = {
		ver: 1,
		fecha: 	voucher.CbteFch,
		cuit: 	voucher.emisor,
		ptoVta: voucher.PtoVta,
		tipoCmp: voucher.CbteTipo,
		nroCmp: voucher.nro,
		importe: parseFloat(voucher.ImpTotal),
		moneda: voucher.MonId,
		tipoDocRec: voucher.DocTipo,
		nroDocRec: parseInt(voucher.DocNro),
		tipoCodAut: "E", //“E” para comprobante autorizado por CAE
		codAut: parseInt(voucher.CodAutorizacion)
	}

	var buff = Buffer.from(JSON.stringify(datos_comprobante)).toString("base64");
	console.log(url+buff);

	return url+buff;
}

export async function getServerStatus(user: User){
    const afip = getAfipClient(user);
	const serverStatus = await afip.ElectronicBilling?.getServerStatus();

	console.log('Este es el estado del servidor:');
	console.log(serverStatus);
	return serverStatus;
}

export async function facturar(venta: Venta, cliente: Cliente, user: User): Promise<Comprobante>{
    const afip = getAfipClient(user);
	const data = {
		'CantReg' 	: 1,  									//Cantidad de comprobantes a registrar
		'PtoVta' 	: venta.punto_venta,  					//Punto de venta
		'CbteTipo' 	: venta.tipo_cbte,  					//Tipo de comprobante (ver tipos disponibles) 
		'Concepto' 	: 1,  									//Concepto del Comprobante: (1)Productos, (2)Servicios, (3)Productos y Servicios
		'DocTipo' 	: cliente.cuit ? 80 : 99, 		//Tipo de documento del comprador (99 consumidor fina,l 80 cuit)
		'DocNro' 	: cliente.cuit || 0,  			//Número de documento del comprador (0 consumidor final)
		'CbteFch' 	: parseInt(date.replace(/-/g, '')), 	//(Opcional) Fecha del comprobante (yyyymmdd) o fecha actual si es nulo
		'ImpTotal' 	: venta.total, 							//Importe total del comprobante
		'ImpTotConc': 0,   									//Importe neto no gravado2
		'ImpNeto' 	: venta.total, 							//Importe neto gravado
		'ImpOpEx' 	: 0,   									//Importe exento de IVA
		'ImpIVA' 	: 0,  									//Importe total de IVA
		'ImpTrib' 	: 0,   									//Importe total de tributos
		'MonId' 	: 'PES', 								//Tipo de moneda usada en el comprobante (ver tipos disponibles)('PES' para pesos argentinos) 
		'MonCotiz' 	: 1,     								//Cotización de la moneda usada (1 para pesos argentinos)
	};
	const {voucherNumber} = await afip.ElectronicBilling?.createNextVoucher(data);	

	let comprobante: Comprobante = await afip.ElectronicBilling?.getVoucherInfo(voucherNumber, venta.punto_venta, venta.tipo_cbte);

	comprobante.nro 	= voucherNumber;
	comprobante.CbteFch = afip.ElectronicBilling?.formatDate(comprobante.CbteFch);
	comprobante.FchVto	= afip.ElectronicBilling?.formatDate(comprobante.FchVto);

	return new Promise<Comprobante>((resolve, reject) => {
        QRcode.toDataURL(qr_url(comprobante), function (err, base64_qr) {
            if (err) reject(err);

            resolve({
                ...comprobante,
                qr: base64_qr
            });
        });
    })
}

export async function getAfipData(cuit: string): Promise<AfipData>{
	const afip_data = await afip_madre.RegisterScopeFive?.getTaxpayerDetails(cuit);
	if (afip_data === null){
		throw new NotFound(`La persona con CUIT ${cuit} no está cargada en afip`);
    }

	let data: AfipData = {
		cond_fiscal: " - ",
		domicilio: " - ",
		razon_social: " - "
	};

	if (!afip_data.datosGenerales.domicilioFiscal.localidad)
		afip_data.datosGenerales.domicilioFiscal.localidad = 'CAPITAL FEDERAL'

	let impuestos = null;
	if (afip_data.datosRegimenGeneral)
		impuestos = afip_data.datosRegimenGeneral.impuesto
	else if(afip_data.datosMonotributo)
		impuestos = afip_data.datosMonotributo.impuesto

	if (impuestos){
		var iva = (impuestos as {
			idImpuesto: number,
			descripcionImpuesto: string
		}[]).find(i => i.idImpuesto == 32);

		if (iva)
		data.cond_fiscal = iva.descripcionImpuesto;
	}else{
		data.cond_fiscal = " - ";
	}
	
	if (afip_data.datosGenerales.tipoPersona == 'JURIDICA')
		data.razon_social = afip_data.datosGenerales.razonSocial;
	else 
		data.razon_social = afip_data.datosGenerales.nombre+' '+afip_data.datosGenerales.apellido;

	data.domicilio = ''
		+ afip_data.datosGenerales.domicilioFiscal.direccion+' - '
		+ afip_data.datosGenerales.domicilioFiscal.localidad+ ' ' 
		+ afip_data.datosGenerales.domicilioFiscal.descripcionProvincia;

	return data;
}
