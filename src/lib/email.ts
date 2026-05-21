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
                          <span style="font-size:20px;margin-right:12px;">📱</span>
                          <span style="color:white;font-size:14px;font-weight:600;">Instalar o App</span><br/>
                          <span style="color:rgba(255,255,255,0.4);font-size:13px;">Adicione à tela inicial para receber alertas em tempo real quando seu objeto for encontrado.</span>
                        </td>
                      </tr>
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
export async function sendMatchAlertEmail(
  user: { name: string; email: string },
  objectTitle: string,
  matchId: string,
  score?: number,
  matchedTitle?: string
) {
  const firstName = user.name.split(' ')[0];
  const matchUrl = `https://www.backfindr.com/dashboard/matches`;
  const scoreLabel = score && score >= 80 ? 'Alta' : score && score >= 60 ? 'Média' : 'Moderada';
  const scoreColor = score && score >= 80 ? '#22c55e' : score && score >= 60 ? '#f59e0b' : '#14b8a6';
  const scoreBar = score ? Math.round(score) : 70;

  const html = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Match encontrado!</title>
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
            <td style="padding:24px 32px 32px;">

              <!-- Ícone de match -->
              <div style="text-align:center;margin-bottom:20px;">
                <div style="display:inline-block;background:rgba(20,184,166,0.1);border:1px solid rgba(20,184,166,0.25);border-radius:50%;width:72px;height:72px;line-height:72px;text-align:center;">
                  <span style="font-size:32px;">⚡</span>
                </div>
              </div>

              <h1 style="color:white;font-size:22px;font-weight:700;margin:0 0 8px;text-align:center;line-height:1.3;">
                Match encontrado, ${firstName}!
              </h1>
              <p style="color:rgba(255,255,255,0.55);font-size:14px;line-height:1.6;margin:0 0 24px;text-align:center;">
                A IA do Backfindr identificou uma possível correspondência para<br/>
                <strong style="color:white;">${objectTitle}</strong>
              </p>

              <!-- Card de match -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:14px;margin-bottom:24px;">
                <tr>
                  <td style="padding:20px 24px;">
                    <p style="color:rgba(255,255,255,0.35);font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.15em;margin:0 0 12px;">Detalhes do match</p>

                    <!-- Objeto perdido -->
                    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:12px;">
                      <tr>
                        <td style="width:8px;background:#ef4444;border-radius:4px;" width="8"></td>
                        <td style="padding-left:12px;">
                          <p style="color:rgba(255,255,255,0.4);font-size:11px;margin:0 0 2px;">Seu objeto</p>
                          <p style="color:white;font-size:14px;font-weight:600;margin:0;">${objectTitle}</p>
                        </td>
                      </tr>
                    </table>

                    <!-- Divider -->
                    <div style="text-align:center;margin:8px 0;">
                      <span style="color:rgba(255,255,255,0.2);font-size:18px;">↕</span>
                    </div>

                    <!-- Objeto encontrado -->
                    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:16px;">
                      <tr>
                        <td style="width:8px;background:#22c55e;border-radius:4px;" width="8"></td>
                        <td style="padding-left:12px;">
                          <p style="color:rgba(255,255,255,0.4);font-size:11px;margin:0 0 2px;">Possível correspondência</p>
                          <p style="color:white;font-size:14px;font-weight:600;margin:0;">${matchedTitle || 'Item encontrado registrado na plataforma'}</p>
                        </td>
                      </tr>
                    </table>

                    <!-- Score de confiança -->
                    <p style="color:rgba(255,255,255,0.35);font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.15em;margin:0 0 8px;">Confiança do match</p>
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td>
                          <div style="background:rgba(255,255,255,0.06);border-radius:100px;height:8px;overflow:hidden;">
                            <div style="background:${scoreColor};height:8px;border-radius:100px;width:${scoreBar}%;"></div>
                          </div>
                        </td>
                        <td style="width:80px;padding-left:12px;white-space:nowrap;">
                          <span style="color:${scoreColor};font-size:13px;font-weight:700;">${scoreBar}% — ${scoreLabel}</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- CTA -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
                <tr>
                  <td align="center">
                    <a href="${matchUrl}"
                       style="display:inline-block;background:#14b8a6;color:white;font-size:15px;font-weight:700;text-decoration:none;padding:14px 36px;border-radius:12px;box-shadow:0 4px 20px rgba(20,184,166,0.25);">
                      Ver o match agora →
                    </a>
                  </td>
                </tr>
              </table>

              <p style="color:rgba(255,255,255,0.25);font-size:12px;text-align:center;margin:0;">
                Acesse o match para confirmar ou descartar a correspondência.
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

// ─── E-mail de reativação 24h sem match ──────────────────────────────────────
export async function sendReactivationEmail(user: { name: string; email: string }, objectTitle: string) {
  const firstName = user.name.split(' ')[0];
  const searchUrl = `https://www.backfindr.com/buscar?keyword=${encodeURIComponent(objectTitle)}`;
  const dashboardUrl = 'https://www.backfindr.com/dashboard';

  const html = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Ainda estamos procurando por você</title>
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
              <!-- Ícone de busca ativa -->
              <div style="text-align:center;margin-bottom:20px;">
                <div style="display:inline-block;background:rgba(20,184,166,0.1);border:1px solid rgba(20,184,166,0.2);border-radius:50%;width:64px;height:64px;line-height:64px;text-align:center;">
                  <span style="font-size:28px;">🔍</span>
                </div>
              </div>

              <h1 style="color:white;font-size:22px;font-weight:700;margin:0 0 8px;text-align:center;line-height:1.3;">
                Ainda estamos procurando, ${firstName}.
              </h1>
              <p style="color:rgba(255,255,255,0.55);font-size:14px;line-height:1.6;margin:0 0 24px;text-align:center;">
                Seu alerta para <strong style="color:white;">${objectTitle}</strong> está ativo.<br/>
                Novos itens são registrados todos os dias — o match pode acontecer a qualquer momento.
              </p>

              <!-- Dica de melhoria -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);border-radius:14px;margin-bottom:24px;">
                <tr>
                  <td style="padding:18px 20px;">
                    <p style="color:rgba(255,255,255,0.35);font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.15em;margin:0 0 12px;">Aumente suas chances</p>
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding:6px 0;vertical-align:top;">
                          <span style="font-size:16px;margin-right:10px;">✏️</span>
                          <span style="color:rgba(255,255,255,0.7);font-size:13px;">Adicione mais detalhes à descrição do item</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:6px 0;vertical-align:top;">
                          <span style="font-size:16px;margin-right:10px;">📸</span>
                          <span style="color:rgba(255,255,255,0.7);font-size:13px;">Inclua uma foto — itens com foto têm 3x mais matches</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:6px 0;vertical-align:top;">
                          <span style="font-size:16px;margin-right:10px;">📍</span>
                          <span style="color:rgba(255,255,255,0.7);font-size:13px;">Confirme o local onde o item foi perdido</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- CTAs -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:16px;">
                <tr>
                  <td align="center">
                    <a href="${dashboardUrl}"
                       style="display:inline-block;background:#14b8a6;color:white;font-size:14px;font-weight:700;text-decoration:none;padding:13px 28px;border-radius:12px;box-shadow:0 4px 20px rgba(20,184,166,0.25);">
                      Atualizar meu alerta →
                    </a>
                  </td>
                </tr>
              </table>
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <a href="${searchUrl}"
                       style="display:inline-block;background:transparent;color:rgba(255,255,255,0.5);font-size:13px;font-weight:500;text-decoration:none;padding:10px 24px;border:1px solid rgba(255,255,255,0.1);border-radius:10px;">
                      Buscar manualmente na rede
                    </a>
                  </td>
                </tr>
              </table>
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
      subject: `🔍 Ainda estamos procurando por "${objectTitle}" — Backfindr`,
      html,
    });

    if (error) {
      console.error('[email] Erro ao enviar reativação:', error);
    }
  } catch (err) {
    console.error('[email] Exceção ao enviar reativação:', err);
  }
}


