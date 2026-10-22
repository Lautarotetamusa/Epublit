import { AfipService, IAfip, facturar } from "./Afip";

// Implementación en memoria de `AfipService`, para tests y para levantar la
// app sin depender de la red/filesystem real de AFIP. `facturar` se
// reutiliza tal cual: ya recibe el cliente AFIP por parámetro, así que
// funciona igual con el cliente real o con `mockClient` de acá abajo.
const mockClient: IAfip = {
    createNextVoucher: async () => ({
        voucherNumber: "1001"
    }),
    getVoucherInfo: async () => ({
        nro: "1001",
        qr: "",
        CbteTipo: "1",
        PtoVta: "1",
        CodAutorizacion: "qwert12345",
        FchVto: "20250222",
        CbteFch: "20250222"
    }),
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
        ...overrides
    };
}
