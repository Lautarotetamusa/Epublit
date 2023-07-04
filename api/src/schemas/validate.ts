function valid_date(date: string) {
  var regEx = /^\d{4}-\d{2}-\d{2}$/;
  return date.match(regEx) != null;
}

export function valid_required(required: any, obj: any): {valid: boolean, error: string}{
    type keys = keyof typeof required;

    for (let key of Object.keys(required)){
        if (!(key in obj))
            return {valid: false, error: `El ${key} es obligatorio`};
        
        if (required[key as keys] == "any")
            return {valid: true, error: ""}

        if (required[key as keys] == "Date"){
            if (!valid_date(obj[key]))
                return {valid: false, error: `El formato de la fecha ${obj[key]} es incorrecto yyyy-mm-dd`}
        }else if (typeof obj[key] !== required[key as keys]){
            return {valid: false, error: `${key} debe ser de tipo ${required[key as keys]}`};
        }
    }
    return {valid: true, error: ""}
}
