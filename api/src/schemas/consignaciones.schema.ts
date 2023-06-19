import { number, string } from "zod";

type create = {
    cliente: number,
    libros: {
        cantidad: number,
        isbn: string
    }[]
}

// GET /consignaciones
type getAll = [
    {
        id: number,
        nombre_cliente: string,
        cuit_cliente: string
    }
]

// GET /consignaciones/{id}
type getOne = {
    libros:{
        cantidad: number,
        isbn: string,
        titulo: string
    }[],
    file_path: string,
    fecha: Date
}