// ─── E-mail de Guia Educativo: Como Identificar Carros Roubados ──────────────
export async function sendGuideCarTheftEmail(user: { name: string; email: string }) {
  const firstName = user.name.split(' ')[0];
  const dashboardUrl = 'https://www.backfindr.com/dashboard';

  const html = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Guia: Como Identificar Carros Roubados</title>
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
              <div style="text-align:center;margin-bottom:20px;">
                <div style="display:inline-block;background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.2);border-radius:50%;width:64px;height:64px;line-height:64px;text-align:center;">
                  <span style="font-size:28px;">🚗</span>
                </div>
              </div>

              <h1 style="color:white;font-size:22px;font-weight:700;margin:0 0 8px;text-align:center;line-height:1.3;">
                Como Identificar um Carro Roubado ou Abandonado
              </h1>
              <p style="color:rgba(255,255,255,0.55);font-size:14px;line-height:1.6;margin:0 0 24px;text-align:center;">
                Saiba reconhecer os sinais de alerta que indicam um veículo suspeito na sua região.
              </p>

              <!-- Conteúdo educativo -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);border-radius:14px;margin-bottom:24px;">
                <tr>
                  <td style="padding:20px 24px;">
                    <p style="color:rgba(255,255,255,0.35);font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.15em;margin:0 0 16px;">Sinais de Alerta</p>

                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding:12px 0;vertical-align:top;">
                          <span style="font-size:18px;margin-right:12px;">🔴</span>
                          <span style="color:white;font-size:14px;font-weight:600;">Placas Danificadas ou Cobertas</span><br/>
                          <span style="color:rgba(255,255,255,0.4);font-size:13px;">Se as placas estão sujas, cobertas ou parcialmente visíveis, é um sinal de alerta.</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:12px 0;vertical-align:top;">
                          <span style="font-size:18px;margin-right:12px;">🔴</span>
                          <span style="color:white;font-size:14px;font-weight:600;">Vidros Danificados ou Faltando</span><br/>
                          <span style="color:rgba(255,255,255,0.4);font-size:13px;">Vidros quebrados ou faltando indicam possível invasão ou abandono.</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:12px 0;vertical-align:top;">
                          <span style="font-size:18px;margin-right:12px;">🔴</span>
                          <span style="color:white;font-size:14px;font-weight:600;">Pneus Vazios ou Faltando</span><br/>
                          <span style="color:rgba(255,255,255,0.4);font-size:13px;">Um carro abandonado geralmente tem pneus vazios ou ausentes.</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:12px 0;vertical-align:top;">
                          <span style="font-size:18px;margin-right:12px;">🔴</span>
                          <span style="color:white;font-size:14px;font-weight:600;">Sem Documentação Visível</span><br/>
                          <span style="color:rgba(255,255,255,0.4);font-size:13px;">Carros roubados frequentemente têm documentação alterada ou ausente.</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- CTA -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
                <tr>
                  <td align="center">
                    <a href="${dashboardUrl}"
                       style="display:inline-block;background:#14b8a6;color:white;font-size:15px;font-weight:700;text-decoration:none;padding:14px 32px;border-radius:12px;box-shadow:0 4px 20px rgba(20,184,166,0.25);">
                      Registrar um veículo suspeito →
                    </a>
                  </td>
                </tr>
              </table>

              <p style="color:rgba(255,255,255,0.25);font-size:12px;text-align:center;margin:0;">
                Se encontrar um veículo suspeito, registre na plataforma e ajude a comunidade a recuperar o que foi perdido.
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
      subject: `🚗 Guia Backfindr: Como identificar carros roubados ou abandonados`,
      html,
    });

    if (error) {
      console.error('[email] Erro ao enviar guia de carros roubados:', error);
    }
  } catch (err) {
    console.error('[email] Exceção ao enviar guia de carros roubados:', err);
  }
}

