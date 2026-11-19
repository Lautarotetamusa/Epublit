import { Button, Icon } from "@ds";
import { PLAN } from "../contenido";
import { ENLACES } from "../enlaces";

export function Planes() {
    return (
        <section id="planes" className="l-planes" aria-labelledby="planes-titulo">
            <div className="l-contenedor">
                <div className="l-encabezado-seccion">
                    <h2 id="planes-titulo">Un solo plan, con todo incluido</h2>
                    <p className="l-seccion-bajada">Probalo gratis durante un mes con tu catálogo real. Después elegís si pagás por mes o por año.</p>
                </div>
                <article className="l-plan">
                    <div className="l-plan-precios">
                        <p className="l-plan-precio">
                            <span className="l-plan-cifra">{PLAN.precioMensual}</span>
                            <span className="l-tenue"> / mes</span>
                        </p>
                        <p className="l-plan-anual">
                            o <strong>{PLAN.precioAnual}</strong> por año: {PLAN.ahorroAnual}
                        </p>
                        <Button href={ENLACES.registrarse} fullWidth size="lg">
                            Empezar el mes de prueba
                        </Button>
                        <p className="l-plan-ajuste">{PLAN.ajuste}</p>
                    </div>
                    <ul className="l-lista-check">
                        {PLAN.incluye.map((item) => (
                            <li key={item}>
                                <Icon name="check" size={18} color="var(--pino-600)" />
                                <span>{item}</span>
                            </li>
                        ))}
                    </ul>
                </article>
            </div>
        </section>
    );
}
