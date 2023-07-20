import {retrieve, validate} from './validate';
import { validateLibroPersona, TipoPersona } from './libro_persona.schema';

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
    static create(obj: any): retrieve<createLiquidacion>{
        const required = {
            'isbn': 'string',
            'id_persona': 'number',            
            'tipo_persona': 'any',
            'fecha_inicial': 'Date',
            'fecha_final': 'Date',
        };

        let valid = validate<createLiquidacion>(required, obj)
        if (valid.error !== null) 
            return {error: valid.error, obj: null}

        if (!validateLibroPersona.tipoPersona(valid.obj.tipo_persona))
            return {error: "El tipo pasado no es correcto", obj: null}

        return valid;
    }

}
