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
    const mounts = [];
    const re = /app\.use\('([^']*)',[^)]*container\.(\w+)\.(\w+)\)/g;
    let match;
    while ((match = re.exec(appSrc))) {
        const [, prefix, moduleName, routerName] = match;
        mounts.push({ moduleName, routerName, prefix: prefix === "" ? "/" : prefix });
    }
    return mounts;
}

function cleanPath(rawPath) {
    // Convierte template literals (`/${tipo}`) a un placeholder legible.
    return rawPath.replace(/\$\{(\w+)\}/g, ":$1").replace(/^["'`]|["'`]$/g, "");
}

function findRoutesFiles(dir, baseDir = dir) {
    const files = [];

    for (const entry of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            files.push(...findRoutesFiles(fullPath, baseDir));
        } else if (entry.name.endsWith(".routes.ts")) {
            files.push(path.relative(baseDir, fullPath));
        }
    }

    return files;
}

function extractMountTag(routesFile) {
    const src = fs.readFileSync(routesFile, "utf8");
    const match = src.match(/@mount\s+(\w+)/);
    return match ? match[1] : null;
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
    const mounts = readMountPrefixes();
    const moduleDirs = fs.readdirSync(MODULES_DIR).filter((name) =>
        fs.statSync(path.join(MODULES_DIR, name)).isDirectory()
    );

    const lines = ["# API", "", "Generado por `scripts/generate-api-docs.js`. No editar a mano.", ""];

    for (const moduleName of moduleDirs.sort()) {
        const moduleDir = path.join(MODULES_DIR, moduleName);
        const routesFiles = findRoutesFiles(moduleDir);
        if (routesFiles.length === 0) continue;

        const moduleMounts = mounts.filter((mount) => mount.moduleName === moduleName);
        if (moduleMounts.length === 0) continue;

        const routesForMount = (mount) => {
            const mountRoutesFiles = routesFiles.filter((f) => {
                const tag = extractMountTag(path.join(moduleDir, f));
                return tag === null || tag === mount.routerName;
            });
            return mountRoutesFiles.flatMap((f) => extractRoutes(path.join(moduleDir, f)));
        };

        const pushRoutes = (mount, allRoutes) => {
            for (const { method, path: routePath } of allRoutes) {
                const fullPath = mount.prefix === "/" ? routePath : `${mount.prefix}${routePath}`.replace(/\/+/g, "/");
                lines.push(`- \`${method.padEnd(6)} ${fullPath}\``);
            }
        };

        if (moduleMounts.length === 1) {
            const mount = moduleMounts[0];
            const allRoutes = routesForMount(mount);
            if (allRoutes.length === 0) continue;

            lines.push(`## ${moduleName} (${mount.prefix === "/" ? "" : mount.prefix})`, "");
            pushRoutes(mount, allRoutes);
            lines.push("");
            continue;
        }

        lines.push(`## ${moduleName}`, "");
        for (const mount of moduleMounts) {
            const allRoutes = routesForMount(mount);
            if (allRoutes.length === 0) continue;

            lines.push(`### ${mount.routerName} (${mount.prefix === "/" ? "" : mount.prefix})`, "");
            pushRoutes(mount, allRoutes);
            lines.push("");
        }
    }

    fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
    fs.writeFileSync(OUT_FILE, lines.join("\n"));
    console.log(`Escribí ${OUT_FILE}`);
}

main();
