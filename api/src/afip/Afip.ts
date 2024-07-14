import Afip from "../afip/afip.js/src/Afip";
import QRcode from 'qrcode';
import { Venta } from '../models/venta.model';
import { NotFound, ValidationError } from '../models/errors';
import { AfipData } from '../schemas/afip.schema';
import { User } from '../models/user.model';
import { Cliente } from '../models/cliente.model';

import fs from "fs";
import { join } from 'path';
import { assert } from "console";

const date = new Date(Date.now() - ((new Date()).getTimezoneOffset() * 60000)).toISOString().split('T')[0];

const afipKeysPath = join(__dirname, '../../afipkeys/');

type DescImpuesto = {
    idImpuesto: number,
    descripcionImpuesto: string
};

type DescActividad = {
    descripcionActividad: string,
    idActividad: number,
    nomenclador: number,
    orden: number,
    periodo: number //yyyymm
};

export type Comprobante = {
    nro: string,
    qr: string,
	CbteTipo: string,
	PtoVta: string,
	CodAutorizacion: string,
	FchVto: string,
	CbteFch: string,
};

const idImpuestos = {
    iva: 32,
    iibb: 5900 //Ingresos brutos
} as const;

// cuenta madre
const cuitProd = "27249804024";
const afipMadre = new Afip({
	CUIT: cuitProd,
	ta_folder: join(afipKeysPath, cuitProd+'/Tokens/'),
	res_folder: join(afipKeysPath, cuitProd),
	key: 'private_key.key',
	cert: 'cert.crt',
    //cert: 'cert.pem',
	production: true,
});

export function getAfipClient(user: User){
    assert(user.production !== undefined, "El usuario no tiene seteada la variable 'production'");

    const path = join(afipKeysPath, user.cuit);

    const certFileName = user.production == 1 ? 'cert.crt' : 'cert.pem';
    const privateFileName = 'private_key.key';

    if (!(fs.existsSync(join(path, privateFileName)))){
        throw new ValidationError(`El usuario ${user.username} no tiene la clave de afip`);
    }
    if (!(fs.existsSync(join(path, certFileName)))){
        throw new ValidationError(`El usuario ${user.username} no tiene el certificado de afip`);
    }

    return new Afip({
        CUIT: user.cuit,
        ta_folder:  join(path, 'Tokens'),
        res_folder: path,
        key: privateFileName,
        cert: certFileName,
        production: user.production === 1,
    });
}

function qr_url(voucher: any){
	const url = 'https://www.afip.gob.ar/fe/qr/?p=';

	const datosComprobante = {
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

	const buff = Buffer.from(JSON.stringify(datosComprobante)).toString("base64");
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
		'ImpOpEx' 	: venta.tipo_cbte != 1 ? 0 : venta.total, //Importe exento de IVA
		'ImpIVA' 	: venta.tipo_cbte == 1 ? venta.total : 0, //Importe total de IVA. Para facturas A el importe de iva no puede ser 0
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
	const afipData = await afipMadre.RegisterInscriptionProof?.getTaxpayerDetails(cuit);
    console.log(afipData);
	if (afipData === null){
		throw new NotFound(`La persona con CUIT ${cuit} no está cargada en afip`);
    }

	let data: AfipData = {
		cond_fiscal: " - ",
		domicilio: " - ",
		razon_social: " - ",
        fecha_inicio: " - ",
        ingresos_brutos: false
	};

	let impuestos: DescImpuesto[] = [];
    let actividad: DescActividad[] = [];
	if (afipData.datosRegimenGeneral){
		impuestos = afipData.datosRegimenGeneral.impuesto || [];
		actividad = afipData.datosRegimenGeneral.actividad || [];
    }else if(afipData.datosMonotributo){
		impuestos = afipData.datosMonotributo.impuesto || [];
		actividad = afipData.datosMonotributo.actividad || [];
    }

    console.log("impuestos:", impuestos);
    console.log("actividad:", actividad);
    const iva  = impuestos.find(i => i.idImpuesto == idImpuestos.iva);
    const iibb = impuestos.find(i => i.idImpuesto == idImpuestos.iibb);
    const actividadPrincipal = actividad.find(a => a.orden == 1);

    if (actividadPrincipal !== undefined){
        const periodo = String(actividadPrincipal.periodo);
        if (periodo.length >= 6){
            const year = periodo.slice(0,4);
            const month = periodo.slice(4,6);
            data.fecha_inicio = `01/${month}/${year}`; //Siempre empiezan en el dia 01 del mes
        }
    }

    data.cond_fiscal = iva !== undefined ? iva.descripcionImpuesto : " - ";
    data.ingresos_brutos = iibb !== undefined;

	if (afipData.datosGenerales.tipoPersona == 'JURIDICA'){
		data.razon_social = afipData.datosGenerales.razonSocial;
    }else {
		data.razon_social = afipData.datosGenerales.nombre+' '+afipData.datosGenerales.apellido;
    }

    if (afipData.datosGenerales.domicilioFiscal){
        const d = afipData.datosGenerales.domicilioFiscal;
        const sep = " - ";

        data.domicilio = ''
            + (d.direccion + sep)
            + (d.localidad !== undefined ? d.localidad + sep : '')
            + (d.descripcionProvincia !== undefined ? d.descripcionProvincia : 'BUENOS AIRES');
     }

     return data;
}

/*
const a = {
    codPostal: '1416',
    descripcionProvincia: 'CIUDAD AUTONOMA BUENOS AIRES',
    direccion: 'ESPINOSA 1581',
    idProvincia: 0,
    tipoDomicilio: 'FISCAL'
}
    */
