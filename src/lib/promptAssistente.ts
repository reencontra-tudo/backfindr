import { modoCrescimento } from '@/lib/modoCrescimento';

// MODO CRESCIMENTO (PL-01): o bloco de planos ORIGINAL (grátis com 3, Pro, Business) fica guardado acima, só inativo. Com o modo ligado, o assistente
// conhece apenas o plano grátis (sem limite prático) e o Boost, e NÃO fala de Pro/Business. Desligado = prompt idêntico ao de antes.
export function promptDoModo(base: string, crescimento: boolean = modoCrescimento()): string {
  if (!crescimento) return base;
  const a = base.indexOf('PLANO GRÁTIS (padrão para todos):');
  const b = base.indexOf('BOOST — destaque avulso');
  if (a < 0 || b < 0 || b < a) return base;
  const bloco = `PLANO GRÁTIS (para todos — as assinaturas de plano estão pausadas; não fale de planos pagos):
- Cadastre quantos objetos precisar (só há um teto contra abuso: 100 objetos ativos e 10 cadastros por dia; não cite o teto a menos que perguntem)
- QR Code permanente para cada objeto
- Busca manual na rede
- Suporte da comunidade
Se perguntarem por planos pagos, Pro ou Business, responda que as assinaturas estão pausadas por enquanto e que o plano gratuito já resolve.

`;
  let out = base.slice(0, a) + bloco + base.slice(b);
  // Perguntas e respostas prontas dentro do prompt que também falam de planos pagos (os textos originais continuam no `base`, só inativos).
  const trocas: Array<[string, string]> = [
    ['R: O Backfindr é gratuito para a maioria dos usos. Se quiser uma tecnologia mais robusta — como matching automático por IA, mais objetos cadastrados ou recursos avançados — existem planos opcionais a partir de R$ 29/mês. Veja em https://backfindr.com/pricing.',
     'R: O Backfindr é gratuito: você cadastra quantos objetos precisar. As assinaturas de plano estão pausadas por enquanto.'],
    ['R: Existe um plano Business com recursos avançados para hotéis, escolas e empresas. Entre em contato: business@backfindr.com',
     'R: As assinaturas de plano estão pausadas por enquanto. O Backfindr gratuito já pode ser usado por empresas, escolas e condomínios.'],
  ];
  for (const [de, para] of trocas) out = out.replace(de, para);
  return out;
}
