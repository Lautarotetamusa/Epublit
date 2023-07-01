import {conn} from "../db"
import { OkPacket, RowDataPacket } from "mysql2/promise";
import { ValidationError, NotFound, NothingChanged, Duplicated } from './errors'
import { retrieveUser, createUser } from "../schemas/user.schema"

export class User{
    username: string;
    password: string;
    id: number;

    constructor(_user: retrieveUser){
        this.username = _user.username;
        this.password = _user.password;
        this.id = _user.id;
    }

    static async exists(username: string): Promise<boolean>{
        const query = `
            SELECT id FROM users
            WHERE username = ?`;
        try{
            const [rows] = await conn.query<RowDataPacket[]>(query, [username]);
            return rows.length > 0;
        }catch(error: any){
            return false;
        }
    }

    static async insert(_user: createUser): Promise<User>{
        const query = "INSERT INTO users SET ?";

        const [result] = await conn.query<OkPacket>(query, [_user]);
        return new User({
            ..._user, 
            id: result.insertId
        });
    }

    static async get_all(): Promise<User[]>{
        const query = "SELECT * FROM users";
        const [rows] = await conn.query<RowDataPacket[]>(query);
        let users: User[] = [];

        for (let _user of rows){
            users.push(new User(_user as retrieveUser));
        }

        return users;
    }

    static async get_one(username: string): Promise<User>{
        const query = `
            SELECT * FROM users
            WHERE username = ?`;

        const [rows] = await conn.query<RowDataPacket[]>(query, [username]);
        if (rows.length == 0)
            throw new ValidationError("Usuario no encontrado");

        return new User(rows[0] as retrieveUser);
    }
}
