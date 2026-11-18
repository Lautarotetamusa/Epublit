import { ServerClient } from "postmark";
import type { TransporteEmail } from "./email.types";

export type PostmarkConfig = {
    serverToken: string;
    from: string;
    messageStream: string;
};

export function createTransportePostmark({ serverToken, from, messageStream }: PostmarkConfig): TransporteEmail {
    const client = new ServerClient(serverToken);

    return async ({ alias, para, modelo, adjuntos }) => {
        await client.sendEmailWithTemplate({
            From: from,
            To: para,
            TemplateAlias: alias,
            TemplateModel: modelo,
            MessageStream: messageStream,
            Attachments: adjuntos.map((adjunto) => ({
                Name: adjunto.nombre,
                Content: adjunto.contenido.toString("base64"),
                ContentType: adjunto.tipo,
                ContentID: null
            }))
        });
    };
}

// Sin token de Postmark (desarrollo, o producción antes de configurarlo) el
// mail no sale: queda en el log para ver qué se habría mandado.
export function createTransporteLog(): TransporteEmail {
    return async ({ alias, para, modelo, adjuntos }) => {
        console.log("[email] sin POSTMARK_SERVER_TOKEN, no se envía", {
            alias,
            para,
            modelo,
            adjuntos: adjuntos.map((adjunto) => adjunto.nombre)
        });
    };
}
