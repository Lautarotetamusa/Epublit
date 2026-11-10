import { useCallback, useState } from "react";
import { subirImagenContenido } from "../../api/contenido";
import type { UsoImagen } from "../../api/contenido";
import { useToast } from "../../notifications/ToastProvider";
import { mensajeDeError } from "./erroresContenido";

export type ImagenSubida = {
    imagenId: number;
    url: string;
    ancho: number;
    alto: number;
};

// La subida es una responsabilidad aparte del formulario: valida en el
// browser (MediaUpload) y acá sólo se ocupa de la llamada real, del estado
// "subiendo" y de traducir el error del backend a un toast. Devuelve `null`
// cuando falló, para que quien llama pueda volver a la imagen anterior sin
// perder el alt/epígrafe ya escritos.
export function useSubidaImagen() {
    const { showToast } = useToast();
    const [subiendo, setSubiendo] = useState(false);

    const subir = useCallback(
        async (file: File, uso: UsoImagen): Promise<ImagenSubida | null> => {
            setSubiendo(true);
            try {
                const { imagen } = await subirImagenContenido(file, uso);
                return { imagenId: imagen.id, url: imagen.url, ancho: imagen.ancho, alto: imagen.alto };
            } catch (err) {
                showToast("error", mensajeDeError(err));
                return null;
            } finally {
                setSubiendo(false);
            }
        },
        [showToast]
    );

    return { subiendo, subir };
}
