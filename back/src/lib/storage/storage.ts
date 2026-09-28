// Contrato único para guardar/leer archivos generados por la app
// (comprobantes, y a futuro cualquier otro archivo de negocio). `key` es una
// ruta relativa al storage (ej. "facturas/CLIENTE-20250101.pdf"), nunca una
// ruta absoluta de filesystem: eso es responsabilidad de cada driver
// (`localStorage.ts` hoy, un driver de S3 después).
export type Storage = {
    write(key: string, data: Buffer): Promise<void>;
    read(key: string): Promise<Buffer>;
    exists(key: string): Promise<boolean>;
    remove(key: string): Promise<void>;
    getUrl(key: string): string;
};
