// src/app/sitemap.ts
// Sitemap dinâmico — gerado a partir do banco em cada build/revalidação
// Cobre: páginas estáticas + objetos públicos + posts da comunidade

import type { MetadataRoute } from 'next';

const BASE = 'https://backfindr.com';

// Páginas estáticas com prioridade configurada
const STATIC_PAGES: MetadataRoute.Sitemap = [
  { url: BASE,                  lastModified: new Date(), changeFrequency: 'daily',   priority: 1.0 },
  { url: `${BASE}/map`,         lastModified: new Date(), changeFrequency: 'hourly',  priority: 0.9 },
  { url: `${BASE}/comunidade`,  lastModified: new Date(), changeFrequency: 'daily',   priority: 0.9 },
  { url: `${BASE}/buscar`,      lastModified: new Date(), changeFrequency: 'hourly',  priority: 0.8 },
  { url: `${BASE}/pet`,         lastModified: new Date(), changeFrequency: 'weekly',  priority: 0.8 },
  { url: `${BASE}/pricing`,     lastModified: new Date(), changeFrequency: 'weekly',  priority: 0.7 },
  { url: `${BASE}/perdi`,       lastModified: new Date(), changeFrequency: 'weekly',  priority: 0.7 },
  { url: `${BASE}/achei`,       lastModified: new Date(), changeFrequency: 'weekly',  priority: 0.7 },
  { url: `${BASE}/b2b/cadastro`,lastModified: new Date(), changeFrequency: 'monthly', priority: 0.6 },
  { url: `${BASE}/faq`,         lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
  { url: `${BASE}/privacy`,     lastModified: new Date(), changeFrequency: 'yearly',  priority: 0.3 },
  { url: `${BASE}/terms`,       lastModified: new Date(), changeFrequency: 'yearly',  priority: 0.3 },
];

// ─── Robustez: o sitemap nunca pode devolver erro ─────────────────────────────
// Qualquer falha de rede, resposta inválida, data inválida ou demora da API só reduz o que
// entra no arquivo (cai para o que já foi lido ou para as páginas estáticas); nunca lança erro.
const FETCH_TIMEOUT_MS = 10_000;   // por requisição
const TOTAL_BUDGET_MS = 40_000;    // orçamento total (a geração estática tem limite de 60 s)

function validDate(...values: Array<string | undefined | null>): Date | undefined {
  for (const v of values) {
    if (!v) continue;
    const d = new Date(v);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return undefined; // sem data válida: o campo lastModified é omitido
}

async function getJson<T>(url: string, revalidate: number): Promise<T | null> {
  try {
    const res = await fetch(url, { next: { revalidate }, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
    if (!res.ok) return null;
    return await res.json() as T;
  } catch {
    return null;
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  try {
    return await buildSitemap();
  } catch {
    return STATIC_PAGES; // última rede de segurança
  }
}

async function buildSitemap(): Promise<MetadataRoute.Sitemap> {
  const startedAt = Date.now();

  // Posts da comunidade — alta prioridade para SEO de conteúdo
  const communityUrls: MetadataRoute.Sitemap = [];
  const community = await getJson<{ posts?: Array<{ slug?: string; published_at?: string; category?: string }> }>(
    `${BASE}/api/v1/comunidade/posts?limit=200`, 3600, // revalida a cada 1h
  );
  for (const post of community?.posts ?? []) {
    if (!post.slug) continue;
    communityUrls.push({
      url: `${BASE}/comunidade/${encodeURIComponent(post.slug)}`,
      lastModified: validDate(post.published_at),
      changeFrequency: 'weekly' as const,
      priority: post.category === 'guia' ? 0.9 : 0.8, // guias têm prioridade máxima
    });
  }

  // Objetos públicos — SEO de cauda longa por tipo/localização.
  // A API devolve no máximo 500 itens por página; percorre as páginas até esgotar
  // (teto de segurança: o sitemap aceita até 50.000 URLs por arquivo).
  const OBJECTS_PAGE_SIZE = 500;
  const OBJECTS_MAX_PAGES = 80;
  const objectUrls: MetadataRoute.Sitemap = [];
  const seenCodes = new Set<string>();
  for (let page = 1; page <= OBJECTS_MAX_PAGES; page++) {
    if (Date.now() - startedAt > TOTAL_BUDGET_MS) break;
    const data = await getJson<{ items?: Array<{ unique_code?: string; updated_at?: string; created_at?: string }> }>(
      `${BASE}/api/v1/objects/public?limit=${OBJECTS_PAGE_SIZE}&page=${page}`, 1800, // revalida a cada 30min
    );
    if (!data) break; // falhou no meio: fica com o que já foi lido
    const items = Array.isArray(data.items) ? data.items : [];
    for (const obj of items) {
      if (!obj.unique_code || seenCodes.has(obj.unique_code)) continue;
      seenCodes.add(obj.unique_code);
      objectUrls.push({
        url: `${BASE}/objeto/${encodeURIComponent(obj.unique_code)}`,
        lastModified: validDate(obj.updated_at, obj.created_at),
        changeFrequency: 'daily' as const,
        priority: 0.6,
      });
    }
    if (items.length < OBJECTS_PAGE_SIZE) break;
  }

  return [...STATIC_PAGES, ...communityUrls, ...objectUrls];
}
