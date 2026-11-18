import { useCallback, useEffect, useState } from "react";
import { getCSR, getFacturacion, uploadCertificado } from "../../api/user";
import type { EstadoFacturacion } from "../../api/user";
import { descargarBlob } from "../../lib/descargas";

export function useFacturacion() {
    const [estado, setEstado] = useState<EstadoFacturacion | null>(null);

    const refetch = useCallback(async () => {
        const response = await getFacturacion();
        setEstado(response.data);
    }, []);

    useEffect(() => {
        void refetch();
    }, [refetch]);

    const descargarCSR = async () => {
        const archivo = await getCSR();
        descargarBlob(archivo.blob, archivo.filename ?? "cert.csr");
    };

    // Subir el certificado cambia el entorno y el estado del certificado: se
    // relee el estado completo en vez de suponer cómo quedó.
    const subirCertificado = async (file: File) => {
        await uploadCertificado(file);
        await refetch();
    };

    return { estado, refetch, descargarCSR, subirCertificado };
}
