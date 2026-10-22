import { useEffect, useState } from "react";

// Previsualiza un archivo recién elegido con un objectURL local, liberándolo
// al reemplazarlo o desmontar. Sin archivo, cae al valor ya subido
// (`fallbackUrl`) — usado por la portada de libro y la foto de persona.
export function useFilePreview(file: File | null, fallbackUrl: string = ""): string {
    const [objectUrl, setObjectUrl] = useState("");

    useEffect(() => {
        if (!file) {
            setObjectUrl("");
            return;
        }
        const url = URL.createObjectURL(file);
        setObjectUrl(url);
        return () => URL.revokeObjectURL(url);
    }, [file]);

    return file ? objectUrl : fallbackUrl;
}