// ─── E-mail de Guia Educativo: Cachorro Perdido ────────────────────────────
export async function sendGuideLostPetEmail(user: { name: string; email: string }) {
  const firstName = user.name.split(' ')[0];
  const dashboardUrl = 'https://www.backfindr.com/dashboard';

  const html = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Guia: Sinais de um Cachorro Perdido</title>
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
              <div style="text-align:center;margin-bottom:20px;">
                <div style="display:inline-block;background:rgba(168,85,247,0.1);border:1px solid rgba(168,85,247,0.2);border-radius:50%;width:64px;height:64px;line-height:64px;text-align:center;">
                  <span style="font-size:28px;">🐕</span>
                </div>
              </div>

              <h1 style="color:white;font-size:22px;font-weight:700;margin:0 0 8px;text-align:center;line-height:1.3;">
                Sinais de que um Cachorro Está Perdido
              </h1>
              <p style="color:rgba(255,255,255,0.55);font-size:14px;line-height:1.6;margin:0 0 24px;text-align:center;">
                Aprenda a reconhecer um cachorro perdido e como ajudar a reunir o pet com seu dono.
              </p>

              <!-- Conteúdo educativo -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);border-radius:14px;margin-bottom:24px;">
                <tr>
                  <td style="padding:20px 24px;">
                    <p style="color:rgba(255,255,255,0.35);font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.15em;margin:0 0 16px;">Como Identificar</p>

                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding:12px 0;vertical-align:top;">
                          <span style="font-size:18px;margin-right:12px;">🔍</span>
                          <span style="color:white;font-size:14px;font-weight:600;">Comportamento Assustado</span><br/>
                          <span style="color:rgba(255,255,255,0.4);font-size:13px;">Cães perdidos geralmente parecem confusos, ansiosos ou com medo de aproximação.</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:12px 0;vertical-align:top;">
                          <span style="font-size:18px;margin-right:12px;">🔍</span>
                          <span style="color:white;font-size:14px;font-weight:600;">Sem Coleira ou Identificação</span><br/>
                          <span style="color:rgba(255,255,255,0.4);font-size:13px;">Muitos cães perdidos não têm coleira, placa ou QR Code de identificação.</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:12px 0;vertical-align:top;">
                          <span style="font-size:18px;margin-right:12px;">🔍</span>
                          <span style="color:white;font-size:14px;font-weight:600;">Sinais de Desnutrição</span><br/>
                          <span style="color:rgba(255,255,255,0.4);font-size:13px;">Costelas visíveis, pelagem opaca ou magreza extrema indicam abandono recente.</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:12px 0;vertical-align:top;">
                          <span style="font-size:18px;margin-right:12px;">🔍</span>
                          <span style="color:white;font-size:14px;font-weight:600;">Ferimentos ou Sujeira</span><br/>
                          <span style="color:rgba(255,255,255,0.4);font-size:13px;">Patas machucadas, ferimentos ou sujeira excessiva sugerem tempo na rua.</span>
                        </td>
                      </tr>
                    </table>

                    <p style="color:rgba(255,255,255,0.35);font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.15em;margin:24px 0 16px;">O que Fazer</p>

                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding:8px 0;vertical-align:top;">
                          <span style="font-size:16px;margin-right:10px;">1️⃣</span>
                          <span style="color:rgba(255,255,255,0.7);font-size:13px;">Ofereça água e comida em local seguro.</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:8px 0;vertical-align:top;">
                          <span style="font-size:16px;margin-right:10px;">2️⃣</span>
                          <span style="color:rgba(255,255,255,0.7);font-size:13px;">Fotografe o cão e registre na plataforma Backfindr.</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:8px 0;vertical-align:top;">
                          <span style="font-size:16px;margin-right:10px;">3️⃣</span>
                          <span style="color:rgba(255,255,255,0.7);font-size:13px;">Leve para um veterinário para verificar microchip.</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:8px 0;vertical-align:top;">
                          <span style="font-size:16px;margin-right:10px;">4️⃣</span>
                          <span style="color:rgba(255,255,255,0.7);font-size:13px;">Compartilhe nos grupos de comunidade local.</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- CTA -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
                <tr>
                  <td align="center">
                    <a href="${dashboardUrl}"
                       style="display:inline-block;background:#14b8a6;color:white;font-size:15px;font-weight:700;text-decoration:none;padding:14px 32px;border-radius:12px;box-shadow:0 4px 20px rgba(20,184,166,0.25);">
                      Registrar um cachorro encontrado →
                    </a>
                  </td>
                </tr>
              </table>

              <p style="color:rgba(255,255,255,0.25);font-size:12px;text-align:center;margin:0;">
                Sua ação pode reunir um pet com sua família. Obrigado por ajudar! 🐾
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
      subject: `🐕 Guia Backfindr: Como ajudar um cachorro perdido`,
      html,
    });

    if (error) {
      console.error('[email] Erro ao enviar guia de cachorro perdido:', error);
    }
  } catch (err) {
    console.error('[email] Exceção ao enviar guia de cachorro perdido:', err);
  }
}

