import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/adminGuard';
import { gaqlSearch, GoogleAdsApiError } from '@/lib/googleAds';

// GET /api/v1/admin/google-ads/diagnostics?campaign=<nome exato>
// Lê status/motivo de elegibilidade/orçamento/datas/métricas de uma campanha,
// sem precisar navegar manualmente pela UI do Google Ads.
export async function GET(req: NextRequest) {
  const auth = await requireSuperAdmin(req);
  if (auth instanceof NextResponse) return auth;

  const campaignName = req.nextUrl.searchParams.get('campaign');
  if (!campaignName) {
    return NextResponse.json({ detail: 'Parâmetro "campaign" obrigatório (nome exato da campanha)' }, { status: 400 });
  }

  const customerId = process.env.GOOGLE_ADS_CUSTOMER_ID;
  if (!customerId) {
    return NextResponse.json({ detail: 'GOOGLE_ADS_CUSTOMER_ID não configurado' }, { status: 500 });
  }

  try {
    const escapedName = campaignName.replace(/'/g, "\\'");
    const query = `
      SELECT
        campaign.id,
        campaign.name,
        campaign.status,
        campaign.primary_status,
        campaign.primary_status_reasons,
        campaign.serving_status,
        campaign.start_date_time,
        campaign.end_date_time,
        campaign_budget.id,
        campaign_budget.amount_micros,
        campaign_budget.total_amount_micros,
        campaign_budget.status,
        campaign_budget.period,
        campaign_budget.type,
        campaign_budget.delivery_method,
        metrics.impressions,
        metrics.clicks
      FROM campaign
      WHERE campaign.name = '${escapedName}'
    `;
    const result = await gaqlSearch(customerId, query);
    return NextResponse.json({ success: true, data: result.results ?? [] });
  } catch (error) {
    if (error instanceof GoogleAdsApiError) {
      return NextResponse.json({ detail: 'Erro na Google Ads API', googleAdsError: error.body }, { status: error.status });
    }
    return NextResponse.json({ detail: 'Erro interno', error: String(error) }, { status: 500 });
  }
}
