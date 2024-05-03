import { LibroPersonaKey, TipoPersona, LibroPersonaSchema} from "../schemas/libro_persona.schema";
import { BaseModel, DBConnection } from "./base.model";

export class LibroPersona extends BaseModel{
    tipo: TipoPersona;
    porcentaje: number;
    isbn: string;
    id_persona: number;

    static table_name: string = "libros_personas";
    static fields = ["tipo", "porcentaje"];
    static pks = ["tipo", "isbn", "id_persona"];

    //Validamos al momento de crear un objeto
    constructor(body: LibroPersonaSchema) {
        super();

        this.tipo = body.tipo;
        this.porcentaje  = body.porcentaje;
        this.isbn = body.isbn;
        this.id_persona = body.id_persona;
    }

    static async getOne(body: LibroPersonaKey): Promise<LibroPersona>{
        return super.find_one<LibroPersonaSchema, LibroPersona>(body);
    }

    static async exists(persona: LibroPersonaKey): Promise<boolean>{
        const rows = await super._bulk_select([persona]);
        return rows.length > 0;
    }

    static async insert(personas: LibroPersonaSchema[], connection: DBConnection){
        await super._bulk_insert(personas, connection);
    }
    
    static async update(personas: LibroPersonaSchema[], connection: DBConnection){
        for (let persona of personas) {
            if (persona.porcentaje){
                await LibroPersona._update({
                    porcentaje: persona.porcentaje
                }, {
                    isbn: persona.isbn, 
                    id_persona: persona.id_persona, 
                    tipo: persona.tipo
                }, connection);
            }
        }
    }

    static async remove(personas: LibroPersonaKey[], connection: DBConnection){
        await super._bulk_remove(personas, connection);
    }
}

