import {
    AfipService,
    ComprobanteAfip,
    IAfip,
    consultarComprobante,
    facturar,
    proximoNumero
} from "./Afip";

// Estado en memoria del mock: simula la numeración y la consulta de
// comprobantes para poder ejercitar la reconciliación. La base se deriva del
// reloj para no chocar con números ya usados por otros archivos de test que
// comparten la misma DB (ver vitest.config.ts, `fileParallelism: false`).
let ultimoEmitido = Date.now() % 50_000_000;
const emitidos = new Map<string, ComprobanteAfip>();

const clave = (puntoVenta: number, codigoAfip: number, numero: number) =>
    `${puntoVenta}:${codigoAfip}:${numero}`;

const mockClient: IAfip = {
    getLastVoucher: async () => ultimoEmitido,
    createVoucher: async (data) => {
        const cae = String(70000000000000 + data.CbteDesde);
        const caeVencimiento = "20260222";
        const info: ComprobanteAfip = {
            CbteNro: data.CbteDesde,
            PtoVta: data.PtoVta,
            CbteTipo: data.CbteTipo,
            CbteFch: String(data.CbteFch),
            CAE: cae,
            CAEFchVto: caeVencimiento,
            Resultado: "A",
            Observaciones: { Obs: [] },
            MonId: data.MonId,
            ImpTotal: data.ImpTotal,
            DocTipo: data.DocTipo,
            DocNro: data.DocNro
        };
        emitidos.set(clave(data.PtoVta, data.CbteTipo, data.CbteDesde), info);
        ultimoEmitido = Math.max(ultimoEmitido, data.CbteDesde);

        return { CAE: cae, CAEFchVto: caeVencimiento };
    },
    getVoucherInfo: async (numero, puntoVenta, codigoAfip) =>
        emitidos.get(clave(puntoVenta, codigoAfip, Number(numero))) ?? null,
    getServerStatus: async () => ({ AppServer: "OK", DbServer: "OK", AuthServer: "OK" })
};

// `overrides` deja que cada test reemplace sólo lo que necesita (ej. un
// `getAfipData` que tira `NotFound` para un cuit puntual), sin tener que
// reimplementar el resto del servicio.
export function createMockAfipService(overrides: Partial<AfipService> = {}): AfipService {
    return {
        getAfipData: async () => ({
            ingresos_brutos: false,
            fecha_inicio: "10/02/2025",
            razon_social: "CLIENTE DE PRUEBA",
            cond_fiscal: "IVA EXENTO",
            domicilio: "DORREGO 1150, ROSARIO, SANTA FE"
        }),
        getClient: () => mockClient,
        getServerStatus: async () => mockClient.getServerStatus!(),
        facturar,
        proximoNumero,
        consultarComprobante,
        ...overrides
    };
}
