import {valid_required} from './validate'
import { Libro } from "../models/libro.model"

import { ValidationError } from '../models/errors';

export interface createLiquidacion{
    isbn: string;
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
            'fecha_inicial': 'Date',
            'fecha_final': 'Date',
        }, obj)
        if (!valid) 
            throw new ValidationError(error);

        return valid;
    }

}
