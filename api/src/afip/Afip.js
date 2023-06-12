import Afip from '@afipsdk/afip.js';

import QRcode from 'qrcode';

import { emitir_comprobante } from '../comprobantes/comprobante.js'

const date = new Date(Date.now() - ((new Date()).getTimezoneOffset() * 60000)).toISOString().split('T')[0];

// cuenta madre
const afip_madre = new Afip({
	CUIT: 27249804024,
	ta_folder: './src/afip/ClavesLibrosSilvestres/Tokens/',
	res_folder: './src/afip/ClavesLibrosSilvestres/',
	key: 'private_key.key',
	cert: 'FacturadorLibrosSilvestres_773cb8c416f11552.crt',
	production: true,
});

const afip = new Afip({
	CUIT: 20434919798,
	ta_folder: './src/afip/Claves/Tokens/',
	res_folder: './src/afip/Claves',
	key: 'private_key.key',
	cert: 'cert.pem',
	production: false,
});


function qr_url(voucher){
	const url = 'https://www.afip.gob.ar/fe/qr/?p=';

	let datos_comprobante = {
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
	//console.log(datos_comprobante);

	var buff = Buffer.from(JSON.stringify(datos_comprobante)).toString("base64");
	console.log(url+buff);

	return url+buff;
}
 
function calc_subtotal(libro){
    return libro.precio * libro.cantidad * (1 - libro.bonif * 0.01);
}

export default afip_madre;

export async function facturar(venta){

	//let total = venta.libros.reduce((sum, libro) => sum + calc_subtotal(libro), 0);
	let data = {
		'CantReg' 	: 1,  									//Cantidad de comprobantes a registrar
		'PtoVta' 	: venta.punto_venta,  					//Punto de venta
		'CbteTipo' 	: venta.tipo_cbte,  					//Tipo de comprobante (ver tipos disponibles) 
		'Concepto' 	: 1,  									//Concepto del Comprobante: (1)Productos, (2)Servicios, (3)Productos y Servicios
		'DocTipo' 	: venta.cliente.cuit == "0" ? 99 : 80, 	//Tipo de documento del comprador (99 consumidor final, 80 cuit)
		'DocNro' 	: venta.cliente.cuit,  					//Número de documento del comprador (0 consumidor final)
		'CbteFch' 	: parseInt(date.replace(/-/g, '')), 	//(Opcional) Fecha del comprobante (yyyymmdd) o fecha actual si es nulo
		'ImpTotal' 	: venta.total, 								//Importe total del comprobante
		'ImpTotConc': 0,   									//Importe neto no gravado2
		'ImpNeto' 	: venta.total, 								//Importe neto gravado
		'ImpOpEx' 	: 0,   									//Importe exento de IVA
		'ImpIVA' 	: 0,  									//Importe total de IVA
		'ImpTrib' 	: 0,   									//Importe total de tributos
		'MonId' 	: 'PES', 								//Tipo de moneda usada en el comprobante (ver tipos disponibles)('PES' para pesos argentinos) 
		'MonCotiz' 	: 1,     								//Cotización de la moneda usada (1 para pesos argentinos)
	};
	//console.log("data:", data);


	let {voucherNumber} = await afip.ElectronicBilling.createNextVoucher(data);
	//console.log(voucherNumber);

	let comprobante = await afip.ElectronicBilling.getVoucherInfo(voucherNumber, venta.punto_venta, venta.tipo_cbte);

	comprobante.nro 	= voucherNumber;
	comprobante.CbteFch = afip.ElectronicBilling.formatDate(comprobante.CbteFch);
	comprobante.FchVto	= afip.ElectronicBilling.formatDate(comprobante.FchVto);
	comprobante.emisor 	= venta.cliente.cuit;
	//console.log(comprobante);
	
	QRcode.toDataURL(qr_url(comprobante), function (err, base64_qr) {
		emitir_comprobante({
			...venta,
			qr_data: base64_qr,
			comprobante: comprobante
		}, "factura");
	});
}