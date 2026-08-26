import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { sendReactivationEmail } from '@/lib/email';

// ─── GET /api/v1/cron/reactivation ───────────────────────────────────────────
// Chamado pelo Vercel Cron Jobs (vercel.json) ou manualmente pelo admin.
// Busca objetos com status 'lost' ou 'stolen' criados há mais de 24h,
// sem match confirmado, e envia e-mail de reativação ao dono.
//
// v2: Dicas personalizadas por categoria e campos ausentes — lógica
//     determinística, zero custo de IA, zero latência extra.
//
// Proteção: CRON_SECRET deve ser passado no header Authorization.

// ─── Tipos ────────────────────────────────────────────────────────────────────
interface ObjectRow {
  object_id: string;
  object_title: string;
  object_description: string | null;
  object_status: string;
  object_category: string | null;
  object_color: string | null;
  object_brand: string | null;
  object_images: string;
  object_location: string | null;
  object_latitude: string | null;
  object_longitude: string | null;
  object_reward_amount: string | null;
  user_id: string;
  user_name: string;
  user_email: string;
  days_since_creation: number;
  candidate_count: number;
}

// ─── Dicas determinísticas expandidas por categoria ──────────────────────────
function generatePersonalizedTips(obj: ObjectRow): string[] {
  let images: string[] = [];
  try { images = JSON.parse(obj.object_images || '[]'); } catch { images = []; }

  const hasPhoto       = images.length > 0;
  const hasDescription = !!(obj.object_description && obj.object_description.trim().length > 20);
  const hasColor       = !!obj.object_color;
  const hasBrand       = !!obj.object_brand;
  const hasLocation    = !!(obj.object_latitude && obj.object_longitude);
  const hasReward      = !!obj.object_reward_amount;
  const category       = (obj.object_category || '').toLowerCase();
  const isPet          = category === 'pet' || category === 'animal';
  const isVehicle      = ['veiculo', 'veículo', 'carro', 'moto', 'bicicleta', 'bike'].includes(category);
  const isPhone        = ['celular', 'smartphone', 'telefone', 'phone'].includes(category);
  const isDocument     = ['documento', 'carteira', 'rg', 'cpf', 'passaporte'].includes(category);

  const tips: string[] = [];

  // ── Prioridade 1: foto ────────────────────────────────────────────────────
  if (!hasPhoto) {
    if (isPet) {
      tips.push('Adicione uma foto clara do pet — rostos e marcas únicas são essenciais para identificação rápida.');
    } else if (isVehicle) {
      tips.push('Adicione fotos do veículo, especialmente da placa e de detalhes únicos (adesivos, amassados, cor).');
    } else {
      tips.push('Adicione uma foto ao cadastro — objetos com foto têm 3× mais chances de match na rede.');
    }
  }

  // ── Prioridade 2: descrição ───────────────────────────────────────────────
  if (!hasDescription) {
    if (isPet) {
      tips.push('Descreva raça, porte, cor do pelo, coleira, chip e comportamento — cada detalhe conta para quem encontrou.');
    } else if (isVehicle) {
      tips.push('Descreva placa, cor exata, modelo, ano e qualquer detalhe visual que diferencie o veículo.');
    } else if (isPhone) {
      tips.push('Informe modelo exato, cor, IMEI (se souber) e se há capinha — facilita muito a identificação.');
    } else if (isDocument) {
      tips.push('Descreva quais documentos estão na carteira e qualquer detalhe da capa ou objeto junto.');
    } else {
      tips.push('Escreva uma descrição detalhada: inclua cor, marca, modelo e qualquer característica única do objeto.');
    }
  }

  // ── Prioridade 3: cor ─────────────────────────────────────────────────────
  if (!hasColor && !isPet) {
    if (isVehicle) {
      tips.push('Informe a cor exata do veículo (ex: "prata metálico" em vez de "cinza") — melhora muito o matching.');
    } else {
      tips.push('Informe a cor exata do objeto (ex: "azul marinho" em vez de "azul") — isso melhora o matching.');
    }
  }

  // ── Prioridade 4: marca/modelo ────────────────────────────────────────────
  if (!hasBrand && !isPet && !isDocument) {
    if (isPhone) {
      tips.push('Informe a marca e modelo exato do celular — isso é o primeiro dado que quem encontra vai checar.');
    } else if (isVehicle) {
      tips.push('Confirme marca, modelo e ano do veículo — esses dados são cruzados automaticamente com registros de B.O.');
    } else {
      tips.push('Adicione a marca ou modelo do objeto — itens com marca têm matching mais preciso na rede.');
    }
  }

  // ── Prioridade 5: localização ─────────────────────────────────────────────
  if (!hasLocation) {
    if (isPet) {
      tips.push('Marque no mapa o local onde o pet foi visto pela última vez — o raio de busca começa por aí.');
    } else {
      tips.push('Adicione a localização de onde perdeu — mesmo um bairro aproximado já ajuda o sistema a encontrar matches.');
    }
  }

  // ── Prioridade 6: recompensa ──────────────────────────────────────────────
  if (!hasReward && !isDocument) {
    if (isPet) {
      tips.push('Adicione uma recompensa — pets com recompensa têm muito mais compartilhamentos e retornos.');
    } else {
      tips.push('Considere adicionar uma recompensa simbólica — objetos com recompensa recebem mais atenção na rede.');
    }
  }

  // ── Dica de ação social — sempre presente se ainda há espaço ─────────────
  if (tips.length < 3) {
    if (isPet) {
      tips.push('Compartilhe o link do cadastro em grupos de WhatsApp do bairro e páginas de pets perdidos — é a ação mais eficaz.');
    } else if (isVehicle) {
      tips.push('Avise postos de combustível, estacionamentos e oficinas da região — eles são os primeiros a ver veículos suspeitos.');
    } else {
      tips.push('Compartilhe o link do objeto em grupos do WhatsApp do bairro — é a ação que mais gera resultado.');
    }
  }

  // ── Cadastro completo ─────────────────────────────────────────────────────
  if (tips.length === 0) {
    tips.push('Seu cadastro está completo e bem detalhado — continue com o alerta ativo.');
    tips.push('Compartilhe o link do objeto em grupos do WhatsApp do bairro para ampliar o alcance.');
    tips.push('Acesse o mapa ao vivo para ver se há algum registro compatível próximo de você.');
  }

  return tips.slice(0, 3);
}

