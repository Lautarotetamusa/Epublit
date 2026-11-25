#!/usr/bin/env node
/* Genera las portadas de la demo a partir de catalogo.json.
 * Una serie editorial: mismo sistema tipográfico, color y motivo por colección.
 * Requiere chromium y magick instalados. */

const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const BASE = path.resolve(__dirname, "..");
const TIPOGRAFIAS = path.join(__dirname, "tipografias");
const HTML_DIR = "/tmp/opencode/epublit-demo/covers-html";
const catalogo = JSON.parse(fs.readFileSync(path.join(BASE, "catalogo.json"), "utf8"));
const personas = Object.fromEntries(catalogo.personas.map((p) => [p.slug, p]));
const colecciones = Object.fromEntries(catalogo.colecciones.map((c) => [c.slug, c]));

const PALETAS = {
    "clasicos-argentinos": {
        tonos: ["#12302F", "#17403E"],
        fg: "#F4EFE3", accent: "#C9A227",
        muted: "rgba(244,239,227,.62)", border: "rgba(244,239,227,.22)",
        motivo: "circulo",
    },
    "poesia-rioplatense": {
        tonos: ["#2E2359", "#3C2E75"],
        fg: "#F1E9DA", accent: "#B3A8E0",
        muted: "rgba(241,233,218,.62)", border: "rgba(241,233,218,.22)",
        motivo: "lineas",
    },
    "cuentos-y-fantasia": {
        tonos: ["#F2F1EB", "#E6E4DC"],
        fg: "#1A1D1C", accent: "#22605D",
        muted: "rgba(26,29,28,.62)", border: "rgba(26,29,28,.20)",
        motivo: "ondas",
    },
    "ensayo-y-memorias": {
        tonos: ["#E6E4DC", "#F2F1EB"],
        fg: "#17403E", accent: "#5B4BA8",
        muted: "rgba(23,64,62,.64)", border: "rgba(23,64,62,.20)",
        motivo: "puntos",
    },
    "voces-latinoamericanas": {
        tonos: ["#7A3527", "#8C3B2E"],
        fg: "#F7EDE2", accent: "#E9B949",
        muted: "rgba(247,237,226,.64)", border: "rgba(247,237,226,.22)",
        motivo: "sol",
    },
    "clasicos-universales": {
        tonos: ["#1A1D1C", "#2A2A27"],
        fg: "#F2EFE6", accent: "#C9A227",
        muted: "rgba(242,239,230,.62)", border: "rgba(242,239,230,.20)",
        motivo: "arco",
    },
    "infantil-y-juvenil": {
        tonos: ["#E9B949", "#F0C96A"],
        fg: "#1A1D1C", accent: "#22605D",
        muted: "rgba(26,29,28,.66)", border: "rgba(26,29,28,.22)",
        motivo: "estrellas",
    },
};

function esc(texto) {
    return String(texto)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;");
}

