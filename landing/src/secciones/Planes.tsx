import { Button, Icon } from "@ds";
import { PLANES } from "../contenido";
import { ENLACES } from "../enlaces";

export function Planes() {
    return (
        <section id="planes" className="l-planes" aria-labelledby="planes-titulo">
            <div className="l-contenedor">
                <div className="l-encabezado-seccion">
                    <h2 id="planes-titulo">Planes para cada editorial</h2>
                    <p className="l-seccion-bajada">Precios mensuales en pesos. Empezás gratis y cambiás de plan cuando tu catálogo crece.</p>
                </div>
                <div className="l-planes-grilla">
                    {PLANES.map((plan) => (
                        <article key={plan.nombre} className={plan.destacado ? "l-plan l-plan-destacado" : "l-plan"}>
                            <h3>{plan.nombre}</h3>
                            <p className="l-plan-precio">
                                <span className="l-plan-cifra">{plan.precio}</span>
                                <span className="l-tenue"> / mes</span>
                            </p>
                            <p className="l-plan-para">{plan.para}</p>
                            <ul className="l-lista-check">
                                {plan.incluye.map((item) => (
                                    <li key={item}>
                                        <Icon name="check" size={18} color="var(--pino-600)" />
                                        <span>{item}</span>
                                    </li>
                                ))}
                            </ul>
                            <Button
                                href={ENLACES[plan.accion.destino]}
                                variant={plan.destacado ? "primary" : "secondary"}
                                fullWidth
                            >
                                {plan.accion.texto}
                            </Button>
                        </article>
                    ))}
                </div>
            </div>
        </section>
    );
}
