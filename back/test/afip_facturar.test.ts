import { describe, test, expect, vi } from 'vitest';
import {
    facturar,
    proximoNumero,
    condicionIvaReceptorId,
    AfipError,
    FacturaFiscal,
    IAfip
} from '../src/lib/afip/Afip';
import { VentaRow } from '../src/modules/transaccion/venta.validator';
import { Client } from '../src/modules/cliente/cliente.validator';

// Unitario, sin HTTP ni DB: ejercita el mapeo de AFIP, el QR y la
// reconciliación. `facturar` es pura salvo por el cliente `IAfip` que recibe.
const venta = { tipo_cbte: 11, total: 1000, descuento: 0 } as VentaRow;
const cliente = { cuit: "20300000013" } as Client;
const emisorCuit = "20-12345678-9";

const voucherInfo = (numero: number) => ({
    CbteNro: numero,
    qr: "",
    CbteTipo: 11,
    PtoVta: 1,
    CbteFch: "20250222",
    CAE: "75123456789012",
    CAEFchVto: "20250304",
    Resultado: "A",
    MonId: "PES",
    ImpTotal: 1000,
    DocTipo: 80,
    DocNro: 20300000013
});

const crearAfip = (overrides: Partial<IAfip> = {}): IAfip => ({
    getLastVoucher: vi.fn().mockResolvedValue(1000),
    createVoucher: vi.fn().mockResolvedValue({
        CAE: "75123456789012",
        CAEFchVto: "20250304"
    }),
    getVoucherInfo: vi.fn().mockResolvedValue(voucherInfo(1001)),
    ...overrides
});

const qrDe = (comprobante: FacturaFiscal) => {
    const payload = comprobante.qrUrl.split("p=")[1];
    return JSON.parse(Buffer.from(payload, "base64").toString("utf8"));
};

describe('condicionIvaReceptorId', () => {
    test('mapea las condiciones fiscales que usa Epublit', () => {
        expect(condicionIvaReceptorId("RESPONSABLE INSCRIPTO")).toBe(1);
        expect(condicionIvaReceptorId("IVA EXENTO")).toBe(4);
        expect(condicionIvaReceptorId("CONSUMIDOR FINAL")).toBe(5);
        expect(condicionIvaReceptorId("MONOTRIBUTO")).toBe(6);
        expect(condicionIvaReceptorId(null)).toBe(5);
    });
});

describe('proximoNumero', () => {
    test('sin comprobantes previos arranca en 1 cuando AFIP devuelve 602', async () => {
        const afip = crearAfip({
            getLastVoucher: vi.fn().mockRejectedValue(
                new Error('(602) No existen datos en nuestros registros para los parametros ingresados.')
            )
        });

        await expect(proximoNumero(afip, 1, 11)).resolves.toBe(1);
    });

    test('relanza otros errores de AFIP', async () => {
        const afip = crearAfip({
            getLastVoucher: vi.fn().mockRejectedValue(new Error('(10016) El número no es el próximo'))
        });

        await expect(proximoNumero(afip, 1, 11)).rejects.toMatchObject(
            new AfipError("El número no es el próximo", 10016)
        );
    });
});

describe('facturar', () => {
    test('devuelve el comprobante fiscal con fechas normalizadas y QR del emisor', async () => {
        const comprobante = await facturar({
            puntoVenta: 1,
            venta,
            cliente,
            emisorCuit,
            numeroEsperado: 1001,
            afip: crearAfip()
        });

        expect(comprobante).toMatchObject({
            codigoAfip: 11,
            puntoVenta: 1,
            numero: 1001,
            fecha: "2025-02-22",
            cae: "75123456789012",
            caeVencimiento: "2025-03-04",
            resultado: "A",
            moneda: "PES",
            importe: 1000
        });

        expect(qrDe(comprobante)).toMatchObject({
            cuit: 20123456789,
            nroDocRec: 20300000013,
            tipoDocRec: 80,
            tipoCmp: 11,
            nroCmp: 1001,
            codAut: 75123456789012
        });

        // El cliente del test no tiene condición fiscal: se asume Consumidor
        // Final (5), que es lo que exige la RG 5616 para el caso general.
        expect(comprobante.datosAfip.request?.CondicionIVAReceptorId).toBe(5);
    });

    test('un error de AFIP con formato "(código) mensaje" se traduce a AfipError', async () => {
        const afipConError = crearAfip({
            createVoucher: vi.fn().mockRejectedValue(new Error("Algo falló (10016) El número no es el próximo"))
        });

        await expect(
            facturar({ puntoVenta: 1, venta, cliente, emisorCuit, numeroEsperado: 1001, afip: afipConError })
        ).rejects.toMatchObject(new AfipError("El número no es el próximo", 10016));
    });

    test('un error sin ese formato se relanza tal cual', async () => {
        const afipConError = crearAfip({
            createVoucher: vi.fn().mockRejectedValue(new Error("timeout de red"))
        });

        await expect(
            facturar({ puntoVenta: 1, venta, cliente, emisorCuit, numeroEsperado: 1001, afip: afipConError })
        ).rejects.toThrow("timeout de red");
    });

    test('un 602 al consultar el comprobante se trata como inexistente', async () => {
        const afipConError = crearAfip({
            createVoucher: vi.fn().mockRejectedValue(
                new Error("El comprobante ya existe (600) El comprobante ya existe")
            ),
            getVoucherInfo: vi.fn().mockRejectedValue(
                new Error("(602) No existen datos en nuestros registros para los parametros ingresados.")
            )
        });

        await expect(
            facturar({ puntoVenta: 1, venta, cliente, emisorCuit, numeroEsperado: 1001, afip: afipConError })
        ).rejects.toMatchObject(new AfipError("El comprobante ya existe", 600));
    });

    test('ante error 600 adopta el comprobante que AFIP ya había autorizado', async () => {
        const afipConError = crearAfip({
            createVoucher: vi.fn().mockRejectedValue(new Error("El comprobante ya existe (600) El comprobante ya existe")),
            getVoucherInfo: vi.fn().mockResolvedValue(voucherInfo(1001))
        });

        const comprobante = await facturar({
            puntoVenta: 1,
            venta,
            cliente,
            emisorCuit,
            numeroEsperado: 1001,
            afip: afipConError
        });

        expect(comprobante.numero).toBe(1001);
        expect(comprobante.cae).toBe("75123456789012");
        expect(afipConError.getVoucherInfo).toHaveBeenCalledWith(1001, 1, 11);
    });
});