// ─── E-mail de Dica Rápida: Importância de Fotos ──────────────────────────
export async function sendTipPhotosEmail(user: { name: string; email: string }) {
  const firstName = user.name.split(' ')[0];
  const dashboardUrl = 'https://www.backfindr.com/dashboard';

  const html = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Dica Rápida: Fotos Aumentam Recuperação</title>
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
              <div style="text-align:center;margin-bottom:20px;">
                <div style="display:inline-block;background:rgba(34,197,94,0.1);border:1px solid rgba(34,197,94,0.2);border-radius:50%;width:64px;height:64px;line-height:64px;text-align:center;">
                  <span style="font-size:28px;">📸</span>
                </div>
              </div>

              <h1 style="color:white;font-size:22px;font-weight:700;margin:0 0 8px;text-align:center;line-height:1.3;">
                Você Sabia? 📸
              </h1>
              <p style="color:rgba(255,255,255,0.55);font-size:14px;line-height:1.6;margin:0 0 24px;text-align:center;">
                <strong style="color:rgba(34,197,94,1);">Objetos com fotos são recuperados 3x mais rápido!</strong><br/>
                A IA do Backfindr consegue identificar melhor itens com imagens claras e bem iluminadas.
              </p>

              <!-- Dicas -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);border-radius:14px;margin-bottom:24px;">
                <tr>
                  <td style="padding:20px 24px;">
                    <p style="color:rgba(255,255,255,0.35);font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.15em;margin:0 0 16px;">Dicas para Melhores Fotos</p>

                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding:8px 0;vertical-align:top;">
                          <span style="font-size:16px;margin-right:10px;">✅</span>
                          <span style="color:rgba(255,255,255,0.7);font-size:13px;">Tire fotos em boa iluminação (luz natural é ideal).</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:8px 0;vertical-align:top;">
                          <span style="font-size:16px;margin-right:10px;">✅</span>
                          <span style="color:rgba(255,255,255,0.7);font-size:13px;">Capture detalhes únicos (marcas, cores, características).</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:8px 0;vertical-align:top;">
                          <span style="font-size:16px;margin-right:10px;">✅</span>
                          <span style="color:rgba(255,255,255,0.7);font-size:13px;">Adicione múltiplos ângulos do objeto.</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:8px 0;vertical-align:top;">
                          <span style="font-size:16px;margin-right:10px;">✅</span>
                          <span style="color:rgba(255,255,255,0.7);font-size:13px;">Evite fundos confusos ou muito escuros.</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- CTA -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
                <tr>
                  <td align="center">
                    <a href="${dashboardUrl}"
                       style="display:inline-block;background:#14b8a6;color:white;font-size:15px;font-weight:700;text-decoration:none;padding:14px 32px;border-radius:12px;box-shadow:0 4px 20px rgba(20,184,166,0.25);">
                      Adicionar fotos aos meus objetos →
                    </a>
                  </td>
                </tr>
              </table>

              <p style="color:rgba(255,255,255,0.25);font-size:12px;text-align:center;margin:0;">
                Quanto melhor a foto, maiores as chances de recuperação!
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
      subject: `📸 Dica Rápida: Fotos aumentam em 3x a chance de recuperação!`,
      html,
    });

    if (error) {
      console.error('[email] Erro ao enviar dica de fotos:', error);
    }
  } catch (err) {
    console.error('[email] Exceção ao enviar dica de fotos:', err);
  }
}

