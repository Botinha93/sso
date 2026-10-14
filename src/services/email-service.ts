import nodemailer from "nodemailer";
import { ValidationError } from "../core/errors.js";
import { InstanceSettingsService } from "./instance-settings-service.js";

export class EmailService {
  constructor(private readonly instanceSettingsService: InstanceSettingsService) {}

  async send(input: { to: string; subject: string; text: string; html?: string }) {
    const settings = await this.instanceSettingsService.getSettings();

    if (settings.emailTransport === "disabled") {
      throw new ValidationError("Email transport is disabled");
    }

    if (settings.emailTransport === "log") {
      // In log mode we intentionally avoid external delivery and print the payload for local development.
      console.info("[email-log]", {
        from: settings.emailFrom,
        to: input.to,
        subject: input.subject,
        text: input.text
      });
      return { delivered: false, mode: "log" as const };
    }

    if (!settings.smtpHost || !settings.smtpPort) {
      throw new ValidationError("SMTP configuration is incomplete");
    }

    const transport = nodemailer.createTransport({
      host: settings.smtpHost,
      port: settings.smtpPort,
      secure: Boolean(settings.smtpSecure),
      auth: settings.smtpUser
        ? {
            user: settings.smtpUser,
            pass: settings.smtpPass
          }
        : undefined
    });

    await transport.sendMail({
      from: settings.emailFrom,
      to: input.to,
      subject: input.subject,
      text: input.text,
      html: input.html
    });

    return { delivered: true, mode: "smtp" as const };
  }

  async sendRecoveryVerification(input: { to: string; code: string; ticket: string }) {
    const subject = "Your recovery verification code";
    const text = [
      "You requested a password recovery code.",
      "",
      `Code: ${input.code}`,
      `Recovery ticket: ${input.ticket}`,
      "",
      "If you did not request this, you can ignore this email."
    ].join("\n");

    const html = [
      "<p>You requested a password recovery code.</p>",
      `<p><strong>Code:</strong> ${input.code}</p>`,
      `<p><strong>Recovery ticket:</strong> ${input.ticket}</p>`,
      "<p>If you did not request this, you can ignore this email.</p>"
    ].join("");

    return this.send({
      to: input.to,
      subject,
      text,
      html
    });
  }
}
