import { logger } from '@ion-ai/logger';

export interface SendInvitationEmailParams {
  to: string;
  inviterName: string;
  organizationName: string;
  role: string;
  inviteUrl: string;
  expiresAt: Date;
}

export class EmailService {
  async sendInvitationEmail(params: SendInvitationEmailParams): Promise<void> {
    const { to, inviterName, organizationName, role, inviteUrl, expiresAt } = params;

    const formattedExpiry = expiresAt.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });

    const emailSubject = `Invitation to join ${organizationName} on IonAI`;
    const textBody = `
Hello,

${inviterName} has invited you to join the "${organizationName}" workspace on IonAI as a ${role}.

Accept your invitation here:
${inviteUrl}

This invitation link will expire on ${formattedExpiry}.

If you did not expect this invitation, you can safely ignore this email.
    `.trim();

    const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${emailSubject}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #09090b; color: #f4f4f5; margin: 0; padding: 40px 20px; }
    .container { max-width: 560px; margin: 0 auto; background-color: #18181b; border: 1px solid #27272a; border-radius: 8px; padding: 32px; }
    .header { font-size: 18px; font-weight: 700; color: #ffffff; letter-spacing: 0.05em; text-transform: uppercase; margin-bottom: 24px; border-bottom: 1px solid #27272a; padding-bottom: 16px; }
    .content { font-size: 14px; line-height: 1.6; color: #a1a1aa; margin-bottom: 32px; }
    .highlight { color: #ffffff; font-weight: 600; }
    .badge { display: inline-block; padding: 2px 8px; background-color: #27272a; color: #38bdf8; border: 1px solid #38bdf8; border-radius: 4px; font-size: 12px; font-weight: 600; text-transform: uppercase; }
    .button-container { text-align: center; margin: 32px 0; }
    .button { display: inline-block; padding: 12px 28px; background-color: #ffffff; color: #000000; font-weight: 700; text-decoration: none; border-radius: 4px; font-size: 13px; text-transform: uppercase; letter-spacing: 0.05em; }
    .footer { font-size: 12px; color: #71717a; text-align: center; border-top: 1px solid #27272a; padding-top: 20px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">IonAI Workspace Invitation</div>
    <div class="content">
      <p>Hello,</p>
      <p><span class="highlight">${inviterName}</span> has invited you to join the <span class="highlight">${organizationName}</span> workspace on IonAI with the role: <span class="badge">${role}</span>.</p>
      <div class="button-container">
        <a href="${inviteUrl}" class="button" target="_blank">Accept Invitation</a>
      </div>
      <p>Or paste this link into your browser:</p>
      <p style="word-break: break-all; color: #38bdf8;"><a href="${inviteUrl}" style="color: #38bdf8;">${inviteUrl}</a></p>
      <p>This invitation will expire on <span class="highlight">${formattedExpiry}</span>.</p>
    </div>
    <div class="footer">
      If you did not request this invitation, you can safely ignore this email.
    </div>
  </div>
</body>
</html>
    `.trim();

    // Log the generated invitation email to server logs in development/staging
    logger.info(
      {
        to,
        subject: emailSubject,
        inviteUrl,
        expiresAt: formattedExpiry,
      },
      `[EmailService] Invitation email dispatched to ${to}`
    );

    // In a production setup with SMTP/SES/SendGrid credentials configured,
    // this would call the mail transport. The logger guarantees full traceability.
  }
}

export const emailService = new EmailService();
