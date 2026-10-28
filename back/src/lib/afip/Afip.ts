import Afip from "./afip.js/src/Afip";
import { VentaRow } from '../../modules/transaccion/venta.validator';
import { BadRequest, NotFound } from 'bradb';
import { AfipData } from './afip.validator';
import { User } from '../../modules/user/user.validator';
import { Client as Cliente } from '../../modules/cliente/cliente.validator';

import fs from "fs";
import { join } from 'path';
import { assert } from "console";
import { spawn } from "child_process";

// Ruta a las credenciales AFIP. Se resuelve desde el cwd (no desde
// __dirname): en dev el proceso corre con cwd=back/ y en la imagen el
// WORKDIR es /app; en los dos casos las claves viven en ./afipkeys.
// Con __dirname quedaba en /app/dist/afipkeys al compilar.
const afipKeysPath = join(process.cwd(), 'afipkeys');

export type VentaFiscal = Pick<VentaRow, "tipo_cbte" | "total" | "descuento">;

// Respuesta completa de `FECompConsultar` (getVoucherInfo): sólo se tipan los
// campos que consume el comprobante.
export type ComprobanteAfip = {
    CbteNro?: number | string;
    PtoVta?: number | string;
    CbteTipo?: number | string;
    CbteFch?: string;
    CAE?: string;
    CAEFchVto?: string;
    FchVto?: string;
    Resultado?: string;
    Observaciones?: { Obs?: unknown[] };
    MonId?: string;
    ImpTotal?: number | string;
    DocTipo?: number | string;
    DocNro?: number | string;
    [key: string]: unknown;
};

export interface IAfip {
    getLastVoucher(ptoVenta: number, tipoCbte: number): Promise<number>;
    createVoucher(data: FacturaPayload & { CbteDesde: number; CbteHasta: number }): Promise<{
        CAE: string;
        CAEFchVto: string;
    }>;
    getVoucherInfo(voucherNumber: number | string, ptoVenta: number, tipoCbte: number): Promise<ComprobanteAfip | null>;
    getServerStatus?(): Promise<unknown>;
}

export class AfipError extends Error {
    code: number;

    constructor(message: string, code: number) {
        super(message);
        this.code = code;
    }
}

