import {validate} from './validate';
import { validateLibroPersona, TipoPersona } from './libro_persona.schema';

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
    static create(obj: any){
        const required = {
            'isbn': 'string',
            'id_persona': 'number',
            'tipo_persona': 'any',
            'fecha_inicial': 'Date',
            'fecha_final': 'Date',
        };

        let valid = validate(required, obj)
        if (valid.error !== null) 
            return {error: valid.error, obj: null}

        if (!validateLibroPersona.tipoPersona(valid.obj.tipo_persona))
            return {error: "El tipo pasado no es correcto", obj: null}

        return valid;
    }

}
