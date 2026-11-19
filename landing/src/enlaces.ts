// La landing se deploya aparte (epublit.com.ar) y apunta al SPA. Se puede
// sobreescribir en local con VITE_APP_URL para probar contra el front en dev.
const APP_URL = (import.meta.env.VITE_APP_URL as string | undefined) ?? "https://app.epublit.com.ar";

export const ENLACES = {
    iniciarSesion: `${APP_URL}/`,
    registrarse: `${APP_URL}/register`,
    ayuda: `${APP_URL}/ayuda`,
    guiaCertificadoArca: `${APP_URL}/ayuda/certificado-arca`,
    thorque: "https://thorque.com.ar"
};
