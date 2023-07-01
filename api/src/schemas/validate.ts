export function valid_required(required: any, obj: any): {valid: boolean, error: string}{
    type keys = keyof typeof required;

    for (let key of Object.keys(required)){
        if (!(key in obj)){ 
            return {valid: false, error: `El ${key} es obligatorio`};
        }
        
        if (required[key as keys] !== "any"){
            if (typeof obj[key] !== required[key as keys]){
                return {valid: false, error: `${key} debe ser de tipo ${required[key as keys]}`};
            }
        }
    }
    return {valid: true, error: ""}
}
