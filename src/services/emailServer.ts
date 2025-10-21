import nodemailer from 'nodemailer';
import path from 'path';
import { Attachment } from 'nodemailer/lib/mailer';

interface EmailOptions {
    to: string;
    subject: string;
    html: string;
    attachments?: Attachment[]
}

export async function sendEmail(options: EmailOptions): Promise<void> {
    const transporter = nodemailer.createTransport({
        host: process.env.EMAIL_HOST,
        port: parseInt(process.env.EMAIL_PORT || '465'),
        //secure: false, // Zoho requires STARTTLS on port 587
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASSWORD,
        },
    });

    const mailOptions: nodemailer.SendMailOptions = {
        from: process.env.EMAIL_USER, // Va a llegar con este nombre
        to: options.to,
        subject: options.subject,
        html: options.html,
        attachments: options.attachments || [],
    };

    try {
        const info = await transporter.sendMail(mailOptions);
        console.log('Email sent:', info.messageId);
    } catch (error) {
        console.error('Email sending failed:', error);
        throw new Error(`Email sending failed: ${error instanceof Error ? error.message : String(error)}`);
    }
}

export function createImageAttachment(filePath: string, cid: string): Attachment {
    return {
        filename: path.basename(filePath),
        path: filePath,
        cid: cid, // Content-ID for referencing in HTML
        contentDisposition: 'inline'
    };
}
