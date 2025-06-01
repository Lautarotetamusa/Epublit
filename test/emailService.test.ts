import { sendEmail, createImageAttachment } from '../src/services/emailServer';
import nodemailer from 'nodemailer';
import path from 'path';

jest.mock('nodemailer');
jest.mock('fs', () => ({
    readFileSync: jest.fn().mockReturnValue('mock-image-data'),
}));

describe('Email Service with Images', () => {
    beforeEach(() => {
        jest.resetModules();
        process.env = {
            EMAIL_HOST: 'smtp.zoho.com',
            EMAIL_PORT: '587',
            EMAIL_USER: 'test@company.com',
            EMAIL_PASSWORD: 'test123',
            EMAIL_FROM: 'test@company.com',
        };
    });

    it('should send email with embedded image', async () => {
        const mockSendMail = jest.fn().mockResolvedValue(true);
        (nodemailer.createTransport as jest.Mock).mockReturnValue({
            sendMail: mockSendMail,
        });

        const imagePath = path.join(__dirname, 'test-logo.png');
        const cid = 'companyLogo123';

        const htmlContent = `<html><body><img src="cid:${cid}"></body></html>`;

        await sendEmail({
            to: 'recipient@company.com',
            subject: 'Test with Image',
            html: htmlContent,
            attachments: [createImageAttachment(imagePath, cid)]
        });

        const sentAttachments = mockSendMail.mock.calls[0][0].attachments;

        expect(sentAttachments).toHaveLength(1);
        expect(sentAttachments[0].cid).toBe(cid);
        expect(sentAttachments[0].contentDisposition).toBe('inline');
        expect(mockSendMail).toHaveBeenCalledWith(
            expect.objectContaining({
                html: expect.stringContaining(`src="cid:${cid}"`),
            })
        );
    });
});