// ─── Handler ──────────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const secret = req.headers.get('authorization')?.replace('Bearer ', '');
  const cronSecret = process.env.CRON_SECRET;
  // Fail-closed (25/08/2026, rotação do CRON_SECRET): sem essa checagem
  // extra, CRON_SECRET indefinido + nenhum header Authorization enviado
  // resultava em `undefined !== undefined` = false, ou seja, passava sem
  // autenticação nenhuma.
  if (!cronSecret || secret !== cronSecret) {
    return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Busca objetos perdidos/roubados sem match confirmado
    // e cujo dono ainda não recebeu e-mail de reativação nas últimas 24h
    const result = await query(`
      SELECT
        o.id                                                          AS object_id,
        o.title                                                       AS object_title,
        o.description                                                 AS object_description,
        o.status                                                      AS object_status,
        o.category                                                    AS object_category,
        o.color                                                       AS object_color,
        o.brand                                                       AS object_brand,
        COALESCE(o.images::text, '[]')                                AS object_images,
        o.location                                                    AS object_location,
        o.latitude::text                                              AS object_latitude,
        o.longitude::text                                             AS object_longitude,
        o.reward_amount::text                                         AS object_reward_amount,
        u.id                                                          AS user_id,
        u.name                                                        AS user_name,
        u.email                                                       AS user_email,
        EXTRACT(EPOCH FROM (NOW() - o.created_at)) / 86400            AS days_since_creation,
        (
          SELECT COUNT(*) FROM objects candidates
          WHERE candidates.status IN ('found')
            AND candidates.id != o.id
            AND (candidates.category = o.category OR candidates.type = o.category)
        )                                                             AS candidate_count
      FROM objects o
      JOIN users u ON u.id = o.user_id
      WHERE o.status IN ('lost', 'stolen')
        AND o.created_at BETWEEN NOW() - INTERVAL '72 hours' AND NOW() - INTERVAL '24 hours'
        AND u.email IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM matches m
          WHERE (m.lost_object_id = o.id OR m.found_object_id = o.id)
            AND m.status = 'confirmed'
        )
        AND NOT EXISTS (
          SELECT 1 FROM reactivation_emails re
          WHERE re.object_id = o.id
            AND re.sent_at > NOW() - INTERVAL '24 hours'
        )
      LIMIT 50
    `);

    const rows = result.rows as ObjectRow[];

    if (!rows.length) {
      return NextResponse.json({ sent: 0, message: 'Nenhum objeto elegível' });
    }

    let sent = 0;
    const errors: string[] = [];

    for (const row of rows) {
      try {
        // Gera dicas personalizadas por categoria (zero custo, zero latência)
        const tips = generatePersonalizedTips(row);

        await sendReactivationEmail(
          { name: row.user_name, email: row.user_email },
          row.object_title,
          tips,
        );

        // Registra o envio para não duplicar
        await query(
          `INSERT INTO reactivation_emails (object_id, user_id, sent_at)
           VALUES ($1, $2, NOW())
           ON CONFLICT (object_id) DO UPDATE SET sent_at = NOW()`,
          [row.object_id, row.user_id],
        );

        sent++;
      } catch (err) {
        errors.push(`${row.user_email}: ${String(err)}`);
      }
    }

    return NextResponse.json({
      success: true,
      sent,
      failed: errors.length,
      total: rows.length,
      errors: errors.slice(0, 10),
    });
  } catch (err) {
    console.error('[cron/reactivation]', err);
    return NextResponse.json({ detail: String(err) }, { status: 500 });
  }
}
