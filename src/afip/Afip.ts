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
import { spawn } from "child_process";

const date = new Date(Date.now() - ((new Date()).getTimezoneOffset() * 60000)).toISOString().split('T')[0];

const afipKeysPath = join(__dirname, '../../afipkeys/');

interface IAfip {
    createNextVoucher(data: FacturaPayload): Promise<{voucherNumber: string}>
    getVoucherInfo(voucherNumber: string, ptoVenta: number, tipoCbte: number): Promise<Comprobante>
}

// Funcion traida desde Afip.ts
function formatAfipDate(date: string): string {
    return date.toString()
    .replace(/(\d{4})(\d{2})(\d{2})/, (string, year, month, day) => `${year}-${month}-${day}`);
}

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

export type FacturaPayload = {
    CantReg 	: number, //Cantidad de comprobantes a registrar
    PtoVta 	    : number  //Punto de venta
    CbteTipo 	: number  //Tipo de comprobante (ver tipos disponibles) 
    Concepto 	: number, //Concepto del Comprobante: (1)Productos, (2)Servicios, (3)Productos y Servicios
    DocTipo 	: 80 | 99,//Tipo de documento del comprador (99 consumidor fina,l 80 cuit)
    DocNro 	    : string, //Número de documento del comprador (0 consumidor final)
    CbteFch 	: number, //(Opcional) Fecha del comprobante (yyyymmdd) o fecha actual si es nulo
    ImpTotal 	: number, //Importe total del comprobante
    ImpTotConc  : number, //Importe neto no gravado2
    ImpNeto 	: number, //Importe neto gravado
    ImpOpEx 	: number, //Importe exento de IVA
    ImpIVA 	    : number, //Importe total de IVA. Para facturas A el importe de iva no puede ser 0
    ImpTrib 	: number, //Importe total de tributos
    MonId 	    : 'PES',  //Tipo de moneda usada en el comprobante (ver tipos disponibles)('PES para pesos argentinos) 
    MonCotiz 	: 1,      //Cotización de la moneda usada (1 para pesos argentinos)
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

function createQRUrl(payload: FacturaPayload, voucher: Comprobante){
	const url = 'https://www.afip.gob.ar/fe/qr/?p=';

	const datosComprobante = {
		ver: 1,
		fecha: 	voucher.CbteFch,
		cuit: 	payload.DocNro,
		ptoVta: voucher.PtoVta,
		tipoCmp: voucher.CbteTipo,
		nroCmp: voucher.nro,
		importe: payload.ImpTotal,
		moneda: payload.MonId,
		tipoDocRec: payload.DocTipo,
		nroDocRec: parseInt(payload.DocNro),
		tipoCodAut: "E", //“E” para comprobante autorizado por CAE
		codAut: parseInt(voucher.CodAutorizacion)
	}

	const buff = Buffer.from(JSON.stringify(datosComprobante)).toString("base64");
	return url+buff;
}

export async function getServerStatus(user: User){
    const afip = getAfipClient(user);
	const serverStatus = await afip.ElectronicBilling?.getServerStatus();

	return serverStatus;
}

export async function facturar(pto_venta: number, venta: Venta, cliente: Cliente, afip: IAfip): Promise<Comprobante>{
	const data: FacturaPayload = {
		'CantReg' 	: 1,  									
		'PtoVta' 	: pto_venta,  					
		'CbteTipo' 	: venta.tipo_cbte,  					
		'Concepto' 	: 1,  									
		'DocTipo' 	: cliente.cuit ? 80 : 99, 		
		'DocNro' 	: cliente.cuit || '0',  			
		'CbteFch' 	: parseInt(date.replace(/-/g, '')), 	
		'ImpTotal' 	: venta.total, 							
		'ImpTotConc': 0, // 0 para comprobantes tipo C								
		'ImpNeto' 	: venta.total, 							
		'ImpOpEx' 	: venta.tipo_cbte != 1 ? 0 : venta.total,  // importe exento
		'ImpIVA' 	: venta.tipo_cbte == 1 ? venta.total : 0,  // 0 para comprobantes tipo C
		'ImpTrib' 	: 0,   									
		'MonId' 	: 'PES', 								
		'MonCotiz' 	: 1,     								
	};

    const { voucherNumber } = await afip.createNextVoucher(data);

	const comprobante = await afip.getVoucherInfo(voucherNumber, pto_venta, venta.tipo_cbte);

	comprobante.nro 	= voucherNumber;
	comprobante.CbteFch = formatAfipDate(comprobante.CbteFch);
	comprobante.FchVto	= formatAfipDate(comprobante.FchVto);

	return new Promise<Comprobante>((resolve, reject) => {
        QRcode.toDataURL(createQRUrl(data, comprobante), function (err, base64_qr) {
            if (err) reject(err);

            resolve({
                ...comprobante,
                qr: base64_qr
            });
        });
    })
}

export async function getAfipData(cuit: string): Promise<AfipData>{
    // TODO: make this type unknown
	const afipData = await afipMadre.RegisterInscriptionProof?.getTaxpayerDetails(cuit);
	if (afipData === undefined || afipData === null){
		throw new NotFound(`La persona con CUIT ${cuit} no está cargada en afip`);
    }

	const data: AfipData = {
		cond_fiscal: " - ",
		domicilio: " - ",
		razon_social: " - ",
        fecha_inicio: " - ",
        ingresos_brutos: false
	};

	let impuestos: DescImpuesto[] = [];
    let actividad: DescActividad[] = [];
	if (afipData.datosRegimenGeneral in afipData){
		impuestos = afipData.datosRegimenGeneral.impuesto || [];
		actividad = afipData.datosRegimenGeneral.actividad || [];
    }else if(afipData.datosMonotributo){
		impuestos = afipData.datosMonotributo.impuesto || [];
		actividad = afipData.datosMonotributo.actividad || [];
    }

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

export function getCertPath(cuit: string) {
    return join(afipKeysPath, cuit, "cert.pem");
}

function getCSRPath(cuit: string) {
    return join(afipKeysPath, cuit, "cert.csr");
}

function getKeyPath(cuit: string) {
    return join(afipKeysPath, cuit, "private_key.key");
}

export function createUserFolder(cuit: string) {
    const userPath = join(afipKeysPath, cuit);

    return new Promise((res, rej) => {
        return fs.mkdir(join(userPath, "Tokens"), {recursive: true}, (err, path) => {
            if (err) return rej(err);
            return res(path);
        });
    });
}

export function saveCert(certPath: string, buf: Buffer) {
    return new Promise((res, rej) => {
        fs.writeFile(certPath, buf, null, (err) => {
            if (err) rej(err);
            res(0);
        });
    });
}

export function removeCert(certPath: string) {
    return new Promise((res, rej) => {
        fs.rm(certPath, (err) => {
            if (err) rej(err);
            res(0);
        });
    });
}

// openssl x509 -noout -modulus -in cert.pem
export function isValidCert(certPath: string) {
    const parameters = ["x509", "-noout", "-modulus", "-in", certPath];

    return openssl(parameters).then(() => true).catch(() => false);
}

// openssl genrsa -traditional -out keytest 2048
export function createKey(cuit: string): Promise<number> {
    const keyPath = getKeyPath(cuit);
    const parameters = [ "genrsa", "-traditional", "-out", keyPath, "2048" ];
    return openssl(parameters);
}

/* 
* openssl req -new -key [nombre de archivo para la key] 
* -subj "/C=AR/O=[nombre de la empresa]/CN=[nombre del certificado]/serialNumber=CUIT [CUIT]" 
* -out [nombre de archivo para el CSR]
*
* */
export function createCSR(user: User): Promise<number> {
    const certReqPath = getCSRPath(user.cuit);
    const keyPath = getKeyPath(user.cuit);

    const parameters = [
        "req", "-new", "-key", keyPath, 
        "-subj", `/C=AR/O=${user.razon_social}/CN=Epublit/serialNumber=CUIT ${user.cuit}` ,
        "-out", certReqPath
    ];

    return openssl(parameters);
}

// @returns exit code
// @throws new Error
function openssl(parameters: string[]): Promise<number> {
    return new Promise((res, rej) => {
        const stdout: string[] = [];
        const stderr: string[] = [];

        const openSSLProcess = spawn('openssl', parameters);

        openSSLProcess.stdout.on('data', (data) => {
            stdout.push(data);
        });

        openSSLProcess.stderr.on('data', (data) => {
            stderr.push(data)
        });

        openSSLProcess.on('close', (code) => {
            if (stderr.length > 0) {
                rej(new Error(`openssl error: ${stderr.join(' ')}`));
            }
            if (code == null) return rej(new Error("openssl dont have error code")); 
            if (code != 0) return rej(new Error(`openssl endend this exit code ${code}. ${stderr.join(' ')}`)); 
            res(0);
        });
    });
}
