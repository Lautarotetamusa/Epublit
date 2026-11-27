import bcrypt from "bcrypt";
import { NotFound } from "bradb";
import { Database } from "../../db/client";
import { readCSR, type AfipService } from "../../lib/afip/Afip";
import type { AfipData } from "../../lib/afip/afip.validator";
import type { EmailService } from "../../lib/email";
import { generarTokenSecreto, hashToken } from "../../lib/crypto/tokens";
import type { LimiteDeEnvios } from "../../lib/limiteDeEnvios";
import { UserRepository } from "./user.repository";
import { TipoTokenCuenta, TokenCuentaRepository } from "./tokenCuenta.repository";
import type { UserService } from "./user.service";
import { RegistroInput, User, normalizarEmail } from "./user.validator";
import { erroresDeAcceso } from "./user.errors";
import {
    ESPERA_ENTRE_ENVIOS_MS,
    VIGENCIA_CONFIRMACION_MS,
    VIGENCIA_RESTABLECER_MS,
    esPendiente,
    esPendienteVencida,
    limiteDePendientesVigentes,
    nombreDeCuenta,
    usernameVisible
} from "./user.acceso";

export type AccesoServiceDeps = {
    db: Database;
    repository: UserRepository;
    tokenRepository: TokenCuentaRepository;
    userService: Pick<UserService, "darDeAlta" | "eliminarCuenta">;
    afipService: Pick<AfipService, "getAfipData">;
    emailService: Pick<EmailService, "enviarBienvenida" | "enviarConfirmacionEmail" | "enviarRestablecimientoContrasena">;
    // Inyectada para que los tests adelanten el reloj en vez de esperar 24 h.
    ahora: () => Date;
    generarUsernameInterno: () => string;
    // Reenvíos de confirmación por cuenta y pedidos de restablecer por email.
    limiteDeReenvios: LimiteDeEnvios;
    limiteDeRestablecimientos: LimiteDeEnvios;
};

export type ResultadoConfirmacion = { status: "verified"; user: User } | { status: "already_verified" };

export type EstadoRestablecimiento = { status: "valid"; razon_social: string; username: string | null };

