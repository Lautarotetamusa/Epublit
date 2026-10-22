import { api } from "./client";

export type LoginInput = {
    username: string;
    password: string;
};

// `token` viaja top-level (no en `data`): así responde `POST /user/login`
// (ver back/src/modules/user/user.controller.ts#login), es la excepción al
// sobre `{success,data}` del resto de la API.
export type LoginResponse = {
    success: true;
    message: string;
    token: string;
};

export const login = (input: LoginInput): Promise<LoginResponse> => api.post("/user/login", input);

export type RegisterInput = {
    username: string;
    password: string;
    cuit: string;
    email: string;
};

export type RegisterResponse = {
    success: true;
    message: string;
    data: { id: number };
};

export const register = (input: RegisterInput): Promise<RegisterResponse> => api.post("/user/register", input);
