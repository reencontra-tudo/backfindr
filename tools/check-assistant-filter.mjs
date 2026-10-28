#!/usr/bin/env node
// Testes do filtro de linguagem do assistente (src/lib/assistantFilter.ts).
// Sem dependência nova: transpila o TypeScript com o `typescript` que o projeto já tem.
// Não faz chamada de rede, não usa chave de IA e não grava nada.
//
// Como rodar (na raiz do repositório):
//   node tools/check-assistant-filter.mjs
//   node tools/check-assistant-filter.mjs --gravadas caminho/resposta1.json caminho/resposta2.json
//
// --gravadas (opcional): arquivos JSON com respostas já obtidas do modelo, nos formatos
//   [{ "q": "...", "reply": "..." }]  ou  [{ "q": "...", "runs": ["...", "..."] }].
//   O script confirma que nenhuma forma proibida sobrevive ao filtro e lista os disparos.
//
// Sai com código 1 se algum teste falhar.

import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';

const ROOT = process.cwd();
const require = createRequire(join(ROOT, 'package.json'));
const ts = require('typescript');

function carregarTs(arquivo, mapa = {}, rodape = '') {
  const fonte = readFileSync(join(ROOT, arquivo), 'utf8') + rodape;
  const js = ts.transpileModule(fonte, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  }).outputText;
  const mod = { exports: {} };
  const req = (id) => (id in mapa ? mapa[id] : require(id));
  new Function('require', 'exports', 'module', js)(req, mod.exports, mod);
  return mod.exports;
}

const filtro = carregarTs('src/lib/assistantFilter.ts');
const { aplicarFiltroDeLinguagem, T1, T3 } = filtro;

let ok = 0;
const falhas = [];
function confere(cond, nome, detalhe = '') {
  if (cond) ok++;
  else falhas.push(detalhe ? `${nome} -> ${detalhe}` : nome);
}
const ids = (t) => aplicarFiltroDeLinguagem(t).padroes.join(',');

// ── 1. Padrões: o que DEVE disparar ──────────────────────────────────────────
const DEVE = [
  ['P1', 'Seu contato pessoal não fica exposto diretamente.'],
  ['P1', 'Os dados não são expostos.'],
  ['P1', 'Seu telefone não está exposto para ninguém.'],
  ['P1b', 'O sistema não expõe seu número.'],
  ['P2', 'Você pode registrar sem expor seu número.'],
  ['P3', 'Seu telefone não aparece para ninguém.'],
  ['P3', 'Ninguém verá seu número de telefone.'],
  ['P4', 'Seu contato fica protegido.'],
  ['P4', 'O seu e-mail está protegido.'],
  ['P4', 'Seu número fica oculto.'],
  ['P4', 'Seus dados ficam preservados.'],
  ['P3', 'Seu telefone não é compartilhado diretamente.'],
  ['P3', 'Os dados não são compartilhados com ninguém.'],
  ['P3', 'Seu número não foi compartilhado.'],
  ['P3', 'Seu e-mail e seu contato não foram compartilhados.'],
  ['P4', 'Suas informações estão protegidas.'],
  ['P4', 'Sua privacidade importa e suas informações ficam protegidas.'],
  ['P4', 'Seu contato fica protegido com o QR Code.'],
  ['P4', 'Seu telefone está protegido e o objeto também.'],
  ['P4', 'O objeto protegido tem o telefone protegido.'],
  ['P4', 'Seu e-mail protegido aparece só para você.'],
  ['P5', 'Garantindo uma devolução mais tranquila.'],
  ['P5', 'Pra garantir que o dono receba o aviso, registre.'],
  ['P5', 'O Backfindr garante a devolução.'],
  ['P5', 'Garantimos uma mediação segura.'],
  ['P5', 'Tem garantia de recuperação.'],
  ['P5', 'O que a gente garante é que a plataforma é gratuita.'],
];
for (const [id, frase] of DEVE) {
  confere(ids(frase).split(',').includes(id), `deve disparar ${id}`, frase);
}

