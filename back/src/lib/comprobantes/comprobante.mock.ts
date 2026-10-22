import { ComprobanteService } from "./comprobante";

// Evita lanzar puppeteer/chrome real en los tests (lento y no hace falta
// para probar las reglas de negocio de venta/consignación): se inyecta vía
// DI en `createContainer` en vez de `vi.mock('.../comprobante')`, mismo
// criterio que `createMockAfipService` (ver `lib/afip/Afip.mock.ts`). Sin
// dependencia de `vitest` acá (este archivo se compila con el resto de
// `src/`, ver `tsconfig.json`): quien necesite espiar la llamada pasa su
// propio `vi.fn()` en `overrides.emitirComprobante`.
export function createMockComprobanteService(overrides: Partial<ComprobanteService> = {}): ComprobanteService {
    return {
        emitirComprobante: async () => undefined,
        ...overrides
    };
}
