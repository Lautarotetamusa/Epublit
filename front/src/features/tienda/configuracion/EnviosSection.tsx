import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Alert, Badge, Button, Checkbox, Field, Input, Select } from "../../../design-system";
import { useToast } from "../../../notifications/ToastProvider";
import { sanitizeDecimal } from "../../../lib/numericInput";
import { getErrorMessage } from "../../../lib/errors";
import { PROVINCIAS_ARGENTINA } from "../../../lib/provincias";
import { enviosFormDesdeConfig, useEnviosConfig } from "./useEnviosConfig";
import type { EnviosForm } from "./useEnviosConfig";

const numeroValido = (valor: string): boolean => Number.isFinite(Number(valor)) && Number(valor) > 0;

// Envíos: la cuenta de MiCorreo, la de PAQ.AR, el peso de respaldo, la caja
// default, el domicilio de origen y el retiro en local. Todo se guarda junto:
// cada dato afecta la cotización o la etiqueta del checkout.
export function EnviosSection() {
    const { showToast } = useToast();
    const { config, loading, error, refetch, guardar, probar } = useEnviosConfig();
    const [form, setForm] = useState<EnviosForm>(() => enviosFormDesdeConfig(null));
    const [probando, setProbando] = useState<"micorreo" | "paqar" | null>(null);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (config) setForm(enviosFormDesdeConfig(config));
    }, [config]);

    const actualizar = (patch: Partial<EnviosForm>) => setForm((actual) => ({ ...actual, ...patch }));

    const pesoInvalido = !numeroValido(form.pesoPromedio);
    const cajaInvalida = !numeroValido(form.altoCm) || !numeroValido(form.anchoCm) || !numeroValido(form.largoCm);
    const retiroIncompleto = form.retiroActivo && (form.direccionRetiro.trim() === "" || form.horarioRetiro.trim() === "");
    const origenRequeridos = [form.calle, form.numero, form.localidad, form.provincia, form.codigoPostal];
    const origenParcial =
        origenRequeridos.some((valor) => valor.trim() !== "") && origenRequeridos.some((valor) => valor.trim() === "");
    const puedeGuardar = !pesoInvalido && !cajaInvalida && !retiroIncompleto && !origenParcial;

    const probarConexion = async (apiName: "micorreo" | "paqar") => {
        setProbando(apiName);
        try {
            const resultado = await probar(apiName);
            showToast(resultado.ok ? "success" : "warning", resultado.mensaje);
        } catch (err) {
            showToast("error", getErrorMessage(err));
        } finally {
            setProbando(null);
        }
    };

    const handleGuardar = async (event: FormEvent) => {
        event.preventDefault();
        if (!puedeGuardar) {
            showToast("warning", "Revisá el peso, la caja, el domicilio de origen y el retiro antes de guardar.");
            return;
        }

        setSaving(true);
        try {
            const actualizado = await guardar(form);
            setForm(enviosFormDesdeConfig(actualizado));
            showToast("success", "Configuración de envíos guardada.");
        } catch (err) {
            showToast("error", getErrorMessage(err));
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return <p style={{ margin: 0, color: "var(--text-muted)", fontSize: "var(--text-sm)" }}>Cargando la configuración de envíos…</p>;
    }

    if (error || !config) {
        return (
            <Alert tone="error" title="No pudimos cargar la configuración de envíos">
                {error ?? "No se pudo leer la configuración."}
                <div style={{ marginTop: "var(--space-3)" }}>
                    <Button variant="secondary" size="sm" iconStart="arrow-right" onClick={refetch}>
                        Reintentar
                    </Button>
                </div>
            </Alert>
        );
    }

    return (
        <form onSubmit={handleGuardar} style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
            <Alert tone="info" title="El envío se cotiza al comprar">
                MiCorreo calcula el costo según el domicilio del comprador y el peso de los libros; si un libro no tiene peso cargado, usa el
                promedio configurado para la cuenta. PAQ.AR genera el envío y la etiqueta una vez aceptado el pedido. El comprador elige envío o
                retiro en local antes de pagar.
            </Alert>

            <section style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
                <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "var(--space-3)" }}>
                    <div>
                        <h4 style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: "var(--text-md)", fontWeight: "var(--weight-semibold)" }}>
                            MiCorreo
                        </h4>
                        <p style={{ margin: "4px 0 0", fontSize: "var(--text-sm)", color: "var(--text-muted)" }}>
                            La cuenta histórica de MiCorreo. PAQ.AR es el proveedor que genera las etiquetas.
                        </p>
                    </div>
                    <Badge tone={config.micorreo.configurado ? "success" : "warning"} dot>
                        {config.micorreo.configurado ? "Configurado" : "Falta configurar"}
                    </Badge>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "var(--space-4)" }}>
                    <Field label="Usuario">
                        <Input
                            value={form.usuario}
                            onChange={(e) => actualizar({ usuario: e.target.value })}
                            placeholder="Usuario de MiCorreo"
                        />
                    </Field>
                    <Field
                        label="Contraseña"
                        hint={
                            config.micorreo.configurado
                                ? "Dejá vacío para mantener la credencial actual."
                                : "La credencial que te dio MiCorreo."
                        }
                    >
                        <Input
                            type="password"
                            value={form.password}
                            onChange={(e) => actualizar({ password: e.target.value })}
                            placeholder={config.micorreo.configurado ? "••••••••" : ""}
                            autoComplete="new-password"
                        />
                    </Field>
                    <Field label="Customer ID" hint="El identificador de cliente que devuelve MiCorreo.">
                        <Input value={form.customerId} onChange={(e) => actualizar({ customerId: e.target.value })} />
                    </Field>
                </div>

                <div>
                    <Button
                        type="button"
                        variant="secondary"
                        iconStart="check"
                        onClick={() => probarConexion("micorreo")}
                        loading={probando === "micorreo"}
                        disabled={probando !== null}
                    >
                        Probar conexión
                    </Button>
                    <p style={{ margin: "var(--space-2) 0 0", fontSize: "var(--text-2xs)", color: "var(--text-subtle)" }}>
                        Prueba la última configuración guardada, no los cambios sin guardar.
                    </p>
                </div>
            </section>

            <div style={{ borderTop: "1px solid var(--border-subtle)" }} />

            <section style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
                <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "var(--space-3)" }}>
                    <div>
                        <h4 style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: "var(--text-md)", fontWeight: "var(--weight-semibold)" }}>
                            PAQ.AR
                        </h4>
                        <p style={{ margin: "4px 0 0", fontSize: "var(--text-sm)", color: "var(--text-muted)" }}>
                            El acuerdo y la API key con los que se crean los envíos y las etiquetas.
                        </p>
                    </div>
                    <Badge tone={config.paqar.configurado ? "success" : "warning"} dot>
                        {config.paqar.configurado ? "Configurado" : "Falta configurar"}
                    </Badge>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "var(--space-4)" }}>
                    <Field label="Agreement" hint="El número de acuerdo que te dio PAQ.AR.">
                        <Input value={form.agreement} onChange={(e) => actualizar({ agreement: e.target.value })} />
                    </Field>
                    <Field
                        label="API key"
                        hint={
                            config.paqar.configurado
                                ? "Dejá vacío para conservar la clave actual. Sólo se envía si escribís una nueva."
                                : "La API key que te dio PAQ.AR."
                        }
                    >
                        <Input
                            type="password"
                            value={form.apiKey}
                            onChange={(e) => actualizar({ apiKey: e.target.value })}
                            placeholder={config.paqar.configurado ? "••••••••" : ""}
                            autoComplete="new-password"
                        />
                    </Field>
                    <Field label="Seller ID">
                        <Input value={form.sellerId} onChange={(e) => actualizar({ sellerId: e.target.value })} />
                    </Field>
                </div>

                <div>
                    <Button
                        type="button"
                        variant="secondary"
                        iconStart="check"
                        onClick={() => probarConexion("paqar")}
                        loading={probando === "paqar"}
                        disabled={probando !== null}
                    >
                        Probar conexión
                    </Button>
                    <p style={{ margin: "var(--space-2) 0 0", fontSize: "var(--text-2xs)", color: "var(--text-subtle)" }}>
                        Prueba la última configuración guardada, no los cambios sin guardar.
                    </p>
                </div>
            </section>

            <div style={{ borderTop: "1px solid var(--border-subtle)" }} />

            <section style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
                <div>
                    <h4 style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: "var(--text-md)", fontWeight: "var(--weight-semibold)" }}>
                        Peso y caja para cotizar
                    </h4>
                    <p style={{ margin: "4px 0 0", fontSize: "var(--text-sm)", color: "var(--text-muted)" }}>
                        El peso promedio se usa como respaldo para los libros sin peso cargado. La caja es la medida default para la etiqueta.
                    </p>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "var(--space-4)" }}>
                    <Field
                        label="Peso promedio por libro (kg)"
                        error={pesoInvalido ? "El peso promedio tiene que ser mayor a 0." : undefined}
                    >
                        <Input
                            type="text"
                            inputMode="decimal"
                            suffix="kg"
                            invalid={pesoInvalido}
                            value={form.pesoPromedio}
                            onChange={(e) => actualizar({ pesoPromedio: sanitizeDecimal(e.target.value) })}
                        />
                    </Field>
                    <Field label="Caja: alto" error={!numeroValido(form.altoCm) ? "Mayor a 0." : undefined}>
                        <Input
                            type="text"
                            inputMode="decimal"
                            suffix="cm"
                            invalid={!numeroValido(form.altoCm)}
                            value={form.altoCm}
                            onChange={(e) => actualizar({ altoCm: sanitizeDecimal(e.target.value) })}
                        />
                    </Field>
                    <Field label="Caja: ancho" error={!numeroValido(form.anchoCm) ? "Mayor a 0." : undefined}>
                        <Input
                            type="text"
                            inputMode="decimal"
                            suffix="cm"
                            invalid={!numeroValido(form.anchoCm)}
                            value={form.anchoCm}
                            onChange={(e) => actualizar({ anchoCm: sanitizeDecimal(e.target.value) })}
                        />
                    </Field>
                    <Field label="Caja: largo" error={!numeroValido(form.largoCm) ? "Mayor a 0." : undefined}>
                        <Input
                            type="text"
                            inputMode="decimal"
                            suffix="cm"
                            invalid={!numeroValido(form.largoCm)}
                            value={form.largoCm}
                            onChange={(e) => actualizar({ largoCm: sanitizeDecimal(e.target.value) })}
                        />
                    </Field>
                </div>
            </section>

            <div style={{ borderTop: "1px solid var(--border-subtle)" }} />

            <section style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
                <div>
                    <h4 style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: "var(--text-md)", fontWeight: "var(--weight-semibold)" }}>
                        Domicilio de origen
                    </h4>
                    <p style={{ margin: "4px 0 0", fontSize: "var(--text-sm)", color: "var(--text-muted)" }}>
                        Desde acá salen los envíos y se calcula la distancia.
                    </p>
                </div>

                {origenParcial ? (
                    <Alert tone="warning" title="Domicilio incompleto">
                        Completá calle, número, localidad, provincia y código postal, o dejá todo el bloque vacío.
                    </Alert>
                ) : null}

                <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: "var(--space-4)" }}>
                    <Field label="Calle">
                        <Input value={form.calle} onChange={(e) => actualizar({ calle: e.target.value })} />
                    </Field>
                    <Field label="Número">
                        <Input value={form.numero} onChange={(e) => actualizar({ numero: e.target.value })} />
                    </Field>
                    <Field label="Piso / depto." hint="Opcional">
                        <Input value={form.piso} onChange={(e) => actualizar({ piso: e.target.value })} />
                    </Field>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "var(--space-4)" }}>
                    <Field label="Localidad">
                        <Input value={form.localidad} onChange={(e) => actualizar({ localidad: e.target.value })} />
                    </Field>
                    <Field label="Provincia">
                        <Select
                            value={form.provincia}
                            onChange={(e) => actualizar({ provincia: e.target.value })}
                            options={PROVINCIAS_ARGENTINA}
                            placeholder="Elegí una provincia"
                        />
                    </Field>
                    <Field label="Código postal">
                        <Input value={form.codigoPostal} onChange={(e) => actualizar({ codigoPostal: e.target.value })} />
                    </Field>
                </div>
            </section>

            <div style={{ borderTop: "1px solid var(--border-subtle)" }} />

            <section style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
                <div>
                    <h4 style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: "var(--text-md)", fontWeight: "var(--weight-semibold)" }}>
                        Retiro en local
                    </h4>
                    <p style={{ margin: "4px 0 0", fontSize: "var(--text-sm)", color: "var(--text-muted)" }}>
                        Si está activo, el comprador puede retirar sin costo. El stock se reserva igual al crear el pedido.
                    </p>
                </div>

                <Checkbox
                    checked={form.retiroActivo}
                    label="Permitir retiro en local"
                    onChange={(e) => actualizar({ retiroActivo: e.target.checked })}
                />

                {form.retiroActivo ? (
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "var(--space-4)" }}>
                        <Field
                            label="Dirección de retiro"
                            hint="Se muestra en el checkout y en el pedido."
                            required
                            error={retiroIncompleto && form.direccionRetiro.trim() === "" ? "La dirección es obligatoria." : undefined}
                        >
                            <Input
                                value={form.direccionRetiro}
                                invalid={retiroIncompleto && form.direccionRetiro.trim() === ""}
                                onChange={(e) => actualizar({ direccionRetiro: e.target.value })}
                            />
                        </Field>
                        <Field
                            label="Horario de retiro"
                            required
                            error={retiroIncompleto && form.horarioRetiro.trim() === "" ? "El horario es obligatorio." : undefined}
                        >
                            <Input
                                value={form.horarioRetiro}
                                invalid={retiroIncompleto && form.horarioRetiro.trim() === ""}
                                onChange={(e) => actualizar({ horarioRetiro: e.target.value })}
                                placeholder="Lunes a sábados, de 10 a 19 h"
                            />
                        </Field>
                    </div>
                ) : (
                    <p style={{ margin: 0, fontSize: "var(--text-sm)", color: "var(--text-subtle)" }}>
                        Los compradores sólo pueden elegir envío a domicilio.
                    </p>
                )}
            </section>

            <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <Button type="submit" loading={saving} disabled={!puedeGuardar}>
                    Guardar configuración
                </Button>
            </div>
        </form>
    );
}
