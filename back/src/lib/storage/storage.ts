// Contrato único para guardar/leer archivos subidos o generados por la app
// (portadas, fotos, logos, etiquetas). `key` es una ruta relativa al storage
// (ej. "logos/20123456789.png"), nunca una ruta absoluta de filesystem: eso es
// responsabilidad de cada driver (`localStorage.ts` hoy, un driver de S3 después).
export type Storage = {
    write(key: string, data: Buffer): Promise<void>;
    read(key: string): Promise<Buffer>;
    exists(key: string): Promise<boolean>;
    remove(key: string): Promise<void>;
    getUrl(key: string): string;
};
