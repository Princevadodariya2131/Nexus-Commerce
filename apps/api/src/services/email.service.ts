import nodemailer from 'nodemailer';
import { config } from '../config';
import { logger } from '../utils/logger';

const transporter = config.email.host
  ? nodemailer.createTransport({
      host: config.email.host,
      port: config.email.port,
      secure: config.email.port === 465,
      auth: { user: config.email.user, pass: config.email.pass },
    })
  : null;

export const emailService = {
  async send(to: string, subject: string, html: string) {
    if (!transporter) {
      logger.debug(`[Email skipped] To: ${to} | Subject: ${subject}`);
      return;
    }
    await transporter.sendMail({
      from: config.email.from,
      to,
      subject,
      html,
    });
  },

  async sendVerificationEmail(email: string, token: string) {
    const url = `${config.app.clientUrl}/verify-email?token=${token}`;
    await this.send(
      email,
      'Verify your Nexus Commerce account',
      `<h1>Welcome to Nexus Commerce</h1><p><a href="${url}">Verify your email</a></p>`
    );
  },

  async sendPasswordResetEmail(email: string, token: string) {
    const url = `${config.app.clientUrl}/reset-password?token=${token}`;
    await this.send(
      email,
      'Reset your password',
      `<h1>Password Reset</h1><p><a href="${url}">Reset password</a></p><p>Link expires in 1 hour.</p>`
    );
  },

  async sendOrderConfirmation(email: string, orderNumber: string, total: number) {
    await this.send(
      email,
      `Order Confirmed — #${orderNumber}`,
      `<h1>Thank you for your order!</h1><p>Order #${orderNumber}</p><p>Total: $${total.toFixed(2)}</p>`
    );
  },
};
