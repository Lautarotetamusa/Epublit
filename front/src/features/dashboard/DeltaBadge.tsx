import { Badge, Tooltip } from "../../design-system";

type Props = {
    actual: number;
    anterior: number;
    // El período contra el que se compara, **con la preposición adentro** porque
    // el texto la necesita: "en septiembre" cuando se compara mes completo contra
    // mes completo, "el 1–16 de septiembre" cuando el mes elegido está en curso y
    // se compara el mismo tramo.
    periodoComparado: string;
    // Qué se está midiendo, para poder nombrarlo cuando no hay con qué comparar.
    magnitud: string;
};

// La comparación contra el período anterior. La dirección la decide el signo y de
// ahí salen el color, la flecha y el texto del tooltip: la regla (verde sube,
// rojo baja) vive en un solo lugar en vez de repetirse en cada cifra del panel.
export function DeltaBadge({ actual, anterior, periodoComparado, magnitud }: Props) {
    // Sin datos en el período anterior el porcentaje no existe: el badge lo dice
    // y el tooltip explica por qué, nombrando el período que se intentó comparar.
    if (anterior === 0) {
        return (
            <Tooltip label={`sin ${magnitud} ${periodoComparado}`}>
                <Badge tone="neutral">Sin comparación</Badge>
            </Tooltip>
        );
    }

    const variacion = ((actual - anterior) / anterior) * 100;
    const porcentaje = Math.abs(variacion).toLocaleString("es-AR", { maximumFractionDigits: 1 });

    if (variacion === 0) {
        return (
            <Tooltip label={`igual que ${periodoComparado}`}>
                <Badge tone="neutral" icon="arrow-right">
                    0%
                </Badge>
            </Tooltip>
        );
    }

    const sube = variacion > 0;
    return (
        <Tooltip label={`un ${porcentaje}% ${sube ? "más" : "menos"} que ${periodoComparado}`}>
            <Badge tone={sube ? "success" : "error"} icon={sube ? "arrow-up-right" : "arrow-down-right"}>
                {variacion.toLocaleString("es-AR", { maximumFractionDigits: 1, signDisplay: "exceptZero" })}%
            </Badge>
        </Tooltip>
    );
}
