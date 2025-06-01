import { sendEmail, createImageAttachment } from '../services/emailServer';
import path from 'path';
import fs from "fs";
import { getCSRPath } from '../afip/Afip';

export async function sendWelcomeEmail(userEmail: string, cuit: string) {
    const mailPath = path.join(__dirname, "../../files/mails");
    const csrPath = getCSRPath(cuit);
    const imagePath = path.join(mailPath, "epublit.png");
    const htmlPath  = path.join(mailPath, "welcome.html");
    const instructivePath  = path.join(mailPath, "instructivo.pdf");

    const html = fs.readFileSync(htmlPath, "utf8");

    await sendEmail({
        to: userEmail,
        subject: '¡Bienvenido a Epublit!',
        html: html,
        attachments: [
            createImageAttachment(imagePath, 'logo'),
            {
                filename: "instructivo.pdf",
                path: instructivePath,
            },
            {
                filename: "cert.csr",
                path: csrPath,
            }
        ]
    });
}
