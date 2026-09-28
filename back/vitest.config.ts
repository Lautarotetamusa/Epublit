import { defineConfig } from "vitest/config";
import { resolve } from "path";

export default defineConfig({
    test: {
        environment: "node",
        globals: true,
        testTimeout: 30000,
        // Todos los archivos de test comparten la misma DB fija (ver
        // scripts/reset-test-db.sh) y cada uno levanta su propio server en
        // el mismo puerto (`src/index.ts`): correrlos en paralelo pisa
        // tanto el puerto como los datos entre archivos.
        fileParallelism: false,
        coverage: {
            provider: "v8",
            reporter: ["text", "html"],
            include: ["src/**/*.ts"],
            exclude: ["src/lib/afip/afip.js/**", "src/index.ts"]
        }
    },
    resolve: {
        alias: {
            "@": resolve(__dirname, "src")
        }
    }
});
