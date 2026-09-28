import fs from "fs/promises";
import { existsSync } from "fs";
import { dirname, join } from "path";
import { Storage } from "./storage";

export type CreateLocalStorageDeps = {
    // Carpeta raíz donde vive cada `key` (hoy `env.FILES_PATH`).
    basePath: string;
    // Prefijo público con el que se arma `getUrl` (hoy `env.HOST`): quien
    // sirve los archivos (`app.ts#express.static`) tiene que coincidir con
    // `basePath` para que la URL resultante sea alcanzable.
    host: string;
};

export function createLocalStorage({ basePath, host }: CreateLocalStorageDeps): Storage {
    const resolvePath = (key: string) => join(basePath, key);

    const write = async (key: string, data: Buffer): Promise<void> => {
        const path = resolvePath(key);
        await fs.mkdir(dirname(path), { recursive: true });
        await fs.writeFile(path, data);
    };

    const read = (key: string): Promise<Buffer> => fs.readFile(resolvePath(key));

    const exists = async (key: string): Promise<boolean> => existsSync(resolvePath(key));

    const remove = (key: string): Promise<void> => fs.rm(resolvePath(key));

    const getUrl = (key: string): string => `${host}/files/${key}`;

    return { write, read, exists, remove, getUrl };
}
