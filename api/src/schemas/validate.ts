import { ValidationError } from "../models/errors";

function valid_date(date: string) {
  var regEx = /^\d{4}-\d{2}-\d{2}$/;
  return date.match(regEx) != null;
}

type RequiredFields<T> = {
    [K in keyof T]-?: string;
};

export function validate<T>(required: RequiredFields<T>, obj: any): T{
    type keys = keyof typeof required;

    // Validar que el obj contenga todos los campos requeridos (todos los campos de required) y que sean del mismo tipo
    for (let key of Object.keys(required)){
        let field_type = required[key as keys] as string;
        let value = obj[key];
        let optional = false;

        if (field_type === "ignore")
            continue

        if (field_type.includes('?')){ //Campo opcional
            optional = true;
            [, field_type] = field_type.split('?');
        } 

        if (!(key in obj))
            if(!optional)
                throw new ValidationError(`El campo ${key} es obligatorio`);
            else
                continue

        switch (field_type) {
            case "any":
                break;
            case "Date":
                if(!valid_date(value)) 
                    throw new ValidationError(`El formato de la fecha ${value} es incorrecto yyyy-mm-dd`);
                break;
            default:
                if (typeof value !== field_type)
                    throw new ValidationError(`El campo ${key} debe ser de tipo ${field_type}`);
                break;
        }
    }

    // Validar que el obj no tenga campos extras que el required no tiene.
    for (let key of Object.keys(obj)){
        if (!(key in required)){
            delete obj[key]; // Eliminamos el campo que no va del obj
        }
    }

    if (Object.keys(obj).length === 0)
        throw new ValidationError("Ningun campo es valido, obj: null");

    return obj as T;
}