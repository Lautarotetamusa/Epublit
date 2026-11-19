import { Button } from "@ds";
import { ENLACES } from "../enlaces";

export function Cierre() {
    return (
        <section className="l-cierre" aria-labelledby="cierre-titulo">
            <div className="l-contenedor l-encabezado-seccion">
                <h2 id="cierre-titulo">Empezá a ordenar tu editorial hoy</h2>
                <p>El primer mes es gratis. Creás la cuenta y cargás tus primeros títulos.</p>
                <div className="l-acciones l-acciones-centro">
                    <Button href={ENLACES.registrarse} variant="secondary" size="lg" iconEnd="arrow-right">
                        Probar gratis un mes
                    </Button>
                </div>
                <p className="l-cierre-nota">
                    ¿Ya tenés cuenta? <a href={ENLACES.iniciarSesion}>Iniciá sesión</a>.
                </p>
            </div>
        </section>
    );
}
