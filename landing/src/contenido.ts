// Todo lo que se afirma acá está verificado contra front/src/features y
// specs/ (ver specs/025-landing/design.md). Si algo deja de existir en el
// sistema, se saca de esta lista: la landing no promete funcionalidades.

export type FuncionalidadId = "catalogo" | "stock" | "librerias" | "facturacion" | "derechos" | "numeros" | "tienda";

export interface Funcionalidad {
    id: FuncionalidadId;
    icono: string;
    nombre: string;
    resumen: string;
    titulo: string;
    bajada: string;
    puntos: string[];
}

export const FUNCIONALIDADES: Funcionalidad[] = [
    {
        id: "catalogo",
        icono: "book-open",
        nombre: "Catálogo",
        resumen: "Fichas completas, colecciones, autores e ilustradores.",
        titulo: "Cada título se carga una vez.",
        bajada:
            "La ficha del libro es la base de todo lo demás: lo que cargás acá es lo que aparece en el remito, en la factura, en la liquidación y en tu tienda.",
        puntos: [
            "ISBN, precio, fecha de edición, páginas, medidas, peso y edad recomendada.",
            "Tipo de edición (normal, pop up o cartoné), brief, book trailer y portada.",
            "Autores, ilustradores y los roles que uses, con foto, biografía y porcentaje por libro.",
            "Colecciones, reseñas enlazadas y libros ocultos en el sitio sin sacarlos del catálogo."
        ]
    },
    {
        id: "stock",
        icono: "boxes",
        nombre: "Stock por depósito",
        resumen: "Ingresos, bajas y transferencias con historial.",
        titulo: "Sabés dónde está cada ejemplar.",
        bajada:
            "El stock de un libro es la suma de sus depósitos. Cada ingreso, baja o traslado queda en un historial único, junto con las ventas, consignaciones y devoluciones.",
        puntos: [
            "Depósitos propios, con el desglose de cada título.",
            "Ingresos desde imprenta, bajas y transferencias entre depósitos, de varios libros a la vez.",
            "Elegís desde qué depósito sale cada venta.",
            "El stock no se corrige a mano: cada cambio es un movimiento con fecha, en un historial filtrable."
        ]
    },
    {
        id: "librerias",
        icono: "truck",
        nombre: "Consignaciones",
        resumen: "Librerías, remitos, ventas y devoluciones.",
        titulo: "Consignás, vendés y recibís devoluciones sin perder la cuenta.",
        bajada:
            "Cada cliente tiene su propio depósito: lo que le dejaste en consignación sigue siendo tuyo y se ve en su ficha hasta que se vende o vuelve.",
        puntos: [
            "Clientes inscriptos, consumidor final y mostrador, cada uno con su ficha.",
            "Venta en firme, consignación, venta sobre consignación y devolución.",
            "Remito imprimible en cada consignación y devolución.",
            "Desde la ficha del cliente elegís varios libros y armás la venta o la devolución de una vez.",
            "Medios de pago propios con su comisión, para ver el neto real de cada venta."
        ]
    },
    {
        id: "facturacion",
        icono: "receipt-text",
        nombre: "Facturación ARCA",
        resumen: "Facturas electrónicas A, B, C y M con CAE.",
        titulo: "Facturás ante ARCA desde la misma venta.",
        bajada:
            "Subís tu certificado de ARCA desde el perfil y la venta emite la factura electrónica con su CAE. La letra sale de tu condición frente al IVA, no hay que elegirla cada vez.",
        puntos: [
            "Facturas A, B, C y M, con la letra que corresponde a cada operación.",
            "Comprobantes guardados con sus datos fiscales, para consultarlos y reimprimirlos.",
            "Imprimís o guardás en PDF facturas y remitos desde el navegador.",
            "Una guía paso a paso para generar el certificado en el centro de ayuda."
        ]
    },
    {
        id: "derechos",
        icono: "percent",
        nombre: "Derechos de autor",
        resumen: "Liquidaciones con anticipos y pagos parciales.",
        titulo: "Liquidás derechos de autor sin una planilla aparte.",
        bajada:
            "Elegís el período y Epublit calcula cuánto le corresponde a cada persona por libro y por rol, con las ventas reales. Las mismas ventas no se liquidan dos veces.",
        puntos: [
            "Anticipos por lanzamiento que se descuentan de las regalías siguientes.",
            "Pagos parciales: se ve cuánto va pagado y cuánto falta.",
            "Reporte por autor con los ejemplares vendidos de cada título, listo para imprimir y mandar.",
            "Búsqueda por persona y filtro de libros dentro de cada liquidación."
        ]
    },
    {
        id: "numeros",
        icono: "chart-line",
        nombre: "Métricas",
        resumen: "Ingreso y ventas del mes por título, cliente y depósito.",
        titulo: "Ves qué se vende, dónde y cuánto entra.",
        bajada:
            "El inicio es un panel del mes: ingreso, ejemplares y la diferencia contra el mes anterior, con el detalle por título, por cliente y por depósito.",
        puntos: [
            "Ingreso de los últimos meses y por medio de pago.",
            "Los títulos, clientes y depósitos que más venden.",
            "Ventas filtrables por cliente, tipo, fecha y medio de pago."
        ]
    },
    {
        id: "tienda",
        icono: "store",
        nombre: "Tienda online",
        resumen: "Pedidos y cobro con Mercado Pago sobre tu catálogo.",
        titulo: "Vendés en tu propia tienda con el mismo catálogo.",
        bajada:
            "Tu sitio se conecta a Epublit con una clave de integración: muestra tus libros, precios y stock, y los pedidos entran al panel para que los gestiones como cualquier venta.",
        puntos: [
            "Cobro con Mercado Pago conectado a tu propia cuenta.",
            "Pedidos con su estado: aceptar genera la venta y la factura.",
            "Los libros ocultos no aparecen en la tienda.",
            "Páginas institucionales editables por bloques (texto, imágenes, galerías, citas), con borrador y vista previa."
        ]
    }
];

