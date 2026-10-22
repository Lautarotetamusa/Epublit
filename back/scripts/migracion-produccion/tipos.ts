export type TipoTransaccion = "venta" | "consignacion" | "ventaConsignacion" | "devolucion";

export type MedioPagoNombre = "efectivo" | "debito" | "credito" | "mercadopago" | "transferencia";

export type UsuarioOrigen = {
    id: number;
    username: string;
    password: string;
    cuit: string;
    cond_fiscal: string;
    razon_social: string;
    domicilio: string;
    production: boolean;
    email: string;
    ingresos_brutos: boolean;
    fecha_inicio: string;
    punto_venta: number | null;
};

export type ClienteOrigen = {
    id: number;
    nombre: string;
    email: string;
    cuit: string | null;
    cond_fiscal: string;
    razon_social: string;
    domicilio: string;
    tipo: "inscripto" | "particular" | "negro" | null;
    user: number;
};

export type PersonaOrigen = {
    id: number;
    dni: string;
    nombre: string;
    email: string;
    is_deleted: boolean;
    user: number;
};

export type LibroOrigen = {
    id_libro: number;
    isbn: string;
    titulo: string;
    fecha_edicion: string;
    precio: number;
    stock: number;
    is_deleted: boolean;
    user: number;
};

export type PrecioLibroOrigen = {
    id: number;
    isbn: string;
    precio: number;
    created_at: string;
    user: number;
    id_libro: number;
};

export type PrecioLibroClienteOrigen = {
    id: number;
    id_libro: number;
    id_cliente: number;
    precio: number;
    created_at: string;
};

export type LibroClienteOrigen = {
    id_cliente: number;
    isbn: string;
    stock: number;
    id_libro: number;
    precio: number;
};

export type LibroPersonaOrigen = {
    isbn: string;
    id_persona: number;
    porcentaje: number;
    tipo: "autor" | "ilustrador";
    id_libro: number;
};

export type TransaccionOrigen = {
    id: number;
    fecha: string;
    id_cliente: number;
    file_path: string | null;
    type: TipoTransaccion;
    user: number;
};

export type LineaOrigen = {
    id_transaccion: number;
    id_libro: number;
    cantidad: number;
    precio: number;
};

export type VentaOrigen = {
    id_transaccion: number;
    descuento: number;
    total: number;
    tipo_cbte: number;
    medio_pago: MedioPagoNombre;
};

export type DatosMigracion = {
    meta: {
        generado_en: string;
        cuentas: number[];
        origen: string;
    };
    users: UsuarioOrigen[];
    clientes: ClienteOrigen[];
    personas: PersonaOrigen[];
    libros: LibroOrigen[];
    precio_libros: PrecioLibroOrigen[];
    precio_libro_cliente: PrecioLibroClienteOrigen[];
    libro_cliente: LibroClienteOrigen[];
    libros_personas: LibroPersonaOrigen[];
    transacciones: TransaccionOrigen[];
    libros_transacciones: LineaOrigen[];
    ventas: VentaOrigen[];
};
