import { StrictMode } from "react";
import { createRoot, hydrateRoot } from "react-dom/client";
// Se importan los tokens del sistema de diseño de a uno, sin fonts.css: la
// landing usa Geist (pedido del usuario, spec 025) y así no se bajan
// Spectral ni Manrope de más.
import "@ds/tokens/colors.css";
import "@ds/tokens/typography.css";
import "@ds/tokens/spacing.css";
import "@ds/tokens/radius.css";
import "@ds/tokens/elevation.css";
import "@ds/tokens/motion.css";
import "@ds/tokens/base.css";
import "./landing.css";
import { App } from "./App";

const raiz = document.getElementById("root")!;
const arbol = (
    <StrictMode>
        <App />
    </StrictMode>
);

// En el build el HTML ya viene prerenderizado y se hidrata; en `vite dev`
// la raíz llega vacía (sólo el marcador) y se monta de cero.
if (raiz.firstElementChild) hydrateRoot(raiz, arbol);
else createRoot(raiz).render(arbol);