// ─── E-mail de incentivo PWA (Lifecycle Dia 3) ────────────────────────────────
export async function sendPWAIncentiveEmail(user: { name: string; email: string }) {
  const firstName = user.name.split(' ')[0];
  const dashboardUrl = 'https://www.backfindr.com/dashboard';

  const html = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Instale o Backfindr no seu celular</title>
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
                  <span style="color:white;font-size:18px;">📱</span>
                </div>
                <span style="color:white;font-size:18px;font-weight:700;">Backfindr App</span>
              </div>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:28px 32px 32px;">
              <h1 style="color:white;font-size:24px;font-weight:700;margin:0 0 12px;line-height:1.3;text-align:center;">
                Tenha o Backfindr sempre à mão! 🚀
              </h1>
              <p style="color:rgba(255,255,255,0.55);font-size:15px;line-height:1.6;margin:0 0 24px;text-align:center;">
                Você sabia que pode instalar o Backfindr no seu celular sem precisar baixar nada na App Store ou Play Store?
              </p>

              <!-- Benefícios -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background:rgba(20,184,166,0.05);border:1px solid rgba(20,184,166,0.15);border-radius:14px;margin-bottom:24px;">
                <tr>
                  <td style="padding:20px 24px;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding:8px 0;vertical-align:top;">
                          <span style="color:#14b8a6;font-weight:700;margin-right:8px;">✓</span>
                          <span style="color:white;font-size:14px;"><b>Notificações em tempo real</b> quando seu objeto for encontrado.</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:8px 0;vertical-align:top;">
                          <span style="#14b8a6;font-weight:700;margin-right:8px;">✓</span>
                          <span style="color:white;font-size:14px;"><b>Acesso rápido</b> direto pela tela inicial do seu celular.</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:8px 0;vertical-align:top;">
                          <span style="#14b8a6;font-weight:700;margin-right:8px;">✓</span>
                          <span style="color:white;font-size:14px;"><b>Mais leve</b> que um aplicativo comum e sempre atualizado.</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Instruções -->
              <h3 style="color:white;font-size:16px;font-weight:600;margin:0 0 12px;">Como instalar:</h3>
              <div style="color:rgba(255,255,255,0.5);font-size:14px;line-height:1.6;margin-bottom:24px;">
                1. Abra <b>backfindr.com</b> no navegador do seu celular.<br/>
                2. Toque no ícone de <b>Compartilhar</b> (iOS/Safari) ou no <b>Menu ⋮</b> (Android/Chrome).<br/>
                3. Selecione <b>"Adicionar à Tela de Início"</b> ou <b>"Instalar Aplicativo"</b>.<br/>
                4. Pronto! O ícone aparecerá na sua área de trabalho.
              </div>

              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <a href="${dashboardUrl}"
                       style="display:inline-block;background:#14b8a6;color:white;font-size:15px;font-weight:700;text-decoration:none;padding:14px 32px;border-radius:12px;box-shadow:0 4px 20px rgba(20,184,166,0.25);">
                      Abrir meu Dashboard →
                    </a>
                  </td>
                </tr>
              </table>
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
    await getResend().emails.send({
      from: FROM,
      to: [user.email],
      subject: `📱 Instale o Backfindr e receba alertas em tempo real`,
      html,
    });
  } catch (err) {
    console.error('[email] Erro ao enviar incentivo PWA:', err);
  }
}

// ─── Função genérica sendEmail (usada pelo boost-expiration cron) ─────────────
export async function sendEmail({ to, subject, html }: { to: string; subject: string; html: string }) {
  try {
    const { error } = await getResend().emails.send({ from: FROM, to: [to], subject, html });
    if (error) console.error('[email] sendEmail error:', error);
  } catch (err) {
    console.error('[email] sendEmail exception:', err);
  }
}