export interface Plan {
    nombre: string;
    precio: string;
    para: string;
    incluye: string[];
    accion: { texto: string; destino: "registrarse" | "contactarVentas" };
    destacado?: boolean;
}

// Precios, límites y features tal cual la landing anterior: son decisiones
// comerciales, no se tocan desde acá (preguntas abiertas en design.md).
export const PLANES: Plan[] = [
    {
        nombre: "Básico",
        precio: "$ 0",
        para: "Para editoriales chicas o independientes.",
        incluye: ["Hasta 30 títulos", "Gestión de stock"],
        accion: { texto: "Crear cuenta", destino: "registrarse" }
    },
    {
        nombre: "Profesional",
        precio: "$ 27.000",
        para: "Para editoriales en crecimiento.",
        incluye: ["Todo lo del plan Básico", "Hasta 200 títulos", "Reportes personalizados", "Facturación automática"],
        accion: { texto: "Crear cuenta", destino: "registrarse" },
        destacado: true
    },
    {
        nombre: "Empresarial",
        precio: "$ 49.000",
        para: "Para editoriales con catálogo grande.",
        incluye: ["Todo lo del plan Profesional", "Títulos ilimitados", "Soporte prioritario"],
        accion: { texto: "Contactar ventas", destino: "contactarVentas" }
    }
];

export interface Pregunta {
    pregunta: string;
    respuesta: string;
}

export const PREGUNTAS: Pregunta[] = [
    {
        pregunta: "¿Tengo que instalar algo?",
        respuesta:
            "No. Epublit funciona en el navegador, desde la computadora de la oficina o la del depósito. Entrás con tu usuario y tu editorial está ahí."
    },
    {
        pregunta: "¿El plan Básico es gratis?",
        respuesta:
            "Sí, cuesta $ 0 por mes y alcanza para un catálogo de hasta 30 títulos. Para crear la cuenta no te pedimos tarjeta."
    },
    {
        pregunta: "¿Qué necesito para facturar electrónicamente?",
        respuesta:
            "Tu CUIT, un punto de venta dado de alta en ARCA como Web Service y el certificado digital. El certificado se genera en ARCA y se sube desde tu perfil; en el centro de ayuda está el paso a paso."
    },
    {
        pregunta: "¿Cómo se lleva la consignación en las librerías?",
        respuesta:
            "Cada librería es un cliente con su propio depósito. Cuando consignás, los ejemplares pasan a ese depósito con su remito; cuando la librería informa ventas, las registrás como venta sobre consignación, y lo que vuelve entra como devolución."
    },
    {
        pregunta: "¿La tienda online viene armada?",
        respuesta:
            "Epublit pone el catálogo, el stock, los pedidos y el cobro con Mercado Pago. La tienda que ve el lector es tu sitio, conectado con una clave de integración. Si no tenés sitio, escribinos y lo vemos."
    }
];
