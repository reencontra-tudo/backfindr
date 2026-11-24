import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { successResponse, internalErrorResponse } from '@/lib/response';
import { modoCrescimento, TEXTOS_CRESCIMENTO } from '@/lib/modoCrescimento';
import { LIMITES_CRESCIMENTO } from '@/lib/planos';

export const dynamic = 'force-dynamic';

// Planos padrão caso a tabela ainda não exista ou esteja vazia
const DEFAULT_PLANS = [
  {
    slug: 'free',
    name: 'Grátis',
    price_brl: 0,
    max_objects: 3,
    features: ['3 objetos', 'QR Code permanente', 'Busca manual', 'Suporte comunidade'],
    is_active: true,
  },
  {
    slug: 'pro',
    name: 'Pro',
    price_brl: 29.00,
    max_objects: 50,
    features: ['50 objetos', 'Matching automático', 'Notificações push e email', 'QR Code personalizado', 'Suporte por email', 'Relatório básico'],
    is_active: true,
  },
  {
    slug: 'business',
    name: 'Business',
    price_brl: 149.00,
    max_objects: 500,
    features: ['500 objetos', 'Matching prioritário', 'Notificações push e email', 'QR Code bulk', '5 usuários na conta', 'Relatórios completos', 'Suporte prioritário', 'Acesso à API'],
    is_active: true,
  },
];

// Modo crescimento (PL-01): só o plano grátis aparece (Pro e Business escondidos), com o texto de crescimento; o banco (`plan_configs`) NÃO é alterado.
// Desligado (NEXT_PUBLIC_MODO_CRESCIMENTO=0): resposta idêntica à de antes (banco ou valores padrão).
function visiveis<T extends { slug: string }>(plans: T[]) {
  if (!modoCrescimento()) return plans;
  return plans
    .filter((p) => p.slug === 'free')
    .map((p) => ({ ...p, max_objects: LIMITES_CRESCIMENTO.free.maxObjetos, features: [...TEXTOS_CRESCIMENTO.free.features] }));
}

// GET /api/v1/plans — lista planos ativos
export async function GET(_req: NextRequest) {
  try {
    const result = await query(
      `SELECT slug, name, price_brl, max_objects, features, is_active, stripe_price_id, mp_plan_id
       FROM plan_configs
       WHERE is_active = true
       ORDER BY price_brl ASC`
    );

    const plans = result.rows.length > 0
      ? result.rows.map(r => ({
          ...r,
          features: Array.isArray(r.features) ? r.features : JSON.parse(r.features || '[]'),
        }))
      : DEFAULT_PLANS;

    return successResponse({ plans: visiveis(plans), modo_crescimento: modoCrescimento() });
  } catch {
    // Tabela ainda não existe — retorna defaults
    return successResponse({ plans: visiveis(DEFAULT_PLANS), modo_crescimento: modoCrescimento() });
  }
}
