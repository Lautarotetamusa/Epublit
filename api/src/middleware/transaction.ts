import { Request, Response, NextFunction } from "express";
import { conn } from "../db";

export const transactional = async (error: Error, req: Request, res: Response, next: NextFunction) => {
    const connection = await conn.getConnection();

    console.log('error:', error);

    try{
        await connection.beginTransaction();
        res.locals.connection = connection;
        next()
        delete res.locals.connection;
        console.log('funcion terminada');
        await connection.commit();
    }catch(err){
        if (err instanceof Error){
            console.log("ERROR:", err.message);
        }
        await connection.rollback();
        console.log("Se realizo un rollback");
        throw err;
    }finally{
        connection.release()
    }
}
