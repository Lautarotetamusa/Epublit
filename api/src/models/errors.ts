import {Response} from "express"

export class ValidationError extends Error {
    status: number;

    constructor(message: string){
        super(message);
        this.name = "ValidationError";
        this.status = 400;
    }
}

export class NotFound extends Error {
    status: number;

    constructor(message: string){
        super(message);
        this.name = "NotFound";
        this.status = 404;
    }
}

export class NothingChanged extends Error {
    status: number;

    constructor(message: string){
        super(message);
        this.name = "NothingChanged";
        this.status = 200;
    }
}

export class Duplicated extends Error {
    status: number;

    constructor(message: string){
        super(message);
        this.name = "Duplicated";
        this.status = 404;
    }
}

export function parse_error(res: Response, error: Error){
    console.log(error);
    if (error instanceof ValidationError || error instanceof NotFound || error instanceof NothingChanged || error instanceof Duplicated)
        return res.status(error.status).json({
            success: false,
            error: error.message
        });

    if(error instanceof SyntaxError){
        return res.status(400).json({
            success: false,
            error: "Json error:" + error.message
        })
    }

    return res.status(500).json({
        success:false, 
        error: error.message
    }) 
}
