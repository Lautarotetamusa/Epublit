import type { ReactNode } from "react";

export type Captura = {
    src: string;
    alt: string;
    pie?: ReactNode;
    // Se declaran para reservar el espacio de la imagen antes de que cargue:
    // sin esto el texto de los pasos salta mientras bajan las capturas.
    ancho: number;
    alto: number;
};

export type Paso = {
    contenido: ReactNode;
    capturas?: Captura[];
};

export type Seccion = {
    id: string;
    titulo: string;
    intro?: ReactNode;
    pasos: Paso[];
};

export type Articulo = {
    slug: string;
    titulo: string;
    resumen: string;
    tema: string;
    actualizado: string;
    requisitos?: ReactNode[];
    secciones: Seccion[];
    cierre?: Cierre;
};

export type Cierre = {
    titulo: string;
    texto: ReactNode;
    accion?: { etiqueta: string; ruta: string };
};
