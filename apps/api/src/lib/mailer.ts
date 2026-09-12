import nodemailer from "nodemailer";
import type { ApiConfig } from "../config";

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
}

export interface Mailer {
  send(message: MailMessage): Promise<void>;
}

export function createSmtpMailer(smtp: ApiConfig["smtp"]): Mailer {
  const transport = nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.port === 465,
    auth: smtp.user ? { user: smtp.user, pass: smtp.pass } : undefined,
  });
  return {
    async send(message) {
      await transport.sendMail({ from: smtp.from, ...message });
    },
  };
}