// ── 2. Padrões: o que NÃO deve disparar ──────────────────────────────────────
const NAO = [
  'O objeto não está exposto na vitrine.',
  'Não é possível garantir a recuperação, mas o Backfindr pode ajudar a aumentar as oportunidades de reencontro.',
  'Não dá pra garantir 100% que vai recuperar.',
  'Ninguém pode garantir a recuperação.',
  'Sem garantia de resultado, mas vale registrar.',
  'O Backfindr não pode garantir a recuperação do seu objeto.',
  'A conversa acontece pelo chat da plataforma.',
  'O aviso é enviado quando alguém escaneia o QR Code.',
  'Seu objeto protegido com QR Code aparece no painel.',
  'O objeto não aparece nos resultados da busca ainda.',
  'O objeto protegido com QR Code aparece no painel.',
  'O objeto protegido mostra apenas informações básicas no painel.',
  'Seus itens protegidos aparecem no painel.',
  'O bem protegido pode ser consultado pelo código.',
  'Os bens protegidos têm informações básicas no painel.',
  'Seu objeto protegido tem as informações do QR Code.',
  'As informações do objeto estão no painel.',
  'O objeto não é compartilhado nas redes até você publicar.',
  'O objeto não foi compartilhado ainda; use o botão de compartilhar.',
  'Você pode compartilhar o link do seu alerta no WhatsApp do bairro.',
  'Seus dados ficam visíveis só para você no seu dashboard.',
  'Entendo que você quer manter seus dados seguros.',
  'Você quer manter seus dados seguros, isso é super importante.',
  'Entendo que você quer garantir sua privacidade.',
  'Plataforma global de recuperação de objetos perdidos com IA de matching e chat mediado para devolução segura.',
  'O telefone do aparelho perdido pode ser bloqueado pela operadora.',
  'Registre aqui: https://backfindr.com/perdi',
  'O QR Code não é obrigatório: é uma forma opcional de identificar bens antes de qualquer perda.',
];
for (const frase of NAO) {
  confere(!aplicarFiltroDeLinguagem(frase).disparou, 'NÃO deve disparar', frase);
}

// ── 3. Respostas limpas passam idênticas, byte a byte (acentos, emoji, quebras, links) ──
const LIMPAS = [
  'Plataforma global de recuperação de objetos perdidos com IA de matching e chat mediado para devolução segura.\n\nAqui você registra o que perdeu, foi roubado ou encontrou 🔍\n\nComece em https://backfindr.com/perdi  \n',
  'Poxa, entendo 😔\n\n• Registre em https://backfindr.com/encontrei\n• A conversa acontece pelo chat da plataforma.\n\nSe precisar, tô aqui!',
  'Sim. O Backfindr pode ser usado em qualquer lugar do mundo: quem perdeu e quem achou registram a ocorrência de onde estiverem.',
];
for (const t of LIMPAS) {
  const r = aplicarFiltroDeLinguagem(t);
  confere(r.texto === t && !r.disparou && r.acao === 'nenhuma', 'resposta limpa idêntica', t.slice(0, 40));
  confere(r.texto.includes('https://backfindr.com') || !t.includes('https://'), 'links preservados', t.slice(0, 40));
}
const DEFINICAO =
  'Plataforma global de recuperação de objetos perdidos com IA de matching e chat mediado para devolução segura.';
confere(aplicarFiltroDeLinguagem(DEFINICAO + ' Veja https://backfindr.com/perdi').texto.startsWith(DEFINICAO), 'definição oficial intacta');

// ── 4. Substituição de frase e remoção (P5) ──────────────────────────────────
{
  const r = aplicarFiltroDeLinguagem(
    'Poxa, entendo sua preocupação. No Backfindr, a conversa acontece pelo chat da plataforma, então seu contato pessoal não fica exposto diretamente. Se quiser, posso ajudar a cadastrar.'
  );
  confere(r.acao === 'frase' && r.texto === `Poxa, entendo sua preocupação. ${T1} Se quiser, posso ajudar a cadastrar.`, 'T1 substitui só a frase', r.texto);
  confere(r.padroes.join() === 'P1' && r.nFrases === 1, 'ids e número de frases', JSON.stringify(r));
}
{
  const r = aplicarFiltroDeLinguagem(
    'Poxa, entendo. O Backfindr ajuda quem perdeu algo. Pra garantir que o dono receba o aviso, registre o que encontrou. Quanto antes fizer, melhor.'
  );
  confere(r.acao === 'frase' && !/garant/i.test(r.texto) && r.texto.includes('Quanto antes fizer, melhor.'), 'P5 remove a frase (T2)', r.texto);
}

