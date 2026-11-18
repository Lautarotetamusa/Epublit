import type { Articulo } from "../tipos";
import { certificadoArca } from "./certificadoArca";

// Para sumar un artículo: crear su archivo en esta carpeta, agregarlo acá y
// dejar sus capturas en public/ayuda/<slug>/. El índice y la página de
// artículo se arman solos a partir de esta lista.
export const ARTICULOS: Articulo[] = [certificadoArca];

export const buscarArticulo = (slug: string): Articulo | undefined => ARTICULOS.find((articulo) => articulo.slug === slug);

export const agruparPorTema = (articulos: Articulo[]): Array<{ tema: string; articulos: Articulo[] }> =>
    articulos.reduce<Array<{ tema: string; articulos: Articulo[] }>>((grupos, articulo) => {
        const grupo = grupos.find((existente) => existente.tema === articulo.tema);
        if (grupo) grupo.articulos.push(articulo);
        else grupos.push({ tema: articulo.tema, articulos: [articulo] });
        return grupos;
    }, []);

export const contarPasos = (articulo: Articulo): number =>
    articulo.secciones.reduce((total, seccion) => total + seccion.pasos.length, 0);
