/**
 * Server-only SMTP helper. Never import from client/route files directly.
 * Uses Hostinger SMTP via nodemailer. Reads credentials from process.env.
 */
import nodemailer, { type Transporter } from "nodemailer";

let cached: Transporter | null = null;

function getTransporter(): Transporter {
  if (cached) return cached;

  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || "465");
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    throw new Error(
      "SMTP not configured: SMTP_HOST, SMTP_USER, SMTP_PASS required",
    );
  }

  cached = nodemailer.createTransport({
    host,
    port,
    secure: port === 465, // SSL on 465, STARTTLS on 587
    auth: { user, pass },
    // reasonable timeouts for edge runtime
    connectionTimeout: 15_000,
    greetingTimeout: 15_000,
    socketTimeout: 20_000,
  });

  return cached;
}

export interface SendMailInput {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  replyTo?: string;
  cc?: string | string[];
  bcc?: string | string[];
}

export interface SendMailResult {
  ok: true;
  messageId: string;
  accepted: string[];
  rejected: string[];
  response: string;
}

export async function sendMailServer(
  input: SendMailInput,
): Promise<SendMailResult> {
  const from = process.env.SMTP_FROM || process.env.SMTP_USER!;
  const transporter = getTransporter();

  const info = await transporter.sendMail({
    from,
    to: input.to,
    subject: input.subject,
    html: input.html,
    text: input.text ?? (input.html ? undefined : ""),
    replyTo: input.replyTo,
    cc: input.cc,
    bcc: input.bcc,
  });

  return {
    ok: true,
    messageId: info.messageId,
    accepted: (info.accepted ?? []).map(String),
    rejected: (info.rejected ?? []).map(String),
    response: info.response ?? "",
  };
}

export async function verifySmtpConnection(): Promise<boolean> {
  const transporter = getTransporter();
  await transporter.verify();
  return true;
}
