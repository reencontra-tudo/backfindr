import { Resend } from 'resend';

function getResend() {
  return new Resend(process.env.RESEND_API_KEY ?? '');
}

const FROM = 'Backfindr <noreply@backfindr.com>';

// ─── E-mail de boas-vindas ────────────────────────────────────────────────────
export async function sendWelcomeEmail(user: { name: string; email: string }) {
  const firstName = user.name.split(' ')[0];
  const dashboardUrl = 'https://www.backfindr.com/dashboard/objects/new';
  const faqUrl = 'https://www.backfindr.com/faq';

  const html = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Bem-vindo ao Backfindr</title>
</head>
<body style="margin:0;padding:0;background:#080b0f;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#080b0f;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#0f1318;border:1px solid rgba(255,255,255,0.08);border-radius:20px;overflow:hidden;">

          <!-- Header -->
          <tr>
            <td style="padding:32px 32px 0;text-align:center;">
              <div style="display:inline-flex;align-items:center;gap:10px;margin-bottom:8px;">
                <div style="width:36px;height:36px;background:#14b8a6;border-radius:10px;display:inline-flex;align-items:center;justify-content:center;">
                  <span style="color:white;font-size:18px;">📍</span>
                </div>
                <span style="color:white;font-size:18px;font-weight:700;">Backfindr</span>
              </div>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:28px 32px 32px;">
              <h1 style="color:white;font-size:24px;font-weight:700;margin:0 0 8px;line-height:1.3;">
                Bem-vindo, ${firstName}! 🎉
              </h1>
              <p style="color:rgba(255,255,255,0.55);font-size:15px;line-height:1.6;margin:0 0 24px;">
                Sua conta foi criada com sucesso. Agora você faz parte da maior rede de recuperação de objetos perdidos do Brasil.
              </p>

              <!-- CTA principal -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
                <tr>
                  <td align="center">
                    <a href="${dashboardUrl}"
                       style="display:inline-block;background:#14b8a6;color:white;font-size:15px;font-weight:700;text-decoration:none;padding:14px 32px;border-radius:12px;box-shadow:0 4px 20px rgba(20,184,166,0.25);">
                      Registrar meu primeiro objeto →
                    </a>
                  </td>
                </tr>
              </table>

              <!-- O que você pode fazer -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);border-radius:14px;margin-bottom:24px;">
                <tr>
                  <td style="padding:20px 24px;">
                    <p style="color:rgba(255,255,255,0.35);font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.15em;margin:0 0 16px;">O que você pode fazer agora</p>

                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding:8px 0;vertical-align:top;">
                          <span style="font-size:20px;margin-right:12px;">🔒</span>
                          <span style="color:white;font-size:14px;font-weight:600;">Proteger seus objetos</span><br/>
                          <span style="color:rgba(255,255,255,0.4);font-size:13px;">Gere um QR Code único para mochila, carteira, pet ou documento.</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:8px 0;vertical-align:top;">
                          <span style="font-size:20px;margin-right:12px;">🔍</span>
                          <span style="color:white;font-size:14px;font-weight:600;">Buscar o que perdeu</span><br/>
                          <span style="color:rgba(255,255,255,0.4);font-size:13px;">Publique um alerta e seja notificado quando alguém encontrar.</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:8px 0;vertical-align:top;">
                          <span style="font-size:20px;margin-right:12px;">🤝</span>
                          <span style="color:white;font-size:14px;font-weight:600;">Devolver o que achou</span><br/>
                          <span style="color:rgba(255,255,255,0.4);font-size:13px;">Registre o achado e conecte-se ao dono com privacidade garantida.</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Link FAQ -->
              <p style="color:rgba(255,255,255,0.35);font-size:13px;text-align:center;margin:0;">
                Tem dúvidas? Consulte nossa <a href="${faqUrl}" style="color:#14b8a6;text-decoration:none;">Central de Ajuda</a>.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:20px 32px;border-top:1px solid rgba(255,255,255,0.06);text-align:center;">
              <p style="color:rgba(255,255,255,0.2);font-size:12px;margin:0;">
                © 2026 Backfindr · <a href="https://www.backfindr.com" style="color:rgba(255,255,255,0.3);text-decoration:none;">www.backfindr.com</a>
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
    const { error } = await getResend().emails.send({
      from: FROM,
      to: [user.email],
      subject: `Bem-vindo ao Backfindr, ${firstName}! Registre seu primeiro objeto`,
      html,
    });

    if (error) {
      console.error('[email] Erro ao enviar boas-vindas:', error);
    }
  } catch (err) {
    // Não bloquear o cadastro se o e-mail falhar
    console.error('[email] Exceção ao enviar boas-vindas:', err);
  }
}

// ─── E-mail de alerta de match ────────────────────────────────────────────────
export async function sendMatchAlertEmail(user: { name: string; email: string }, objectTitle: string, matchId: string) {
  const firstName = user.name.split(' ')[0];
  const matchUrl = `https://www.backfindr.com/dashboard/matches`;

  const html = `
<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8" /><title>Match encontrado!</title></head>
<body style="margin:0;padding:0;background:#080b0f;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#080b0f;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#0f1318;border:1px solid rgba(255,255,255,0.08);border-radius:20px;overflow:hidden;">
          <tr>
            <td style="padding:32px;">
              <div style="text-align:center;margin-bottom:24px;">
                <span style="font-size:48px;">⚡</span>
              </div>
              <h1 style="color:white;font-size:22px;font-weight:700;margin:0 0 8px;text-align:center;">
                Match encontrado, ${firstName}!
              </h1>
              <p style="color:rgba(255,255,255,0.55);font-size:14px;line-height:1.6;margin:0 0 24px;text-align:center;">
                A IA do Backfindr encontrou uma correspondência para <strong style="color:white;">${objectTitle}</strong>.
              </p>
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <a href="${matchUrl}"
                       style="display:inline-block;background:#14b8a6;color:white;font-size:15px;font-weight:700;text-decoration:none;padding:14px 32px;border-radius:12px;">
                      Ver o match agora →
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 32px;border-top:1px solid rgba(255,255,255,0.06);text-align:center;">
              <p style="color:rgba(255,255,255,0.2);font-size:12px;margin:0;">© 2026 Backfindr</p>
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
    const { error } = await getResend().emails.send({
      from: FROM,
      to: [user.email],
      subject: `⚡ Match encontrado para "${objectTitle}" — Backfindr`,
      html,
    });

    if (error) {
      console.error('[email] Erro ao enviar alerta de match:', error);
    }
  } catch (err) {
    console.error('[email] Exceção ao enviar alerta de match:', err);
  }
}
