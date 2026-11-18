import { Link } from "react-router-dom";
import type { Articulo, Captura } from "../tipos";
import { Archivo, Etiqueta, Nota, Ruta } from "../TextoArticulo";

const SLUG = "certificado-arca";

const captura = (archivo: string, alt: string, ancho: number, alto: number, pie?: Captura["pie"]): Captura => ({
    src: `/ayuda/${SLUG}/${archivo}`,
    alt,
    ancho,
    alto,
    pie
});

const enlacePerfil = <Link to="/perfil">tu perfil de Epublit</Link>;

export const certificadoArca: Articulo = {
    slug: SLUG,
    titulo: "Cómo generar tu certificado de ARCA para facturar",
    resumen:
        "Habilitá el servicio de certificados en ARCA, generá el certificado con el archivo CSR de tu cuenta y creá el punto de venta para emitir facturas electrónicas desde Epublit.",
    tema: "Facturación electrónica",
    actualizado: "17/11/2026",
    requisitos: [
        <>Tu CUIT y tu clave fiscal de ARCA (ex AFIP), con nivel 3 o superior.</>,
        <>
            El archivo <Archivo>cert.csr</Archivo> de tu cuenta. Lo descargás desde {enlacePerfil}, en la tarjeta{" "}
            <Etiqueta>Facturación electrónica</Etiqueta>, con el botón <Etiqueta>Descargar CSR</Etiqueta>. También te
            llegó adjunto en el mail de bienvenida.
        </>,
        <>Saber si tu editorial es monotributista o responsable inscripta: de eso depende el punto de venta que vas a crear.</>
    ],
    secciones: [
        {
            id: "habilitar-servicio",
            titulo: "Habilitar la administración de certificados",
            intro: (
                <>
                    Si en tu escritorio de ARCA ya tenés <Etiqueta>Administración de Certificados Digitales</Etiqueta>,
                    salteá esta parte y pasá a <a href="#generar-certificado">Generar el certificado</a>.
                </>
            ),
            pasos: [
                {
                    contenido: (
                        <>
                            Ingresá a ARCA con tu clave fiscal y, en el inicio, abrí{" "}
                            <Etiqueta>Administrador de relaciones</Etiqueta>.
                        </>
                    ),
                    capturas: [
                        captura(
                            "01-administrador-de-relaciones.png",
                            "Inicio de ARCA con el acceso «Administrador de relaciones» señalado",
                            768,
                            363
                        )
                    ]
                },
                {
                    contenido: (
                        <>
                            Si administrás más de un contribuyente, ARCA te pide elegir con cuál vas a operar: elegí el de tu
                            editorial. Si no, te elige a vos automáticamente y seguís de largo.
                        </>
                    ),
                    capturas: [
                        captura(
                            "02-elegir-contribuyente.png",
                            "Administrador de relaciones pidiendo seleccionar el contribuyente",
                            768,
                            363
                        )
                    ]
                },
                {
                    contenido: (
                        <>
                            Hacé clic en <Etiqueta>Adherir servicio</Etiqueta>.
                        </>
                    ),
                    capturas: [
                        captura("03-adherir-servicio.png", "Botón «Adherir servicio» en el Administrador de relaciones", 768, 363)
                    ]
                },
                {
                    contenido: (
                        <>
                            En la lista de servicios, abrí{" "}
                            <Ruta tramos={["ARCA", "Servicios interactivos", "Administración de Certificados Digitales"]} />.
                        </>
                    ),
                    capturas: [
                        captura(
                            "04-elegir-servicio.png",
                            "Lista de servicios interactivos de ARCA con «Administración de Certificados Digitales» señalado",
                            768,
                            363
                        )
                    ]
                },
                {
                    contenido: (
                        <>
                            Revisá los datos y hacé clic en <Etiqueta>Confirmar</Etiqueta>. Desde ahora el servicio aparece en
                            tu escritorio de ARCA.
                        </>
                    ),
                    capturas: [
                        captura("05-confirmar-servicio.png", "Pantalla «Incorporar nueva relación» con el botón «Confirmar»", 768, 363)
                    ]
                }
            ]
        },
        {
            id: "generar-certificado",
            titulo: "Generar el certificado",
            intro: (
                <>
                    Acá le das a ARCA el archivo <Archivo>cert.csr</Archivo> de tu cuenta y ARCA te devuelve tu certificado,
                    el archivo <Archivo>cert.pem</Archivo>.
                </>
            ),
            pasos: [
                {
                    contenido: (
                        <>
                            En el inicio de ARCA, buscá y abrí <Etiqueta>Administración de Certificados Digitales</Etiqueta>.
                        </>
                    ),
                    capturas: [
                        captura(
                            "06-buscar-certificados.png",
                            "Buscador de ARCA con el resultado «Administración de Certificados Digitales»",
                            768,
                            363
                        )
                    ]
                },
                {
                    contenido: (
                        <>
                            Hacé clic en <Etiqueta>Agregar alias</Etiqueta>.
                        </>
                    ),
                    capturas: [
                        captura("07-agregar-alias.png", "Listado de certificados con el botón «Agregar alias»", 768, 363)
                    ]
                },
                {
                    contenido: (
                        <>
                            En <Etiqueta>Alias</Etiqueta> escribí <Archivo>Epublit</Archivo>. Después hacé clic en{" "}
                            <Etiqueta>Examinar</Etiqueta>, elegí el archivo <Archivo>cert.csr</Archivo> y confirmá con{" "}
                            <Etiqueta>Agregar alias</Etiqueta>.
                            <Nota>
                                ¿No encontrás el <Archivo>cert.csr</Archivo>? Descargalo de nuevo desde {enlacePerfil}, en{" "}
                                <Etiqueta>Facturación electrónica</Etiqueta>, o buscalo adjunto en el mail de bienvenida.
                            </Nota>
                        </>
                    ),
                    capturas: [
                        captura("08-alias-y-csr.png", "Formulario de alias con el campo «Alias» y el botón «Examinar»", 768, 363)
                    ]
                },
                {
                    contenido: (
                        <>
                            Volvés a la lista de certificados. Buscá el alias <Archivo>Epublit</Archivo> y hacé clic en{" "}
                            <Etiqueta>Ver</Etiqueta>.
                        </>
                    ),
                    capturas: [
                        captura(
                            "09-ver-alias.png",
                            "Listado de certificados con la opción «Ver» de un alias señalada",
                            768,
                            363,
                            "En la captura el alias se llama «facturador1»; en tu cuenta va a decir «Epublit»."
                        )
                    ]
                },
                {
                    contenido: (
                        <>
                            Hacé clic en el ícono de <Etiqueta>Descargar</Etiqueta>. Se baja el archivo{" "}
                            <Archivo>cert.pem</Archivo>: ése es tu certificado.
                        </>
                    ),
                    capturas: [
                        captura(
                            "10-descargar-certificado.png",
                            "Detalle del certificado con el ícono de descarga señalado",
                            768,
                            363
                        )
                    ]
                },
                {
                    contenido: (
                        <>
                            Entrá a {enlacePerfil} y, en la tarjeta <Etiqueta>Facturación electrónica</Etiqueta>, hacé clic en{" "}
                            <Etiqueta>Subir certificado</Etiqueta> y elegí el <Archivo>cert.pem</Archivo> que acabás de
                            descargar.
                        </>
                    )
                }
            ]
        },
        {
            id: "punto-de-venta",
            titulo: "Crear el punto de venta",
            intro: (
                <>
                    Para emitir facturas electrónicas necesitás un punto de venta habilitado para web services. Si ya tenés
                    uno de ese tipo, anotá su número y pasá al último paso.
                </>
            ),
            pasos: [
                {
                    contenido: (
                        <>
                            En el inicio de ARCA, buscá y abrí{" "}
                            <Etiqueta>Administración de puntos de venta y domicilios</Etiqueta>.
                        </>
                    ),
                    capturas: [
                        captura(
                            "11-buscar-puntos-de-venta.png",
                            "Buscador de ARCA con el resultado «Administración de puntos de venta y domicilios»",
                            768,
                            363
                        )
                    ]
                },
                {
                    contenido: (
                        <>
                            Entrá a <Etiqueta>A/B/M de puntos de venta</Etiqueta> y agregá un punto de venta nuevo. Completá el
                            número y, en <Etiqueta>Sistema</Etiqueta>, elegí la opción que corresponde a tu condición frente al
                            IVA:
                            <dl className="ayuda-opciones">
                                <dt>Monotributo</dt>
                                <dd>
                                    <Etiqueta>Factura Electrónica - Monotributo - Web Service</Etiqueta>
                                </dd>
                                <dt>Responsable inscripto</dt>
                                <dd>
                                    <Etiqueta>RECE para aplicativo y web services</Etiqueta>
                                </dd>
                            </dl>
                            Anotá el número del punto de venta: lo vas a cargar en Epublit.
                        </>
                    ),
                    capturas: [
                        captura(
                            "12-punto-de-venta-monotributo.png",
                            "Alta de punto de venta con el sistema «Factura Electrónica - Monotributo - Web Services»",
                            534,
                            268,
                            "Monotributo."
                        ),
                        captura(
                            "13-punto-de-venta-responsable-inscripto.png",
                            "Alta de punto de venta con el sistema «RECE para aplicativo y web services»",
                            563,
                            306,
                            "Responsable inscripto."
                        )
                    ]
                },
                {
                    contenido: (
                        <>
                            Entrá a {enlacePerfil} y, en la tarjeta <Etiqueta>Facturación electrónica</Etiqueta>, hacé clic en{" "}
                            <Etiqueta>Cargar</Etiqueta> junto a <Etiqueta>Punto de venta</Etiqueta>, escribí el número y guardá.
                        </>
                    )
                }
            ]
        }
    ],
    cierre: {
        titulo: "Listo para facturar",
        texto: "Con el certificado subido y el punto de venta cargado, la tarjeta Facturación electrónica de tu perfil te confirma que la cuenta está lista para facturar.",
        accion: { etiqueta: "Ir a mi perfil", ruta: "/perfil" }
    }
};