// Funcion traida desde Afip.ts
function formatAfipDate(date: string | number): string {
    const raw = String(date);
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;

    return raw.replace(/(\d{4})(\d{2})(\d{2})/, (_, year, month, day) => `${year}-${month}-${day}`);
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

export type FacturaPayload = {
    CantReg 	: number, //Cantidad de comprobantes a registrar
    PtoVta 	    : number  //Punto de venta
    CbteTipo 	: number  //Tipo de comprobante (ver tipos disponibles) 
    Concepto 	: number, //Concepto del Comprobante: (1)Productos, (2)Servicios, (3)Productos y Servicios
    DocTipo 	: 80 | 99,//Tipo de documento del comprador (99 consumidor fina,l 80 cuit)
    DocNro 	    : string, //Número de documento del comprador (0 consumidor final)
    // RG 5616/2024: condición frente al IVA del receptor. AFIP la exige
    // desde 2025; los códigos principales son 1=RI, 4=Exento,
    // 5=Consumidor Final y 6=Monotributo.
    CondicionIVAReceptorId: number,
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

export type FacturaRequest = FacturaPayload & {
    CbteDesde: number;
    CbteHasta: number;
};

// Importes fiscales tal como los envía hoy el backend a AFIP. Se persisten
// aparte de `datos_afip` para renderizar sin la respuesta cruda.
export type ImportesFiscales = {
    neto: number;
    iva: number;
    exento: number;
    noGravado: number;
    tributos: number;
    total: number;
};

export type FacturaFiscal = {
    codigoAfip: number;
    puntoVenta: number;
    numero: number;
    fecha: string;
    cae: string;
    caeVencimiento: string;
    resultado: "A" | "R";
    observaciones: unknown[];
    moneda: string;
    importe: number;
    qrUrl: string;
    datosAfip: {
        request: FacturaRequest | null;
        response: Record<string, unknown>;
    };
};

const idImpuestos = {
    iva: 32,
    iibb: 5900 //Ingresos brutos
} as const;

const URL_QR_AFIP = 'https://www.afip.gob.ar/fe/qr/?p=';

// El QR lleva el CUIT del emisor (no el documento del receptor) y el
// documento del receptor en `nroDocRec`, según el especificación de AFIP.
function createQRUrl(
    datos: { tipoDocRec: number; nroDocRec: number; fecha: string; ptoVenta: number; tipoCmp: number; nroCmp: number; importe: number; moneda: string; codAut: number },
    emisorCuit: string
): string {
    const datosComprobante = {
        ver: 1,
        fecha: datos.fecha,
        cuit: Number(emisorCuit.replace(/\D/g, '')),
        ptoVta: datos.ptoVenta,
        tipoCmp: datos.tipoCmp,
        nroCmp: datos.nroCmp,
        importe: datos.importe,
        moneda: datos.moneda,
        tipoDocRec: datos.tipoDocRec,
        nroDocRec: datos.nroDocRec,
        tipoCodAut: "E", //“E” para comprobante autorizado por CAE
        codAut: datos.codAut
    };

    return URL_QR_AFIP + Buffer.from(JSON.stringify(datosComprobante)).toString("base64");
}

export function importesFiscales(venta: VentaFiscal): ImportesFiscales {
    return {
        neto: venta.total,
        iva: venta.tipo_cbte === 1 ? venta.total : 0,
        exento: venta.tipo_cbte === 1 ? venta.total : 0,
        noGravado: 0,
        tributos: 0,
        total: venta.total
    };
}

// Códigos de `FEParamGetCondicionIvaReceptor` usados por Epublit.
export function condicionIvaReceptorId(condFiscal: string | null | undefined): number {
    const condicion = (condFiscal ?? "").toUpperCase();

    if (condicion.includes("MONOTRIBUTO")) return 6;
    if (condicion.includes("EXENTO")) return 4;
    if (condicion.includes("RESPONSABLE INSCRIPTO") || condicion.includes("INSCRIPTO")) return 1;
    if (condicion.includes("CONSUMIDOR FINAL")) return 5;

    return 5;
}

export function crearFacturaPayload(
    venta: VentaFiscal,
    cliente: Pick<Cliente, "cuit"> & { cond_fiscal?: string | null },
    ptoVenta: number
): FacturaPayload {
    const date = new Date(Date.now() - ((new Date()).getTimezoneOffset() * 60000)).toISOString().split('T')[0];
    const importes = importesFiscales(venta);

    return {
        'CantReg': 1,
        'PtoVta': ptoVenta,
        'CbteTipo': venta.tipo_cbte,
        'Concepto': 1,
        'DocTipo': cliente.cuit ? 80 : 99,
        'DocNro': cliente.cuit || '0',
        'CondicionIVAReceptorId': condicionIvaReceptorId(cliente.cond_fiscal),
        'CbteFch': parseInt(date.replace(/-/g, '')),
        'ImpTotal': importes.total,
        'ImpTotConc': importes.noGravado,
        'ImpNeto': importes.neto,
        'ImpOpEx': importes.exento,
        'ImpIVA': importes.iva,
        'ImpTrib': importes.tributos,
        'MonId': 'PES',
        'MonCotiz': 1
    };
}

function observacionesDe(info: ComprobanteAfip | null): unknown[] {
    return info?.Observaciones?.Obs ?? [];
}

function armarFactura(args: {
    emisorCuit: string;
    numero: number;
    puntoVenta: number;
    codigoAfip: number;
    cae: string;
    caeVencimiento: string;
    fechaFallback: string;
    importeFallback: number;
    monedaFallback: string;
    tipoDocRecFallback: number;
    nroDocRecFallback: number;
    request: FacturaRequest | null;
    info: ComprobanteAfip | null;
    response: Record<string, unknown>;
}): FacturaFiscal {
    const { info, emisorCuit } = args;
    const numero = Number(info?.CbteNro ?? args.numero);
    const puntoVenta = Number(info?.PtoVta ?? args.puntoVenta);
    const codigoAfip = Number(info?.CbteTipo ?? args.codigoAfip);
    const fecha = formatAfipDate(String(info?.CbteFch || args.fechaFallback));
    const cae = String(info?.CAE || args.cae);
    const caeVencimiento = formatAfipDate(String(info?.CAEFchVto || info?.FchVto || args.caeVencimiento));
    const resultado = info?.Resultado === "R" ? "R" : "A";
    const importe = Number(info?.ImpTotal ?? args.importeFallback);
    const moneda = String(info?.MonId || args.monedaFallback);
    const tipoDocRec = Number(info?.DocTipo ?? args.tipoDocRecFallback);
    const nroDocRec = Number(info?.DocNro ?? args.nroDocRecFallback);

    return {
        codigoAfip,
        puntoVenta,
        numero,
        fecha,
        cae,
        caeVencimiento,
        resultado,
        observaciones: observacionesDe(info),
        moneda,
        importe,
        qrUrl: createQRUrl(
            {
                tipoDocRec,
                nroDocRec,
                fecha,
                ptoVenta: puntoVenta,
                tipoCmp: codigoAfip,
                nroCmp: numero,
                importe,
                moneda,
                codAut: Number(cae)
            },
            emisorCuit
        ),
        datosAfip: { request: args.request, response: args.response }
    };
}

function asAfipError(error: unknown): Error {
    if (!(error instanceof Error)) return new Error(String(error));

    // Los errores de AFIP llegan como "(código) mensaje" dentro del message.
    const match = error.message.match(/\((\d+)\) (.+)$/);
    if (!match) return error;

    const [, code, message] = match;
    return new AfipError(message, Number(code));
}

async function consultarVoucher(
    afip: IAfip,
    numero: number,
    puntoVenta: number,
    codigoAfip: number
): Promise<ComprobanteAfip | null> {
    try {
        return await afip.getVoucherInfo(numero, puntoVenta, codigoAfip);
    } catch (error) {
        const afipError = asAfipError(error);

        // La librería de AFIP intenta tratar el 602 como "sin datos", pero el
        // error real no trae `err.code`; se normaliza acá.
        if (afipError instanceof AfipError && afipError.code === 602) {
            return null;
        }

        throw afipError;
    }
}

export type ConsultarComprobanteInput = {
    numero: number;
    puntoVenta: number;
    codigoAfip: number;
    emisorCuit: string;
    afip: IAfip;
};

// Reconciliación: adopta un comprobante que AFIP ya autorizó (timeout o error
// 600) en vez de emitir otro número.
export async function consultarComprobante({
    numero,
    puntoVenta,
    codigoAfip,
    emisorCuit,
    afip
}: ConsultarComprobanteInput): Promise<FacturaFiscal | null> {
    const info = await consultarVoucher(afip, numero, puntoVenta, codigoAfip);
    if (!info || !info.CAE) return null;

    return armarFactura({
        emisorCuit,
        numero,
        puntoVenta,
        codigoAfip,
        cae: String(info.CAE),
        caeVencimiento: String(info.CAEFchVto ?? info.FchVto ?? ""),
        fechaFallback: "",
        importeFallback: 0,
        monedaFallback: "PES",
        tipoDocRecFallback: 99,
        nroDocRecFallback: 0,
        request: null,
        info,
        response: info
    });
}

export async function proximoNumero(afip: IAfip, puntoVenta: number, codigoAfip: number): Promise<number> {
    try {
        return Number(await afip.getLastVoucher(puntoVenta, codigoAfip)) + 1;
    } catch (error) {
        const afipError = asAfipError(error);

        // AFIP devuelve 602 cuando todavía no hay ningún comprobante
        // autorizado para ese punto de venta y tipo. Para el primer
        // comprobante, el próximo número es 1.
        if (afipError instanceof AfipError && afipError.code === 602) {
            return 1;
        }

        throw afipError;
    }
}

export type FacturarInput = {
    puntoVenta: number;
    venta: VentaFiscal;
    cliente: Pick<Cliente, "cuit"> & { cond_fiscal?: string | null };
    emisorCuit: string;
    // Se registra antes de llamar a AFIP: `createVoucher` lo usa como
    // CbteDesde para que la numeración no dependa de un segundo
    // `getLastVoucher` dentro de la llamada.
    numeroEsperado: number;
    afip: IAfip;
};

export async function facturar({
    puntoVenta,
    venta,
    cliente,
    emisorCuit,
    numeroEsperado,
    afip
}: FacturarInput): Promise<FacturaFiscal> {
    const payload = crearFacturaPayload(venta, cliente, puntoVenta);
    const request: FacturaRequest = {
        ...payload,
        CbteDesde: numeroEsperado,
        CbteHasta: numeroEsperado
    };

    try {
        // `afip.js` muta el objeto (borra CantReg/PtoVta/CbteTipo): se le
        // pasa una copia para conservar el request crudo en `datos_afip`.
        const creado = await afip.createVoucher({ ...request });
        const info = await consultarVoucher(afip, numeroEsperado, puntoVenta, venta.tipo_cbte);

        return armarFactura({
            emisorCuit,
            numero: numeroEsperado,
            puntoVenta,
            codigoAfip: venta.tipo_cbte,
            cae: creado.CAE,
            caeVencimiento: creado.CAEFchVto,
            fechaFallback: String(payload.CbteFch),
            importeFallback: payload.ImpTotal,
            monedaFallback: payload.MonId,
            tipoDocRecFallback: payload.DocTipo,
            nroDocRecFallback: Number(payload.DocNro),
            request,
            info,
            response: { create: creado, info }
        });
    } catch (error) {
        const afipError = asAfipError(error);

        // 600 = el comprobante ya existe: se consulta el número que se intentó
        // emitir y, si AFIP lo autorizó, se adopta.
        if (afipError instanceof AfipError && afipError.code === 600) {
            const existente = await consultarComprobante({
                numero: numeroEsperado,
                puntoVenta,
                codigoAfip: venta.tipo_cbte,
                emisorCuit,
                afip
            });
            if (existente) return existente;
        }

        throw afipError;
    }
}

export type AfipService = {
    getAfipData(cuit: string): Promise<AfipData>;
    getClient(user: User): IAfip;
    getServerStatus(user: User): Promise<unknown>;
    facturar(input: FacturarInput): Promise<FacturaFiscal>;
    proximoNumero(afip: IAfip, puntoVenta: number, codigoAfip: number): Promise<number>;
    consultarComprobante(input: ConsultarComprobanteInput): Promise<FacturaFiscal | null>;
};

export type CreateAfipServiceDeps = {
    cuitProd: string;
};

// Factory (no singleton): cada llamada arma su propio cliente de producción —
// `container.ts` la construye una sola vez con el cuit real, y los tests
// construyen su propio container con `createMockAfipService()` (ver
// `Afip.mock.ts`) en vez de mockear este módulo con `vi.mock`.
export function createAfipService({ cuitProd }: CreateAfipServiceDeps): AfipService {
    const afipProd = new Afip({
        CUIT: cuitProd,
        ta_folder: join(afipKeysPath, cuitProd + '/Tokens/'),
        res_folder: join(afipKeysPath, cuitProd),
        key: 'private_key.key',
        cert: 'cert.crt',
        production: true,
    });

    const getClient = (user: User): IAfip => {
        assert(user.production !== undefined, "El usuario no tiene seteada la variable 'production'");

        const path = join(afipKeysPath, user.cuit);
        const certFileName = user.production ? 'cert.crt' : 'cert.pem';
        const privateFileName = 'private_key.key';

        if (!(fs.existsSync(join(path, privateFileName)))){
            throw new BadRequest(`El usuario ${user.username} no tiene la clave de afip`);
        }
        if (!(fs.existsSync(join(path, certFileName)))){
            throw new BadRequest(`El usuario ${user.username} no tiene el certificado de afip`);
        }

        const client = new Afip({
            CUIT: user.cuit,
            ta_folder: join(path, 'Tokens'),
            res_folder: path,
            key: privateFileName,
            cert: certFileName,
            production: user.production === true,
        });

        return client.ElectronicBilling as IAfip;
    };

    const getServerStatus = async (user: User): Promise<unknown> => {
        const afip = getClient(user);
        return afip.getServerStatus?.();
    };

    const getAfipData = async (cuit: string): Promise<AfipData> => {
        // eslint-disable-next-line sonarjs/todo-tag -- deuda histórica de tipado de afip.js
        // TODO: make this type unknown
        const afipData = await afipProd.RegisterInscriptionProof?.getTaxpayerDetails(cuit);
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
    };

    return { getAfipData, getClient, getServerStatus, facturar, proximoNumero, consultarComprobante };
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
export function createCSR(user: Pick<User, 'cuit' | 'razon_social'>): Promise<number> {
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
        const stderr: string[] = [];

        // openssl es un prerrequisito del runtime (igual que en la imagen): la
        // ruta la resuelve el PATH del contenedor.
        // eslint-disable-next-line sonarjs/no-os-command-from-path
        const openSSLProcess = spawn('openssl', parameters);

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
