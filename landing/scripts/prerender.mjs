// Inyecta el HTML renderizado en el index.html del build de cliente, para que
// buscadores y previsualizaciones lean el contenido sin ejecutar JS. El bundle
// de cliente después hidrata ese mismo árbol.
import { readFile, rm, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const raiz = fileURLToPath(new URL("..", import.meta.url));
const { render } = await import(`${raiz}dist-ssr/entry-server.js`);

const rutaIndex = `${raiz}dist/index.html`;
const plantilla = await readFile(rutaIndex, "utf8");
if (!plantilla.includes("<!--app-html-->")) throw new Error("index.html no tiene el marcador <!--app-html-->");

await writeFile(rutaIndex, plantilla.replace("<!--app-html-->", render()));
await rm(`${raiz}dist-ssr`, { recursive: true, force: true });
console.log("prerender: dist/index.html generado");
