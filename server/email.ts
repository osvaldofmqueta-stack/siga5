import nodemailer from "nodemailer";

const SMTP_HOST = process.env.SMTP_HOST ?? "";
const SMTP_PORT = parseInt(process.env.SMTP_PORT ?? "587", 10);
const SMTP_USER = process.env.SMTP_USER ?? "";
const SMTP_PASS = process.env.SMTP_PASS ?? "";
const SMTP_FROM = process.env.SMTP_FROM ?? SMTP_USER;

function isEmailConfigured(): boolean {
  return !!(SMTP_HOST && SMTP_USER && SMTP_PASS);
}

function createTransporter() {
  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465,
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS,
    },
    tls: {
      rejectUnauthorized: false,
    },
  });
}

export async function sendPasswordResetEmail(
  toEmail: string,
  nomeUtilizador: string,
  resetLink: string
): Promise<{ success: boolean; message: string }> {
  if (!isEmailConfigured()) {
    console.warn("[email] SMTP não configurado. Defina SMTP_HOST, SMTP_USER e SMTP_PASS nas variáveis de ambiente.");
    return { success: false, message: "Serviço de email não configurado. Contacte o administrador do sistema." };
  }

  const transporter = createTransporter();
  const primeiroNome = nomeUtilizador.split(" ")[0] || nomeUtilizador;

  const htmlBody = `
<!DOCTYPE html>
<html lang="pt">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Redefinição de Senha — SIGE</title>
</head>
<body style="margin:0;padding:0;background:#0D1B3E;font-family:'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0D1B3E;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background:#0F2347;border-radius:16px;overflow:hidden;border:1px solid rgba(255,255,255,0.08);">

          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#1A5276,#2980B9);padding:32px 40px;text-align:center;">
              <div style="display:inline-block;background:rgba(240,165,0,0.15);border:2px solid rgba(240,165,0,0.4);border-radius:50%;width:64px;height:64px;line-height:64px;text-align:center;margin-bottom:16px;">
                <span style="font-size:28px;">🔐</span>
              </div>
              <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;letter-spacing:0.5px;">Redefinição de Senha</h1>
              <p style="margin:8px 0 0;color:rgba(255,255,255,0.75);font-size:13px;">Sistema Integral de Gestão Escolar</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:36px 40px;">
              <p style="margin:0 0 16px;color:rgba(255,255,255,0.9);font-size:15px;line-height:1.6;">
                Olá, <strong style="color:#F0A500;">${primeiroNome}</strong>,
              </p>
              <p style="margin:0 0 24px;color:rgba(255,255,255,0.75);font-size:14px;line-height:1.7;">
                Recebemos um pedido para redefinir a senha da sua conta no SIGE. Se não foi você, pode ignorar este email em segurança — a sua senha permanecerá inalterada.
              </p>

              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding:8px 0 32px;">
                    <a href="${resetLink}" style="display:inline-block;background:linear-gradient(135deg,#1A5276,#2980B9);color:#ffffff;text-decoration:none;padding:14px 36px;border-radius:10px;font-size:15px;font-weight:700;letter-spacing:0.3px;border:1px solid rgba(255,255,255,0.15);">
                      Redefinir a minha senha
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Warning box -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="background:rgba(240,165,0,0.08);border:1px solid rgba(240,165,0,0.25);border-radius:10px;padding:16px 20px;">
                    <p style="margin:0;color:rgba(255,255,255,0.7);font-size:13px;line-height:1.6;">
                      ⏰ <strong style="color:#F0A500;">Este link é válido apenas por 1 hora.</strong><br />
                      Após esse prazo, terá de solicitar um novo link de redefinição.
                    </p>
                  </td>
                </tr>
              </table>

              <p style="margin:28px 0 0;color:rgba(255,255,255,0.45);font-size:12px;line-height:1.6;">
                Se o botão não funcionar, copie e cole este endereço no seu navegador:<br />
                <span style="color:#3498DB;word-break:break-all;">${resetLink}</span>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:rgba(0,0,0,0.2);padding:20px 40px;text-align:center;border-top:1px solid rgba(255,255,255,0.06);">
              <p style="margin:0;color:rgba(255,255,255,0.3);font-size:11px;line-height:1.6;">
                Este email foi enviado automaticamente pelo SIGE.<br />
                Por favor, não responda a este email.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();

  try {
    await transporter.sendMail({
      from: `"SIGE — Sistema Escolar" <${SMTP_FROM}>`,
      to: toEmail,
      subject: "Redefinição de Senha — SIGE",
      html: htmlBody,
      text: `Olá ${primeiroNome},\n\nClique no link abaixo para redefinir a sua senha:\n${resetLink}\n\nEste link expira em 1 hora.\n\nSe não solicitou esta operação, ignore este email.`,
    });
    return { success: true, message: "Email enviado com sucesso." };
  } catch (err) {
    console.error("[email] Erro ao enviar email:", err);
    return { success: false, message: "Falha ao enviar o email. Verifique as configurações SMTP." };
  }
}
