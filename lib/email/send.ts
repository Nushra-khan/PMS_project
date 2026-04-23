import { env } from "@/lib/env";
import { hasSmtpEmailConfig, sendSmtpEmail } from "@/lib/email/smtp";

type SendEmailInput = {
  to: string;
  subject: string;
  text: string;
  html: string;
};

export function getEmailProvider() {
  if (env.resendApiKey && env.emailFrom) {
    return "resend";
  }

  if (hasSmtpEmailConfig()) {
    return "smtp";
  }

  return null;
}

export async function sendEmail(input: SendEmailInput) {
  const provider = getEmailProvider();

  if (provider === "resend") {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.resendApiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from: env.emailFrom,
        to: input.to,
        subject: input.subject,
        text: input.text,
        html: input.html
      })
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Resend email failed with ${response.status}: ${body.slice(0, 240)}`);
    }

    return provider;
  }

  if (provider === "smtp") {
    await sendSmtpEmail(input);
    return provider;
  }

  throw new Error("No email provider is configured.");
}
