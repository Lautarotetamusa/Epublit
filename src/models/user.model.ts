import { RowDataPacket } from "mysql2";
import { conn } from "../db";
import { 
    UserSchema,
    SaveUser,
    UpdateUser,
    UpdateAfipUser
} from "../schemas/user.schema"
import { BaseModel } from "./base.model";

export class User extends BaseModel{
    username: string;
    password: string;
    id: number;
    cuit: string;
    cond_fiscal: string;
    razon_social: string;
    fecha_inicio: string;
    ingresos_brutos: boolean;
    punto_venta: number | null;

    domicilio: string;
    email: string;
    production: number; //Pongo un numero porque mysql devuelve un numero

    static table_name = "users"; 

    static fields = [
        "username", "id", "cuit", "cond_fiscal", "razon_social", "fecha_inicio", 
        "ingresos_brutos", "punto_venta", "domicilio", "email", "production"
    ];

    constructor(body: UserSchema){
        super();

        this.fecha_inicio = body.fecha_inicio;
        this.ingresos_brutos = body.ingresos_brutos;
        this.username = body.username;
        this.password = body.password;
        this.cond_fiscal = body.cond_fiscal;
        this.cuit = body.cuit;
        this.razon_social = body.razon_social;
        this.domicilio = body.domicilio;
        this.email = body.email;
        this.id = body.id;
        this.production = body.production;
        this.punto_venta = body.punto_venta;
    }

    static exists(username: string): Promise<boolean>{
        return super._exists({username: username});
    }

    static insert(body: SaveUser): Promise<User>{
        return this._insert<SaveUser, User>(body);
    }

    async update(body: UpdateAfipUser & UpdateUser){
        await User._update<UpdateUser>(body, {
            id: this.id, 
        });    

        for (const i in body){
            const value = body[i as keyof typeof body];
            if (value !== undefined){
                this[i as keyof this] = value as any; 
            }
        }
    }

    static async getAll(): Promise<UserSchema[]>{
        return await super.find_all<UserSchema>();
    }

    static async getOne(username: string): Promise<User>{
        return await super.find_one<UserSchema, User>({username: username})
    }
    
    static getById(id: number): Promise<User>{
        return super.find_one<UserSchema, User>({id: id})
    }

    static async getPassword(id: number): Promise<string>{
        const [rows] = await conn.query<RowDataPacket[]>("select password from users where id=?", [id])
        return rows[0].password as string;
    }
}
