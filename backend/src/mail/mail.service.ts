import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
@Injectable()
export class MailService {
  private log = new Logger(MailService.name);
  private transporter() {
    if (!process.env.SMTP_HOST) return null;
    return nodemailer.createTransport({ host: process.env.SMTP_HOST, port: Number(process.env.SMTP_PORT || 587), secure: process.env.SMTP_SECURE === 'true', auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined });
  }
  async send(to: string, subject: string, html: string) {
    const t = this.transporter();
    if (!t) { this.log.warn(`SMTP not configured; would send "${subject}" to ${to}`); return; }
    await t.sendMail({ from: process.env.SMTP_FROM, to, subject, html });
  }
  link(path: string) { return `${process.env.FRONTEND_URL || 'http://localhost:5173'}${path}`; }
  async verifyEmail(to: string, token: string) { await this.send(to, 'Verify your email', `<p>Verify your account:</p><p><a href="${this.link(`/verify-email?token=${token}`)}">Verify email</a></p>`); }
  async resetPassword(to: string, token: string) { await this.send(to, 'Reset your password', `<p>Reset your password (1 hour):</p><p><a href="${this.link(`/reset-password?token=${token}`)}">Reset password</a></p>`); }
  async notify(to: string, title: string, body?: string) { await this.send(to, title, `<h3>${title}</h3><p>${body || ''}</p>`); }
}
