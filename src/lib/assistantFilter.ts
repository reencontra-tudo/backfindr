// Filtro de linguagem aplicado à resposta do modelo do assistente (Findr).
// Função pura: não faz chamada de rede, não lê banco e não registra nada.
//
// Regras (decisão do Marcos, 28/10/2026): o texto do assistente não pode prometer proteção de
// telefone, e-mail ou contato, nem usar "garantir" em afirmações. A única formulação permitida
// sobre contato é "A conversa acontece pelo chat da plataforma."
//
// Estratégia: substitui só a frase que casou com um padrão; recua para a resposta inteira (T3)
// quando o corte puder deixar o texto incoerente.
//
// As expressões são montadas com RegExp(...) porque usam \p{L} e lookbehind (o target do
// projeto é ES2017; em tempo de execução, o Node suporta).

export type AcaoFiltro = 'nenhuma' | 'frase' | 'resposta';

export interface ResultadoFiltro {
  texto: string;
  disparou: boolean;
  padroes: string[];
  acao: AcaoFiltro;
  nFrases: number;
}

// Textos fixos aprovados
export const T1 = 'A conversa acontece pelo chat da plataforma.';
export const T3 =
  'A conversa acontece pelo chat da plataforma. Para registrar o que você perdeu, foi roubado ou encontrou, acesse https://backfindr.com/perdi ou https://backfindr.com/encontrei.';

const ANTES = '(?<![\\p{L}\\d])';
const DEPOIS = '(?![\\p{L}\\d])';
const CONTATO = new RegExp(
  `${ANTES}(?:telefone|n[úu]mero|e-?mail|contato|whatsapp|dados|informa[çc][õo]es\\s+pessoais)${DEPOIS}`,
  'iu'
);
const JANELA_CONTATO = 60;
const JANELA_NEGACAO = 45;

const NEGACAO = new RegExp(
  `(?:${ANTES}n[ãa]o|${ANTES}nem|${ANTES}sem|${ANTES}nunca|${ANTES}ningu[ée]m|${ANTES}imposs[ií]vel)${DEPOIS}[^.!?\\n]{0,${JANELA_NEGACAO}}$`,
  'iu'
);
const ECO = new RegExp(
  `${ANTES}(?:voc[êe]|vc|tu)\\s+(?:quer|queira|quiser|precisa|deseja|gostaria\\s+de)\\s*$`,
  'iu'
);

interface Padrao {
  id: string;
  re: RegExp;
  exigeContato?: boolean;
  negacao?: boolean;
  contato: boolean; // pertence ao grupo de contato (T1) ou só a "garantir" (T2)
}

const PADROES: Padrao[] = [
  {
    id: 'P1',
    contato: true,
    exigeContato: true,
    re: new RegExp(
      `${ANTES}n[ãa]o\\s+(?:fica(?:m)?|[ée]|s[ãa]o|est[áa](?:o)?|vai|v[ãa]o|ser[áa](?:o)?|foi|foram)\\s+(?:\\p{L}+\\s+){0,2}?expost[oa]s?${DEPOIS}`,
      'giu'
    ),
  },
  {
    id: 'P1b',
    contato: true,
    exigeContato: true,
    re: new RegExp(`${ANTES}n[ãa]o\\s+(?:exp[õo]e|exp[õo]em|expomos|exponho)${DEPOIS}`, 'giu'),
  },
  {
    id: 'P2',
    contato: true,
    re: new RegExp(
      `${ANTES}sem\\s+(?:te\\s+|lhe\\s+|se\\s+)?expor${DEPOIS}|${ANTES}sem\\s+exposi[çc][ãa]o${DEPOIS}`,
      'giu'
    ),
  },
  {
    id: 'P3',
    contato: true,
    exigeContato: true,
    re: new RegExp(
      `${ANTES}n[ãa]o\\s+(?:aparece|aparecem|ser[áa]\\s+(?:exibid|mostrad|divulgad|vist)[oa]s?|[ée]\\s+(?:exibid|mostrad|divulgad|vist)[oa]s?|fica(?:m)?\\s+vis[ií]ve(?:l|is))${DEPOIS}|${ANTES}ningu[ée]m\\s+(?:ver[áa]|v[êe]|consegue\\s+ver|tem\\s+acesso)${DEPOIS}`,
      'giu'
    ),
  },
  {
    id: 'P4',
    contato: true,
    exigeContato: true,
    re: new RegExp(`${ANTES}(?:protegid[oa]s?|ocult[oa]s?|preservad[oa]s?)${DEPOIS}`, 'giu'),
  },
  {
    id: 'P5',
    contato: false,
    negacao: true,
    re: new RegExp(`${ANTES}garant\\p{L}*`, 'giu'),
  },
];

interface Frase {
  texto: string;
  ini: number;
  sep: string; // separador (espaços/quebras) que vem depois da frase
}