function motivo(kind) {
    const trazo = 'fill="none" stroke="currentColor" stroke-width="1.4"';
    const punto = 'fill="currentColor"';
    switch (kind) {
        case "lineas":
            return `<svg viewBox="0 0 260 260" aria-hidden="true">
                <line x1="70" y1="40" x2="70" y2="220" ${trazo}/>
                <line x1="130" y1="18" x2="130" y2="220" ${trazo}/>
                <line x1="190" y1="58" x2="190" y2="220" ${trazo}/>
                <line x1="40" y1="220" x2="220" y2="220" ${trazo}/>
            </svg>`;
        case "ondas":
            return `<svg viewBox="0 0 260 260" aria-hidden="true">
                <path d="M20 90 Q75 30 130 90 T240 90" ${trazo}/>
                <path d="M20 140 Q75 80 130 140 T240 140" ${trazo}/>
                <path d="M20 190 Q75 130 130 190 T240 190" ${trazo}/>
            </svg>`;
        case "puntos":
            return `<svg viewBox="0 0 260 260" aria-hidden="true">
                ${[30, 80, 130, 180, 230].map((y) =>
                    [30, 80, 130, 180, 230].map((x) =>
                        `<circle cx="${x}" cy="${y}" r="2.6" ${punto}/>`
                    ).join("")
                ).join("")}
            </svg>`;
        case "sol":
            return `<svg viewBox="0 0 260 260" aria-hidden="true">
                <circle cx="130" cy="130" r="52" ${trazo}/>
                ${Array.from({ length: 12 }, (_, i) => {
                    const a = (i * Math.PI) / 6;
                    const x1 = 130 + Math.cos(a) * 72;
                    const y1 = 130 + Math.sin(a) * 72;
                    const x2 = 130 + Math.cos(a) * 102;
                    const y2 = 130 + Math.sin(a) * 102;
                    return `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" ${trazo}/>`;
                }).join("")}
            </svg>`;
        case "arco":
            return `<svg viewBox="0 0 260 260" aria-hidden="true">
                <path d="M45 232 L45 125 A85 85 0 0 1 215 125 L215 232" ${trazo}/>
                <path d="M80 232 L80 130 A50 50 0 0 1 180 130 L180 232" ${trazo}/>
                <line x1="25" y1="232" x2="235" y2="232" ${trazo}/>
            </svg>`;
        case "estrellas":
            return `<svg viewBox="0 0 260 260" aria-hidden="true">
                ${[[62, 72, 20], [178, 54, 14], [196, 168, 24], [78, 188, 16]].map(([x, y, r]) =>
                    `<path transform="translate(${x} ${y})" d="M0 ${-r} L${r * 0.22} ${-r * 0.22} L${r} 0 L${r * 0.22} ${r * 0.22} L0 ${r} L${-r * 0.22} ${r * 0.22} L${-r} 0 L${-r * 0.22} ${-r * 0.22} Z" ${punto}/>`
                ).join("")}
            </svg>`;
        default:
            return `<svg viewBox="0 0 260 260" aria-hidden="true">
                <circle cx="130" cy="130" r="102" ${trazo}/>
                <circle cx="130" cy="130" r="66" ${trazo}/>
                <line x1="130" y1="10" x2="130" y2="250" ${trazo}/>
            </svg>`;
    }
}

function claseTitulo(titulo) {
    if (titulo.length <= 14) return "t-xl";
    if (titulo.length <= 26) return "t-l";
    if (titulo.length <= 40) return "t-m";
    return "t-s";
}

function html(libro, indice) {
    const paleta = PALETAS[libro.coleccion];
    const bg = paleta.tonos[indice % paleta.tonos.length];
    const autor = personas[libro.personas[0].persona];
    const coleccion = colecciones[libro.coleccion];
    const year = libro.fecha_edicion.slice(0, 4);
    const creditos = libro.creditos.length
        ? `<div class="creditos">${libro.creditos.map(esc).join("<br>")}</div>`
        : "";

    return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<style>
@font-face{font-family:Spectral;src:url("file://${TIPOGRAFIAS}/Spectral-Light.ttf");font-weight:300}
@font-face{font-family:Spectral;src:url("file://${TIPOGRAFIAS}/Spectral-Regular.ttf");font-weight:400}
@font-face{font-family:Manrope;src:url("file://${TIPOGRAFIAS}/Manrope.ttf");font-weight:100 900}
@font-face{font-family:Mono;src:url("file://${TIPOGRAFIAS}/JetBrainsMono.ttf");font-weight:100 900}
*{box-sizing:border-box}
html,body{margin:0;width:1200px;height:1800px;overflow:hidden}
body{background:${bg};color:${paleta.fg};font-family:Manrope}
.cover{position:relative;width:1200px;height:1800px;padding:96px;display:flex;flex-direction:column;
  background:
    radial-gradient(1200px 900px at 80% -10%, rgba(255,255,255,.055), transparent 60%),
    radial-gradient(900px 800px at -10% 110%, rgba(0,0,0,.16), transparent 60%);}
.cover:before{content:"";position:absolute;inset:40px;border:1px solid ${paleta.border};pointer-events:none}
.cover:after{content:"";position:absolute;inset:0;opacity:.045;mix-blend-mode:overlay;pointer-events:none;
  background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='240' height='240'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");}
.top{display:flex;justify-content:space-between;align-items:baseline;font-family:Mono;font-size:20px;
  letter-spacing:.18em;text-transform:uppercase;color:${paleta.muted};position:relative;z-index:1}
.serie{display:flex;align-items:center;gap:14px}
.serie i{display:inline-block;width:9px;height:9px;background:${paleta.accent};flex:none}
.mid{margin-top:auto;margin-bottom:auto;padding:30px 0;position:relative;z-index:1;max-width:1008px}
.kicker{font-family:Mono;font-size:21px;letter-spacing:.2em;text-transform:uppercase;color:${paleta.muted};margin-bottom:34px}
h1{font-family:Spectral;font-weight:300;letter-spacing:-.02em;line-height:.98;margin:0;
  text-wrap:balance;hyphens:auto;overflow-wrap:break-word}
.t-xl{font-size:132px}.t-l{font-size:114px}.t-m{font-size:100px}.t-s{font-size:88px}
.rule{width:92px;height:1px;background:${paleta.muted};margin:42px 0 32px}
.author{font-size:30px;font-weight:600;letter-spacing:.12em;text-transform:uppercase;line-height:1.3}
.creditos{margin-top:26px;font-family:Mono;font-size:16px;letter-spacing:.08em;text-transform:uppercase;
  line-height:1.65;color:${paleta.muted}}
.bottom{margin-top:auto;display:flex;justify-content:space-between;align-items:flex-end;font-family:Mono;
  font-size:19px;letter-spacing:.14em;text-transform:uppercase;color:${paleta.muted};position:relative;z-index:1}
.motif{position:absolute;right:96px;bottom:120px;width:250px;height:250px;color:${paleta.fg};opacity:.20;z-index:0}
.motif svg{width:100%;height:100%}
</style>
</head>
<body>
<div class="cover">
  <div class="top"><span class="serie"><i></i>${esc(coleccion.titulo)}</span><span>${String(libro.numero_en_coleccion).padStart(2, "0")}</span></div>
  <div class="mid">
    <div class="kicker">${esc(libro.kicker)}</div>
    <h1 class="${claseTitulo(libro.titulo)}">${esc(libro.titulo)}</h1>
    <div class="rule"></div>
    <div class="author">${esc(autor.nombre)}</div>
    ${creditos}
  </div>
  <div class="bottom"><span>Primera edición</span><span>${year}</span></div>
  <div class="motif">${motivo(paleta.motivo)}</div>
</div>
</body>
</html>`;
}

function main() {
    fs.mkdirSync(HTML_DIR, { recursive: true });
    fs.mkdirSync(path.join(BASE, "imagenes", "portadas"), { recursive: true });

    let hechas = 0;
    catalogo.libros.forEach((libro) => {
        const destino = path.join(BASE, libro.portada);
        const archivoHtml = path.join(HTML_DIR, `${libro.slug}.html`);
        const png = path.join(HTML_DIR, `${libro.slug}.png`);
        fs.writeFileSync(archivoHtml, html(libro, libro.numero_en_coleccion - 1));

        execFileSync("chromium", [
            "--headless", "--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage",
            "--hide-scrollbars", "--no-first-run", "--no-default-browser-check",
            "--force-device-scale-factor=1", "--window-size=1200,1800",
            "--virtual-time-budget=2000", `--screenshot=${png}`,
            `file://${archivoHtml}`,
        ], { stdio: "ignore" });

        execFileSync("magick", [png, "-strip", "-quality", "88", destino]);
        fs.rmSync(png, { force: true });
        hechas++;
        process.stdout.write(`\r${hechas}/${catalogo.libros.length} portadas`);
    });
    console.log("\nListo: demo-data/imagenes/portadas");
}

main();