{
  // a frase marcada já continha a parte permitida: sobra uma só ocorrência, sem recuo
  const r = aplicarFiltroDeLinguagem('Olá. A conversa acontece pelo chat da plataforma, então seu contato pessoal não fica exposto diretamente. Quer ajuda? Fale comigo.');
  confere(r.acao === 'frase' && r.texto === `Olá. ${T1} Quer ajuda? Fale comigo.`, 'uma só ocorrência da frase fixa: sem recuo', r.texto);
}

// ── 5. Recuos para a resposta inteira (T3) ───────────────────────────────────
const RECUOS = [
  ['mais de uma frase marcada', 'Olá. Seu telefone não aparece para ninguém. Seu contato fica protegido. Fale comigo.'],
  ['frase marcada com URL', 'Olá. Seu contato pessoal não fica exposto, veja https://backfindr.com/perdi. Fale comigo. Obrigado.'],
  ['primeira frase em resposta curta', 'Seu contato fica protegido. Obrigado.'],
  ['frase fixa repetida', `${T1} Seu telefone não aparece para ninguém. Quer ajuda? Fale comigo.`],
  ['restam menos de 2 frases', 'Olá. Seu contato pessoal não fica exposto diretamente.'],
  ['frase fixa repetida com outras maiúsculas e prefixo', 'Olá, tudo bem. No Backfindr, a conversa acontece pelo chat da plataforma. Seu telefone não aparece para ninguém. Quer ajuda? Fale comigo.'],
  ['frase fixa repetida (modelo já tinha dito em outra frase)', 'Olá. A conversa acontece pelo chat da plataforma. Seu contato pessoal não fica exposto diretamente. Quer ajuda? Fale comigo.'],
  ['conectivo solto logo depois', 'Olá, tudo bem. Seu contato pessoal não fica exposto diretamente. Assim, a conversa fica tranquila. Quer ajuda?'],
  ['termina com conectivo', 'Olá, tudo bem. Seu contato fica protegido. Quer ajuda? Posso te ajudar, mas'],
];
for (const [nome, t] of RECUOS) {
  const r = aplicarFiltroDeLinguagem(t);
  confere(r.acao === 'resposta' && r.texto === T3, `recuo: ${nome}`, JSON.stringify(r));
}
confere(
  !/^(?:assim|ent[ãa]o|al[ée]m disso|mas|e)\b/i.test(aplicarFiltroDeLinguagem('Olá, tudo bem. Seu contato fica protegido. Obrigado por perguntar. Quer ajuda?').texto),
  'resultado não começa com conectivo solto'
);

