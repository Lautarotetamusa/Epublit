import {valid_required} from './validate';
import { Libro } from "../models/libro.model";
import { TipoPersona } from "./persona.schema";

import { ValidationError } from '../models/errors';

export interface createLiquidacion{
    isbn: string;
    id_persona: number;
    tipo_persona: TipoPersona; 
    fecha_inicial: Date;
    fecha_final: Date;
}

export interface retrieveLiquidacion extends createLiquidacion{
    id: number;
    total: number;
    file_path: string;
}

export class LiquidacionValidator{
    static create(obj: any): obj is createLiquidacion{
        let {valid, error} = valid_required({
            'isbn': 'string',
            'id_persona': 'number',
            'tipo_persona': 'any',
            'fecha_inicial': 'Date',
            'fecha_final': 'Date',
        }, obj)
        if (!valid) 
            throw new ValidationError(error);

        if (!(Object.values(TipoPersona).includes(obj.tipo_persona)))
            throw new ValidationError("El tipo de persona pasado no es correcto")

        return valid;
    }

}
