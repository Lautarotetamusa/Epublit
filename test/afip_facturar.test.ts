import { describe, test, expect, vi } from 'vitest';
import { facturar, AfipError, IAfip } from '../src/lib/afip/Afip';
import { VentaRow } from '../src/modules/transaccion/venta.validator';
import { Client } from '../src/modules/cliente/cliente.validator';

// Unitario, sin HTTP ni DB: ejercita el parseo de errores de AFIP
// (`facturar` es una función pura, recibe el cliente AFIP por parámetro),
// que ningún test end-to-end toca porque todos usan el mock.
const venta = { tipo_cbte: 11, total: 1000, descuento: 0 } as VentaRow;
const cliente = { cuit: "20300000013" } as Client;

const afipOk: IAfip = {
    createNextVoucher: vi.fn().mockResolvedValue({ voucherNumber: "1001" }),
    getVoucherInfo: vi.fn().mockResolvedValue({
        nro: "1001",
        qr: "",
        CbteTipo: "1",
        PtoVta: "1",
        CodAutorizacion: "qwert12345",
        FchVto: "20250222",
        CbteFch: "20250222"
    })
};

describe('facturar', () => {
    test('devuelve el comprobante con QR y fechas formateadas', async () => {
        const comprobante = await facturar(1, venta, cliente, afipOk);

        expect(comprobante.nro).toEqual("1001");
        expect(comprobante.qr).toMatch(/^data:image\/png;base64,/);
        expect(comprobante.CbteFch).toEqual("2025-02-22");
        expect(comprobante.FchVto).toEqual("2025-02-22");
    });

    test('un error de AFIP con formato "(código) mensaje" se traduce a AfipError', async () => {
        const afipConError: IAfip = {
            ...afipOk,
            createNextVoucher: vi.fn().mockRejectedValue(new Error("Algo falló (600) El comprobante ya existe"))
        };

        await expect(facturar(1, venta, cliente, afipConError)).rejects.toMatchObject(
            new AfipError("El comprobante ya existe", 600)
        );
    });

    test('un error sin ese formato se relanza tal cual', async () => {
        const afipConError: IAfip = {
            ...afipOk,
            createNextVoucher: vi.fn().mockRejectedValue(new Error("timeout de red"))
        };

        await expect(facturar(1, venta, cliente, afipConError)).rejects.toThrow("timeout de red");
    });
});