// Divide em frases por ". ", "! ", "? " e quebras de linha. Pontos dentro de URLs
// (sem espaço depois) não separam frases.
function dividir(texto: string): Frase[] {
  const frases: Frase[] = [];
  const re = new RegExp('(?<=[.!?])\\s+|\\n+', 'g');
  let ini = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(texto)) !== null) {
    frases.push({ texto: texto.slice(ini, m.index), ini, sep: m[0] });
    ini = m.index + m[0].length;
  }
  frases.push({ texto: texto.slice(ini), ini, sep: '' });
  return frases;
}

function acharPadroes(texto: string): { id: string; idx: number }[] {
  const achados: { id: string; idx: number }[] = [];
  for (const p of PADROES) {
    const re = new RegExp(p.re.source, p.re.flags);
    let m: RegExpExecArray | null;
    while ((m = re.exec(texto)) !== null) {
      if (m[0].length === 0) {
        re.lastIndex++;
        continue;
      }
      const ini = m.index;
      const fim = ini + m[0].length;
      if (p.exigeContato) {
        const janela = texto.slice(Math.max(0, ini - JANELA_CONTATO), fim + JANELA_CONTATO);
        if (!CONTATO.test(janela)) continue;
      }
      if (p.negacao) {
        const antes = texto.slice(Math.max(0, ini - JANELA_NEGACAO - 20), ini);
        if (NEGACAO.test(antes)) continue;
        if (ECO.test(texto.slice(Math.max(0, ini - 25), ini))) continue;
      }
      achados.push({ id: p.id, idx: ini });
    }
  }
  return achados;
}

const TEM_URL = /https?:\/\//i;
const FRASE_FIXA = /a conversa acontece pelo chat da plataforma/gi;
const CONECTIVO_NO_INICIO = new RegExp(
  `^(?:assim|ent[ãa]o|portanto|por\\s+isso|dessa\\s+forma|desse\\s+modo|al[ée]m\\s+disso|ou\\s+seja|isso|mas|por[ée]m|e|tamb[ée]m|logo|nesse\\s+caso|com\\s+isso)${DEPOIS}`,
  'iu'
);
const CONECTIVO_NO_FIM = new RegExp(
  `(?:[,:;]|${ANTES}(?:e|ou|mas|por[ée]m|assim|ent[ãa]o|al[ée]m\\s+disso))\\s*[.!?]*\\s*$`,
  'iu'
);

function recuar(padroes: string[], nFrases: number): ResultadoFiltro {
  return { texto: T3, disparou: true, padroes, acao: 'resposta', nFrases };
}

export function aplicarFiltroDeLinguagem(raw: string): ResultadoFiltro {
  const achados = acharPadroes(raw);
  if (achados.length === 0) {
    return { texto: raw, disparou: false, padroes: [], acao: 'nenhuma', nFrases: 0 };
  }

  const padroes = Array.from(new Set(achados.map((a) => a.id))).sort();
  const frases = dividir(raw);

  // frase de cada ocorrência
  const marcadas = new Map<number, Set<string>>();
  for (const a of achados) {
    let i = 0;
    for (let k = 0; k < frases.length; k++) {
      if (frases[k].ini <= a.idx) i = k;
      else break;
    }
    if (!marcadas.has(i)) marcadas.set(i, new Set());
    marcadas.get(i)!.add(a.id);
  }
  const nFrases = marcadas.size;

  const naoVazias = frases.map((f, i) => ({ f, i })).filter((x) => x.f.texto.trim() !== '');
  const primeira = naoVazias.length > 0 ? naoVazias[0].i : 0;

  // Condições de recuo para a resposta inteira
  if (nFrases > 1) return recuar(padroes, nFrases);
  const [indice] = Array.from(marcadas.keys());
  if (TEM_URL.test(frases[indice].texto)) return recuar(padroes, nFrases);
  if (indice === primeira && naoVazias.length < 3) return recuar(padroes, nFrases);

  const ehContato = Array.from(marcadas.get(indice)!).some((id) => id !== 'P5');

  // Reconstrói o texto
  let saida = '';
  for (let k = 0; k < frases.length; k++) {
    if (k === indice) {
      if (ehContato) saida += T1 + frases[k].sep;
      // P5: a frase é removida (T2); o separador também, para não deixar linha vazia extra
      continue;
    }
    saida += frases[k].texto + frases[k].sep;
  }
  const texto = saida.trim();

  // frase fixa repetida (também quando o modelo já tinha dito o mesmo, com outras maiúsculas ou prefixo)
  const repeticoes = (texto.match(FRASE_FIXA) || []).length;
  if (repeticoes > 1) return recuar(padroes, nFrases);

  // sobras: além da frase trocada/removida, precisam restar pelo menos 2 frases da resposta original
  const outras = naoVazias.filter((x) => x.i !== indice);
  if (outras.length < 2) return recuar(padroes, nFrases);

  // conectivos soltos no início ou no fim do resultado, ou logo depois do ponto alterado
  if (CONECTIVO_NO_INICIO.test(texto) || CONECTIVO_NO_FIM.test(texto)) return recuar(padroes, nFrases);
  const vizinha = frases[indice + 1];
  if (vizinha && CONECTIVO_NO_INICIO.test(vizinha.texto.trim())) return recuar(padroes, nFrases);

  return { texto, disparou: true, padroes, acao: 'frase', nFrases };
}
