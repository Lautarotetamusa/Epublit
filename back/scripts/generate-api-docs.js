#!/usr/bin/env node
// Genera docs/api.md a partir de las rutas reales (*.routes.ts) y sus
// prefijos de montaje (app.ts). Determinístico: sólo lee método+path, nunca
// nombres de controller/service ni lógica. Pensado para que el agente
// "planner" tenga un contrato de la API sin tener que leer código fuente.
"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const MODULES_DIR = path.join(ROOT, "src", "modules");
const APP_FILE = path.join(ROOT, "src", "app.ts");
const OUT_FILE = path.join(ROOT, "docs", "api.md");

function readMountPrefixes() {
    const appSrc = fs.readFileSync(APP_FILE, "utf8");
    const prefixes = {};
    const re = /app\.use\('([^']*)',[^)]*container\.(\w+)\.router\)/g;
    let match;
    while ((match = re.exec(appSrc))) {
        const [, prefix, moduleName] = match;
        prefixes[moduleName] = prefix === "" ? "/" : prefix;
    }
    return prefixes;
}

function cleanPath(rawPath) {
    // Convierte template literals (`/${tipo}`) a un placeholder legible.
    return rawPath.replace(/\$\{(\w+)\}/g, ":$1").replace(/^["'`]|["'`]$/g, "");
}

function extractRoutes(routesFile) {
    const src = fs.readFileSync(routesFile, "utf8");
    const routes = [];
    const re = /router\.(get|post|put|patch|delete)\(\s*[`'"]([^`'"]*)[`'"]/g;
    let match;
    while ((match = re.exec(src))) {
        const [, method, rawPath] = match;
        routes.push({ method: method.toUpperCase(), path: cleanPath(rawPath) });
    }
    return routes;
}

function main() {
    const prefixes = readMountPrefixes();
    const moduleDirs = fs.readdirSync(MODULES_DIR).filter((name) =>
        fs.statSync(path.join(MODULES_DIR, name)).isDirectory()
    );

    const lines = ["# API", "", "Generado por `scripts/generate-api-docs.js`. No editar a mano.", ""];

    for (const moduleName of moduleDirs.sort()) {
        const moduleDir = path.join(MODULES_DIR, moduleName);
        const routesFiles = fs.readdirSync(moduleDir).filter((f) => f.endsWith(".routes.ts"));
        if (routesFiles.length === 0) continue;

        const prefix = prefixes[moduleName] ?? "?";
        const allRoutes = routesFiles.flatMap((f) => extractRoutes(path.join(moduleDir, f)));
        if (allRoutes.length === 0) continue;

        lines.push(`## ${moduleName} (${prefix === "/" ? "" : prefix})`, "");
        for (const { method, path: routePath } of allRoutes) {
            const fullPath = prefix === "/" ? routePath : `${prefix}${routePath}`.replace(/\/+/g, "/");
            lines.push(`- \`${method.padEnd(6)} ${fullPath}\``);
        }
        lines.push("");
    }

    fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
    fs.writeFileSync(OUT_FILE, lines.join("\n"));
    console.log(`Escribí ${OUT_FILE}`);
}

main();
