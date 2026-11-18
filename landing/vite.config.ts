import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

// El sistema de diseño vive en ../front/src/design-system y se importa como
// fuente, no copiado. `dedupe` obliga a que esos .jsx usen el React de la
// landing: si resolvieran el de front/node_modules habría dos copias y los
// hooks romperían al hidratar.
export default defineConfig({
    plugins: [react()],
    resolve: {
        dedupe: ["react", "react-dom"],
        alias: {
            "@ds": fileURLToPath(new URL("../front/src/design-system", import.meta.url)),
            "@front-lib": fileURLToPath(new URL("../front/src/lib", import.meta.url))
        }
    },
    server: { fs: { allow: [".."] } }
});
