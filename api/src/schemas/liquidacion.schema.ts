import {validate} from './validate';
import { validateLibroPersona, TipoPersona } from './libro_persona.schema';
import { ValidationError } from '../models/errors';

export interface createLiquidacion{
    isbn: string;
    id_persona: number;
    tipo_persona: TipoPersona; 

    fecha_inicial: Date;
    fecha_final: Date;
}

export interface saveLiquidacion extends createLiquidacion{
    total: number;
    file_path: string;
}

export interface retrieveLiquidacion extends saveLiquidacion{
    id: number;
}

export class LiquidacionValidator{
    static create(obj: any): createLiquidacion{
        const required = {
            'isbn': 'string',
            'id_persona': 'number',            
            'tipo_persona': 'any',
            'fecha_inicial': 'Date',
            'fecha_final': 'Date',
        };

        let valid = validate<createLiquidacion>(required, obj)

        if(!validateLibroPersona.tipoPersona(valid.tipo_persona))
            throw new ValidationError(`El tipo pasado no es correcto ${Object.keys(TipoPersona)}`);

        return valid;
    }
}