// ── 6. Ponta a ponta com o modelo substituído por stub (getOpenAIResponse) ───
{
  const rodape = '\nexports.__t = { getOpenAIResponse };\n';
  const stubs = {
    next: {},
    'next/server': { NextResponse: { json: () => ({}) }, NextRequest: class {} },
    '@/lib/db': { query: async () => ({ rows: [] }) },
    '@/lib/jwt': { verifyToken: () => null, extractTokenFromHeader: () => null },
    '@/lib/assistantFilter': filtro,
  };
  const rota = carregarTs('src/app/api/v1/assistant/chat/route.ts', stubs, rodape);
  const antesFetch = globalThis.fetch;
  const antesWarn = console.warn;
  const antesChave = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = 'valor-falso-so-para-teste-local';

  async function pergunta(respostaDoModelo, texto = 'MENSAGEM-DA-PESSOA-QUE-NAO-PODE-APARECER-NO-LOG') {
    globalThis.fetch = async () => ({ ok: true, json: async () => ({ choices: [{ message: { content: respostaDoModelo } }] }) });
    const logs = [];
    console.warn = (...a) => logs.push(a.join(' '));
    try {
      const saida = await rota.__t.getOpenAIResponse([{ role: 'user', content: texto }], 'prompt');
      return { saida, logs };
    } finally {
      console.warn = antesWarn;
    }
  }

  try {
    const limpa = 'Poxa, entendo 😔\n\nRegistre em https://backfindr.com/perdi\n\nA conversa acontece pelo chat da plataforma.';
    let r = await pergunta(limpa);
    confere(r.saida === limpa && r.logs.length === 0, 'e2e: resposta limpa idêntica e sem log', r.saida);

    r = await pergunta('Entendo. No Backfindr, seu contato pessoal não fica exposto diretamente. Registre em https://backfindr.com/perdi agora.');
    confere(r.saida.includes(T1) && !/exposto/.test(r.saida) && r.saida.includes('https://backfindr.com/perdi'), 'e2e: frase trocada, link mantido', r.saida);
    confere(r.logs.length === 1, 'e2e: um log por disparo', String(r.logs.length));
    const log = JSON.parse(r.logs[0]);
    confere(
      Object.keys(log).sort().join() === 'acao,evento,n_frases,padroes' && log.evento === 'assistente_filtro',
      'e2e: log só com evento, ids, ação e nº de frases',
      r.logs[0]
    );
    confere(!r.logs[0].includes('MENSAGEM-DA-PESSOA') && !/contato|exposto|backfindr/i.test(r.logs[0]), 'e2e: log sem texto da pessoa nem da resposta', r.logs[0]);

    r = await pergunta('Olá. Seu telefone não aparece para ninguém. Seu contato fica protegido. Fale comigo.');
    confere(r.saida === T3, 'e2e: recuo para T3', r.saida);

    // O filtro roda antes do sanitizeUrls: uma rota inválida na resposta segue sendo corrigida
    r = await pergunta('Veja https://backfindr.com/rota-que-nao-existe agora. A conversa acontece pelo chat da plataforma.');
    confere(!r.saida.includes('rota-que-nao-existe'), 'e2e: sanitizeUrls continua valendo depois do filtro', r.saida);
  } finally {
    globalThis.fetch = antesFetch;
    console.warn = antesWarn;
    if (antesChave === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = antesChave;
  }
}

// ── 7. Respostas gravadas (opcional): nenhuma forma proibida pode sobreviver ──
const i = process.argv.indexOf('--gravadas');
if (i !== -1) {
  const arquivos = process.argv.slice(i + 1).filter((a) => !a.startsWith('--'));
  let total = 0;
  let dispararam = 0;
  const porId = {};
  for (const arq of arquivos) {
    let dados;
    try {
      dados = JSON.parse(readFileSync(arq, 'utf8'));
    } catch {
      console.log(`(ignorado: ${arq})`);
      continue;
    }
    for (const item of dados) {
      const textos = item.runs ?? [item.reply];
      for (const t of textos) {
        if (typeof t !== 'string') continue;
        total++;
        const r = aplicarFiltroDeLinguagem(t);
        if (r.disparou) {
          dispararam++;
          r.padroes.forEach((p) => (porId[p] = (porId[p] || 0) + 1));
          const de = aplicarFiltroDeLinguagem(r.texto); // o resultado não pode disparar de novo
          confere(!de.disparou, 'gravada: o resultado do filtro não contém forma proibida', r.texto.slice(0, 80));
        } else {
          confere(r.texto === t, 'gravada limpa: idêntica');
        }
      }
    }
  }
  console.log(`Respostas gravadas: ${total} | disparam: ${dispararam} | por padrão: ${JSON.stringify(porId)}`);
  console.log('(revisar à mão se algum disparo é falso positivo; meta: 0)');
}

console.log(`${ok} verificações ok, ${falhas.length} falha(s).`);
if (falhas.length) {
  for (const f of falhas) console.log('FALHA:', f);
  process.exit(1);
}
