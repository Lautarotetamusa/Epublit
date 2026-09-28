import globals from "globals";
import pluginJs from "@eslint/js";
import tseslint from "typescript-eslint";
import sonarjs from "eslint-plugin-sonarjs";
import complexity from "eslint-plugin-complexity";
import noRedundantWrapper from "./eslint-rules/no-redundant-wrapper.js";
import noSpreadAwait from "./eslint-rules/no-spread-await.js";
import noLargeTernary from "./eslint-rules/no-large-ternary.js";

const localRules = {
    rules: {
        ...noRedundantWrapper.rules,
        ...noSpreadAwait.rules,
        ...noLargeTernary.rules
    }
};

export default [
    {files: ["**/*.{js,mjs,cjs,ts}"]},
    {languageOptions: { globals: globals.node }},
    {ignores: ["src/lib/afip/afip.js/*"]},
    pluginJs.configs.recommended,
    ...tseslint.configs.recommended,
    sonarjs.configs.recommended,

    // Arquitectura (regla de módulos: sólo se entra por index.ts o
    // *.schema.ts): se probó eslint-plugin-boundaries y su algoritmo de
    // matching de carpetas da falsos negativos con patterns anidados o que
    // se superponen (ej. "src/modules/*/**/*" vs "src/**/*" clasifica el
    // archivo con el pattern equivocado), incluso con el resolver de
    // TypeScript funcionando. No detectaba violaciones reales en las
    // pruebas. Mismo tipo de problema que import-x/no-cycle (ver abajo):
    // se descartó por dar falsa confianza, no por falta de intento.

    // Ciclos de imports reales: ya nos mordieron dos veces en esta sesión
    // (Persona↔Libro vía schema, transaccion.service -> app.ts -> container
    // -> transaccion) y sólo se detectaban en runtime. import-x/no-cycle no
    // detecta ciclos reales en este entorno (Node 26 / ESLint 9), probado
    // con el resolver funcionando standalone y con la API de Linter.verify()
    // directamente. Se usa madge en su lugar: `npm run lint:cycles`.

    // Métricas de calidad: sólo un aviso (no bloquea) con la complejidad de
    // cada función, para tener el número a la vista sin frenar el trabajo.
    {
        plugins: { complexity },
        rules: {
            "complexity/comment": ["warn", { max: 10 }]
        }
    },

    // Reglas propias (no existe una genérica para esto en ningún plugin
    // conocido):
    // - no-redundant-wrapper: funciones que sólo reenvían sus parámetros a
    //   otra llamada, ej. `findAll: async (userId, p) => repository.findAll(userId, p)`
    //   en vez de `findAll: repository.findAll` directamente.
    // - no-spread-await: `{ ...(await x()) }` esconde una espera async
    //   adentro de lo que parece una construcción sincrónica de un objeto.
    // - no-large-ternary: ternarios de más de 3 líneas, más claros como
    //   if/else (ver eslint-rules/*.js para el detalle y el caso real de cada uno).
    {
        plugins: { local: localRules },
        rules: {
            "local/no-redundant-wrapper": "error",
            "local/no-spread-await": "error",
            "local/no-large-ternary": "error"
        }
    }
];
