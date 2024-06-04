import { 
    UserSchema,
    SaveUser,
    UpdateUser
} from "../schemas/user.schema"
import { BaseModel } from "./base.model";

export class User extends BaseModel{
    username: string;
    password: string;
    id: number;
    cuit: string;
    cond_fiscal: string;
    razon_social: string;
    domicilio: string;
    production: number; //Pongo un numero porque mysql devuelve un numero

    static table_name = "users"; 

    constructor(body: UserSchema){
        super();

        this.username = body.username;
        this.password = body.password;
        this.cond_fiscal = body.cond_fiscal;
        this.cuit = body.cuit;
        this.razon_social = body.razon_social;
        this.domicilio = body.domicilio;
        this.id = body.id;
        this.production = body.production;
    }

    static async exists(username: string): Promise<boolean>{
        return await super._exists({username: username});
    }

    static async insert(body: SaveUser): Promise<User>{
        return await this._insert<SaveUser, User>(body);
    }

    async update(body: UpdateUser){
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
}
