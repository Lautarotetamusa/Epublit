import { useEffect, useMemo, useState } from "react";
import { listVentas } from "../../api/operaciones";
import type { Venta } from "../../api/operaciones";

function firstDayOfMonth(): string {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}

function lastDayOfMonth(): string {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().slice(0, 10);
}

const MEDIO_LABEL: Record<string, string> = {
    efectivo: "Efectivo",
    debito: "Débito",
    credito: "Crédito",
    mercadopago: "Mercado Pago",
    transferencia: "Transferencia"
};

export function useDashboard() {
    const [ventas, setVentas] = useState<Venta[]>([]);
    const [loading, setLoading] = useState(true);
    const [desde, setDesde] = useState(firstDayOfMonth());
    const [hasta, setHasta] = useState(lastDayOfMonth());

    useEffect(() => {
        listVentas().then((r) => {
            setVentas(r.data);
            setLoading(false);
        });
    }, []);

    const filtradas = useMemo(() => {
        const desdeDate = new Date(desde);
        const hastaDate = new Date(hasta);
        hastaDate.setHours(23, 59, 59, 999);
        return ventas.filter((v) => {
            const fecha = new Date(v.fecha);
            return fecha >= desdeDate && fecha <= hastaDate;
        });
    }, [ventas, desde, hasta]);

    const totalVendido = filtradas.reduce((acc, v) => acc + v.total, 0);
    const cantidadVentas = filtradas.length;
    const enFirme = filtradas.filter((v) => v.type === "venta").length;
    const enConsignacion = filtradas.filter((v) => v.type === "ventaConsignacion").length;

    const porMedioPago = useMemo(() => {
        const acc: Record<string, number> = {};
        for (const v of filtradas) acc[v.medio_pago] = (acc[v.medio_pago] ?? 0) + v.total;
        return Object.entries(acc)
            .map(([medio, total]) => ({ medio: MEDIO_LABEL[medio] ?? medio, total }))
            .sort((a, b) => b.total - a.total);
    }, [filtradas]);

    const porMes = useMemo(() => {
        const acc: Record<string, number> = {};
        for (const v of filtradas) {
            const key = new Date(v.fecha).toLocaleDateString("es-AR", { month: "short", year: "2-digit" });
            acc[key] = (acc[key] ?? 0) + v.total;
        }
        return Object.entries(acc).map(([mes, total]) => ({ mes, total }));
    }, [filtradas]);

    return { loading, desde, hasta, setDesde, setHasta, totalVendido, cantidadVentas, enFirme, enConsignacion, porMedioPago, porMes };
}
