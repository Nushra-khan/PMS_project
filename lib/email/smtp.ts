import net from "node:net";
import tls from "node:tls";

import { env } from "@/lib/env";

type SmtpResponse = {
  code: number;
  message: string;
};

type SendSmtpEmailInput = {
  to: string;
  subject: string;
  text: string;
  html: string;
};

const SMTP_TIMEOUT_MS = 15_000;

function sanitizeAddress(value: string) {
  return value.replace(/[<>\r\n]/g, "").trim();
}

function encodeHeader(value: string) {
  return /^[\x00-\x7F]*$/.test(value)
    ? value.replace(/\r|\n/g, " ")
    : `=?UTF-8?B?${Buffer.from(value, "utf8").toString("base64")}?=`;
}

function escapeDataLines(value: string) {
  return value.replace(/\r?\n/g, "\r\n").replace(/^\./gm, "..");
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

class SmtpConnection {
  private buffer = "";

  constructor(private socket: net.Socket | tls.TLSSocket) {}

  static async connect() {
    const socket = env.smtpSecure
      ? tls.connect({
          host: env.smtpHost,
          port: env.smtpPort,
          servername: env.smtpHost
        })
      : net.connect({
          host: env.smtpHost,
          port: env.smtpPort
        });

    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error("SMTP connection timed out."));
      }, SMTP_TIMEOUT_MS);

      socket.once(env.smtpSecure ? "secureConnect" : "connect", () => {
        clearTimeout(timer);
        resolve();
      });
      socket.once("error", (error) => {
        clearTimeout(timer);
        reject(error);
      });
    });

    const connection = new SmtpConnection(socket);
    await connection.expect([220]);
    return connection;
  }

  close() {
    this.socket.end();
  }

  async command(command: string, expectedCodes: number[]) {
    this.socket.write(`${command}\r\n`);
    return this.expect(expectedCodes);
  }

  async data(message: string) {
    this.socket.write(`${escapeDataLines(message)}\r\n.\r\n`);
    return this.expect([250]);
  }

  private async expect(expectedCodes: number[]) {
    const response = await this.readResponse();

    if (!expectedCodes.includes(response.code)) {
      throw new Error(`SMTP command failed with ${response.code}: ${response.message}`);
    }

    return response;
  }

  private async readResponse(): Promise<SmtpResponse> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        cleanup();
        reject(new Error("SMTP response timed out."));
      }, SMTP_TIMEOUT_MS);

      const onData = (chunk: Buffer) => {
        this.buffer += chunk.toString("utf8");
        const lines = this.buffer.split(/\r?\n/);
        this.buffer = lines.pop() ?? "";

        for (const line of lines) {
          const match = /^(\d{3})([\s-])(.*)$/.exec(line);

          if (match && match[2] === " ") {
            cleanup();
            resolve({
              code: Number(match[1]),
              message: match[3] ?? ""
            });
            return;
          }
        }
      };

      const onError = (error: Error) => {
        cleanup();
        reject(error);
      };

      const cleanup = () => {
        clearTimeout(timer);
        this.socket.off("data", onData);
        this.socket.off("error", onError);
      };

      this.socket.on("data", onData);
      this.socket.once("error", onError);
    });
  }
}

export function hasSmtpEmailConfig() {
  return Boolean(env.smtpHost && env.smtpPort && env.smtpFromEmail);
}

export async function sendSmtpEmail(input: SendSmtpEmailInput) {
  if (!hasSmtpEmailConfig()) {
    throw new Error("SMTP email is not configured.");
  }

  const fromEmail = sanitizeAddress(env.smtpFromEmail);
  const toEmail = sanitizeAddress(input.to);
  const fromName = encodeHeader(env.smtpFromName);
  const subject = encodeHeader(input.subject);
  const connection = await SmtpConnection.connect();

  try {
    await connection.command(`EHLO ${env.appUrl.replace(/^https?:\/\//, "") || "localhost"}`, [250]);

    if (env.smtpUser && env.smtpPass) {
      await connection.command("AUTH LOGIN", [334]);
      await connection.command(Buffer.from(env.smtpUser).toString("base64"), [334]);
      await connection.command(Buffer.from(env.smtpPass).toString("base64"), [235]);
    }

    await connection.command(`MAIL FROM:<${fromEmail}>`, [250]);
    await connection.command(`RCPT TO:<${toEmail}>`, [250, 251]);
    await connection.command("DATA", [354]);
    await connection.data(
      [
        `From: ${fromName} <${fromEmail}>`,
        `To: <${toEmail}>`,
        `Subject: ${subject}`,
        "MIME-Version: 1.0",
        'Content-Type: text/html; charset="UTF-8"',
        "Content-Transfer-Encoding: 8bit",
        "",
        input.html,
        "",
        "<hr />",
        `<pre>${escapeHtml(input.text)}</pre>`
      ].join("\r\n")
    );
    await connection.command("QUIT", [221]);
  } finally {
    connection.close();
  }
}