export function createAccesoService({
    db,
    repository,
    tokenRepository,
    userService,
    afipService,
    emailService,
    ahora,
    generarUsernameInterno,
    limiteDeReenvios,
    limiteDeRestablecimientos
}: AccesoServiceDeps) {
    // Una pendiente vencida se trata como inexistente en todas las rutas; la
    // limpieza periódica puede tardar hasta una hora en pasar.
    const descartarSiPendienteVencida = async (user: User | undefined): Promise<User | undefined> => {
        if (!user || !esPendienteVencida(user, ahora())) return user;

        await userService.eliminarCuenta(user);
        return undefined;
    };

    const emitirToken = async (userId: number, tipo: TipoTokenCuenta, vigenciaMs: number): Promise<string> => {
        const token = generarTokenSecreto();
        const creadoEn = ahora();

        await tokenRepository.insert({
            user: userId,
            tipo,
            hash: hashToken(token),
            creado_en: creadoEn,
            vence_en: new Date(creadoEn.getTime() + vigenciaMs)
        });
        return token;
    };

    // Los mails no frenan el flujo: la cuenta ya quedó en la base y el link
    // se puede volver a pedir.
    const registrarFalloDeEnvio = (mail: string, userId: number) => (error: unknown) =>
        console.error(`[email] no se pudo enviar ${mail}`, { userId, error });

    // Corre el plazo de borrado: la cuenta vence 24 h después del último link.
    const enviarLinkDeConfirmacion = async (user: User): Promise<void> => {
        await repository.persistUpdate({ id: user.id }, { confirmacion_enviada_en: ahora() });
        const token = await emitirToken(user.id, "confirmar_email", VIGENCIA_CONFIRMACION_MS);

        await emailService
            .enviarConfirmacionEmail({ para: user.email ?? "", nombre: user.razon_social, token })
            .catch(registrarFalloDeEnvio("la confirmación de email", user.id));
    };

    // Va al confirmar el email y no al registrarse: así el CSR llega a una
    // dirección comprobada. El CSR también se puede bajar desde el perfil.
    const enviarBienvenida = async (user: User): Promise<void> => {
        if (!user.email) return;

        await emailService
            .enviarBienvenida({ para: user.email, nombre: user.razon_social, cuit: user.cuit, csr: await readCSR(user.cuit) })
            .catch(registrarFalloDeEnvio("la bienvenida", user.id));
    };

    const consultarPadron = (cuit: string): Promise<AfipData> =>
        afipService.getAfipData(cuit).catch((error: unknown) => {
            throw error instanceof NotFound ? erroresDeAcceso.cuitFueraDelPadron() : erroresDeAcceso.padronCaido();
        });

    const usernameInternoLibre = async (): Promise<string> => {
        const username = generarUsernameInterno();
        return (await repository.existsByUsername(username)) ? usernameInternoLibre() : username;
    };

    // Una cuenta pendiente no retiene su email ni su CUIT (es el camino de
    // "¿te equivocaste de email?"); las confirmadas y las viejas sí.
    const cuentasAReemplazar = async ({ email, cuit }: Pick<RegistroInput, "email" | "cuit">): Promise<User[]> => {
        const conElEmail = await repository.findByEmail(email);
        if (conElEmail && !esPendiente(conElEmail)) throw erroresDeAcceso.emailTomado();

        const conElCuit = await repository.findByCuit(cuit);
        if (conElCuit.some((user) => !esPendiente(user))) throw erroresDeAcceso.cuitTomado();

        const pendientes = conElEmail ? [conElEmail, ...conElCuit] : conElCuit;
        return pendientes.filter((user, indice) => pendientes.findIndex((otra) => otra.id === user.id) === indice);
    };

    const register = async ({ email, password, cuit }: RegistroInput): Promise<{ email: string }> => {
        const reemplazadas = await cuentasAReemplazar({ email, cuit });
        const afipData = await consultarPadron(cuit);

        for (const pendiente of reemplazadas) {
            await userService.eliminarCuenta(pendiente);
        }

        const user = await userService.darDeAlta({
            email,
            cuit,
            password: await bcrypt.hash(password, 10),
            username: await usernameInternoLibre(),
            ...afipData,
            production: false,
            username_interno: true,
            email_confirmado: false
        });
        await enviarLinkDeConfirmacion(user);

        return { email };
    };

    const buscarPorIdentificador = (identifier: string): Promise<User | undefined> =>
        identifier.includes("@") ? repository.findByEmail(normalizarEmail(identifier)) : repository.findByUsername(identifier);

    const passwordCorrecta = async (user: User, password: string): Promise<boolean> =>
        bcrypt.compare(password, await repository.getPasswordHash(user.id));

    // Con contraseña incorrecta no se revela si la cuenta está sin confirmar.
    const authenticate = async (identifier: string, password: string): Promise<User> => {
        const user = await descartarSiPendienteVencida(await buscarPorIdentificador(identifier));
        if (!user || !(await passwordCorrecta(user, password))) throw erroresDeAcceso.credencialesInvalidas();
        if (esPendiente(user)) throw erroresDeAcceso.emailSinConfirmar(user.email);

        // El último ingreso se registra recién con la sesión ya habilitada:
        // fallos, confirmación de email y restablecimiento de contraseña no
        // cuentan como ingreso (ver specs/028-panel-admin-metricas).
        await repository.persistUpdate({ id: user.id }, { last_login_at: ahora() });

        return user;
    };

    const findUserDelToken = async (tipo: TipoTokenCuenta, token: string) => {
        const registro = token ? await tokenRepository.findByHash(tipo, hashToken(token)) : undefined;
        if (!registro) throw erroresDeAcceso.tokenInvalido();

        return { registro, user: await repository.findOne({ id: registro.user }) };
    };

    const verifyEmail = async (token: string): Promise<ResultadoConfirmacion> => {
        const { registro, user } = await findUserDelToken("confirmar_email", token);
        if (user.email_confirmado) return { status: "already_verified" };

        if (ahora() >= registro.vence_en) {
            if (!esPendienteVencida(user, ahora())) throw erroresDeAcceso.tokenVencido(user.email);

            await userService.eliminarCuenta(user);
            throw erroresDeAcceso.registroVencido();
        }

        const confirmada = await db.transaction(async (tx) => {
            await tokenRepository.markUsed(registro.id, ahora(), tx);
            return repository.stripPassword(await repository.persistUpdate({ id: user.id }, { email_confirmado: true }, tx));
        });
        await enviarBienvenida(confirmada);

        return { status: "verified", user: confirmada };
    };

    // El límite es por cuenta y cuenta también el mail del registro para la
    // espera mínima entre envíos.
    const puedeReenviar = (user: User): boolean => {
        const enviadaHaceMs = ahora().getTime() - (user.confirmacion_enviada_en?.getTime() ?? 0);
        return enviadaHaceMs >= ESPERA_ENTRE_ENVIOS_MS && limiteDeReenvios.registrarSiSePermite(String(user.id));
    };

    const resendVerification = async (email: string): Promise<void> => {
        const user = await descartarSiPendienteVencida(await repository.findByEmail(email));
        if (!user || !esPendiente(user)) return;
        if (!puedeReenviar(user)) throw erroresDeAcceso.demasiadosPedidos();

        await enviarLinkDeConfirmacion(user);
    };

    // El límite va antes de buscar la cuenta: si dependiera de que exista,
    // delataría qué emails tienen cuenta.
    const forgotPassword = async (email: string): Promise<void> => {
        if (!limiteDeRestablecimientos.registrarSiSePermite(email)) throw erroresDeAcceso.demasiadosPedidos();

        const user = await descartarSiPendienteVencida(await repository.findByEmail(email));
        if (!user) return;

        const token = await emitirToken(user.id, "restablecer_contrasena", VIGENCIA_RESTABLECER_MS);
        await emailService
            .enviarRestablecimientoContrasena({ para: email, cuenta: nombreDeCuenta(user), token })
            .catch(registrarFalloDeEnvio("el restablecimiento de contraseña", user.id));
    };

    // "Ya usado" gana sobre "vencido": el front muestra "ingresá con la nueva".
    const restablecimientoVigente = async (token: string) => {
        const { registro, user: encontrado } = await findUserDelToken("restablecer_contrasena", token);
        const user = await descartarSiPendienteVencida(encontrado);

        if (!user) throw erroresDeAcceso.tokenInvalido();
        if (registro.usado_en) throw erroresDeAcceso.tokenUsado();
        if (ahora() >= registro.vence_en) throw erroresDeAcceso.tokenVencido(user.email);

        return user;
    };

    const getResetPasswordStatus = async (token: string): Promise<EstadoRestablecimiento> => {
        const user = await restablecimientoVigente(token);
        return { status: "valid", razon_social: user.razon_social, username: usernameVisible(user) };
    };

    // Abrir el link demuestra que controla el correo: si la cuenta nueva no
    // estaba confirmada, queda confirmada (y sale la bienvenida).
    const resetPassword = async (token: string, password: string): Promise<User> => {
        const user = await restablecimientoVigente(token);
        const confirmaAhora = esPendiente(user);

        const hash = await bcrypt.hash(password, 10);
        const actualizada = await db.transaction(async (tx) => {
            await tokenRepository.markAllUnusedAsUsed(user.id, "restablecer_contrasena", ahora(), tx);
            return repository.stripPassword(await repository.persistUpdate({ id: user.id }, { password: hash, email_confirmado: true }, tx));
        });
        if (confirmaAhora) await enviarBienvenida(actualizada);

        return actualizada;
    };

    // Un error al borrar una cuenta no frena el resto ni tira el proceso.
    const limpiarPendientesVencidas = async (): Promise<void> => {
        const vencidas = await repository.findPendientesVencidas(limiteDePendientesVigentes(ahora()));

        for (const user of vencidas) {
            await userService
                .eliminarCuenta(user)
                .catch((error: unknown) => console.error("[cuentas] no se pudo borrar la pendiente vencida", { userId: user.id, error }));
        }
    };

    return {
        register,
        authenticate,
        verifyEmail,
        resendVerification,
        forgotPassword,
        getResetPasswordStatus,
        resetPassword,
        limpiarPendientesVencidas
    };
}

export type AccesoService = ReturnType<typeof createAccesoService>;
