import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { ArrowLeft, Clock, Calendar, Tag } from 'lucide-react';

const POSTS: Record<string, {
  title: string; description: string; date: string; readTime: string;
  category: string; content: string;
}> = {
  'como-recuperar-objeto-perdido-sao-paulo': {
    title: 'Como recuperar um objeto perdido em São Paulo',
    description: 'Guia completo com os melhores passos para recuperar objetos perdidos na cidade de São Paulo, desde achados e perdidos até plataformas digitais.',
    date: '10 abr 2026', readTime: '5 min', category: 'Guias',
    content: `
São Paulo é a maior cidade do Brasil e, com mais de 12 milhões de habitantes, é também onde mais objetos se perdem diariamente. Celulares, carteiras, documentos, chaves e até pets — a lista é enorme.

## 1. Registre o objeto imediatamente

O primeiro passo é registrar o objeto perdido em uma plataforma como o **Backfindr**. Quanto mais rápido você cadastrar, maior a chance de alguém que achou já ter registrado o achado.

## 2. Acione o transporte público

O Metrô de SP possui um setor de achados e perdidos na estação Sé. A SPTrans também mantém um sistema para itens deixados em ônibus. Ligue para a central antes de ir pessoalmente.

## 3. Use o QR Code

Se você já tinha um QR Code do Backfindr no objeto, quem achou pode escanear e entrar em contato diretamente com você — de forma anônima e segura.

## 4. Redes sociais e grupos locais

Grupos de bairro no WhatsApp e Facebook costumam ser muito eficazes. Poste uma foto e a descrição do objeto.

## 5. Boletim de Ocorrência

Para documentos e objetos de valor, registre um BO no site da Delegacia Eletrônica (Delegacia Online SP). Isso ajuda tanto na recuperação quanto em caso de uso indevido.

---

Com o Backfindr, você centraliza tudo: cadastra o objeto, gera o QR Code, recebe notificações de matches e se comunica com quem achou — tudo em um só lugar.
    `.trim(),
  },
  'qr-code-para-pets-como-funciona': {
    title: 'QR Code para pets: como funciona e por que usar',
    description: 'Entenda como o QR Code do Backfindr pode salvar a vida do seu pet em caso de fuga ou perda.',
    date: '8 abr 2026', readTime: '4 min', category: 'Pets',
    content: `
Perder um pet é uma das experiências mais angustiantes para qualquer tutor. A boa notícia é que a tecnologia pode ajudar — e muito.

## Como funciona o QR Code para pets

O Backfindr gera um **QR Code único** para cada pet cadastrado. Você imprime, coloca na coleira ou em uma plaquinha, e pronto: qualquer pessoa que encontrar seu animal pode escanear com o celular e ver as informações de contato.

## O que aparece ao escanear?

- Nome e foto do pet
- Informações de saúde relevantes (alergias, medicamentos)
- Botão de contato direto com o tutor — sem expor seu número

## Por que é melhor que uma plaquinha comum?

Plaquinhas com número de telefone ficam ilegíveis com o tempo. O QR Code é permanente, pode ser atualizado digitalmente e funciona mesmo que você troque de número.

## Dicas extras

- Use coleiras com QR Code embutido (disponíveis em pet shops parceiros do Backfindr)
- Mantenha a foto do pet sempre atualizada na plataforma
- Ative as notificações push para ser avisado imediatamente quando o QR for escaneado

---

Cadastre seu pet agora no Backfindr e tenha paz de espírito.
    `.trim(),
  },
  'documentos-perdidos-o-que-fazer': {
    title: 'Perdeu documentos? Veja o que fazer passo a passo',
    description: 'RG, CPF, CNH, passaporte — saiba exatamente o que fazer quando perde documentos importantes.',
    date: '5 abr 2026', readTime: '6 min', category: 'Documentos',
    content: `
Perder documentos gera estresse e pode trazer problemas sérios se caírem em mãos erradas. Aqui está o roteiro completo.

## Passo 1: Registre um Boletim de Ocorrência

Faça isso imediatamente, de preferência online. O BO protege você em caso de uso indevido dos documentos.

## Passo 2: Bloqueie cartões e documentos financeiros

- Cartões de crédito/débito: ligue para o banco imediatamente
- CPF: consulte o site da Receita Federal para verificar uso indevido
- Título de eleitor: acesse o TSE online

## Passo 3: Registre no Backfindr

Cadastre os documentos perdidos na plataforma. Se alguém achar e registrar como "achado", o sistema de matching por IA vai cruzar as informações e te notificar.

## Passo 4: Segunda via

- **RG**: Posto do DETRAN ou Poupatempo
- **CPF**: Receita Federal ou Correios
- **CNH**: DETRAN (exige agendamento)
- **Passaporte**: Polícia Federal (prazo de 6 dias úteis)

## Passo 5: Monitore seu CPF

Use o serviço Registrato do Banco Central para verificar se alguém abriu contas ou fez empréstimos em seu nome.

---

Prevenção é o melhor remédio: use o Backfindr para cadastrar seus documentos com antecedência e gerar QR Codes para recuperação rápida.
    `.trim(),
  },
  'ia-para-encontrar-objetos-perdidos': {
    title: 'Como a IA do Backfindr encontra objetos perdidos',
    description: 'Entenda o algoritmo de matching por inteligência artificial que cruza objetos perdidos com achados em tempo real.',
    date: '2 abr 2026', readTime: '7 min', category: 'Tecnologia',
    content: `
O coração do Backfindr é seu motor de **matching por inteligência artificial**. Mas como ele funciona na prática?

## O problema clássico

Antes de plataformas como o Backfindr, quem perdia algo precisava torcer para que quem achou fosse até um achados e perdidos físico — o que raramente acontece. A taxa de recuperação era inferior a 5%.

## Como o matching funciona

Quando você cadastra um objeto perdido, o sistema extrai:

1. **Descrição textual** — processada por embeddings de linguagem natural
2. **Categoria e subcategoria** — classificação automática
3. **Localização** — coordenadas geográficas e raio de busca
4. **Data e hora** — janela temporal de perda

Esses dados são comparados em tempo real com todos os objetos cadastrados como "achados" na plataforma.

## Score de compatibilidade

Cada par (perdido × achado) recebe um **score de 0 a 100%**. Matches acima de 70% geram notificação automática para ambas as partes.

## Privacidade garantida

O chat entre quem perdeu e quem achou é **mediado pela plataforma** — nenhum dos dois precisa expor dados pessoais antes de confirmar o match.

## Resultados

Nos primeiros meses de operação, o Backfindr atingiu uma taxa de recuperação de **34%** — quase 7x a média tradicional.

---

Cadastre seus objetos agora e deixe a IA trabalhar por você.
    `.trim(),
  },
  'objetos-perdidos-no-metro-sp': {
    title: 'Objetos perdidos no Metrô de SP: como recuperar',
    description: 'Guia completo sobre o setor de achados e perdidos do Metrô de São Paulo e como aumentar suas chances de recuperação.',
    date: '28 mar 2026', readTime: '4 min', category: 'Guias',
    content: `
O Metrô de São Paulo transporta mais de 4 milhões de pessoas por dia. Com tanto movimento, objetos esquecidos são inevitáveis.

## Achados e Perdidos do Metrô SP

O setor fica na **Estação Sé** (linha 1-Azul), no mezanino. Funciona de segunda a sábado, das 7h às 19h.

Telefone: (11) 3291-2800

## O que fazer imediatamente

1. Volte à estação onde você acha que perdeu o objeto
2. Fale com um agente de estação — muitos objetos são entregues no mesmo dia
3. Se não encontrar, registre no Backfindr com a descrição e localização aproximada

## Prazo de guarda

O Metrô guarda os objetos por **30 dias**. Após esse prazo, itens de valor são doados ou leiloados.

## Dicas para aumentar suas chances

- Registre no Backfindr logo após perceber a perda — quem achou pode ter cadastrado como "achado"
- Descreva detalhes únicos do objeto (arranhados, adesivos, cor da capa)
- Se for um celular, use o "Encontrar Meu Dispositivo" do Google ou Apple simultaneamente

---

Combine as ferramentas: achados e perdidos oficial + Backfindr = máxima chance de recuperação.
    `.trim(),
  },
  'como-proteger-bagagem-viagem': {
    title: 'Como proteger sua bagagem em viagens com QR Code',
    description: 'Dicas práticas para proteger malas e bagagens em viagens nacionais e internacionais usando tecnologia.',
    date: '25 mar 2026', readTime: '5 min', category: 'Viagens',
    content: `
Bagagens extraviadas são um dos problemas mais comuns em viagens aéreas. Só no Brasil, mais de 300 mil malas são extraviadas por ano.

## O QR Code na bagagem

Colocar um QR Code do Backfindr na sua mala é a forma mais moderna e eficaz de identificação. Diferente de etiquetas comuns, o QR Code:

- Não desbota nem rasga facilmente
- Pode ser atualizado digitalmente (troca de telefone? Sem problema)
- Permite contato anônimo — quem achou não vê seu número diretamente

## Onde colocar

- **Dentro da mala**: em caso de perda da etiqueta externa, o conteúdo ainda pode ser identificado
- **Na alça**: posição mais visível para quem encontrar
- **No cadeado**: etiqueta pequena e resistente

## Outras dicas essenciais

1. **Tire fotos da mala** antes de despachar — modelo, cor, detalhes únicos
2. **Use malas com cores ou marcações únicas** — evite preto liso, o mais comum
3. **Rastreador GPS**: para viagens longas, um AirTag ou similar dentro da mala é ouro
4. **Seguro viagem**: cobre extravio de bagagem na maioria dos planos

## Se a mala for extraviada

1. Registre imediatamente no balcão da companhia aérea (PIR — Property Irregularity Report)
2. Cadastre no Backfindr com foto e descrição
3. Acompanhe pelo app da companhia aérea

---

Viaje com tranquilidade. Cadastre sua bagagem no Backfindr antes da próxima viagem.
    `.trim(),
  },
};

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const post = POSTS[params.slug];
  if (!post) return { title: 'Post não encontrado' };
  return {
    title: post.title,
    description: post.description,
    openGraph: { title: post.title, description: post.description, type: 'article' },
  };
}

export default function BlogPost({ params }: { params: { slug: string } }) {
  const post = POSTS[params.slug];
  if (!post) notFound();

  const paragraphs = post.content.split('\n\n');

  return (
    <div className="min-h-screen bg-[#060809] text-white">
      {/* Header */}
      <header className="border-b border-white/[0.06] bg-[#060809]/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/blog" className="flex items-center gap-2 text-white/40 hover:text-white transition-colors text-sm">
            <ArrowLeft className="w-4 h-4" />
            Blog
          </Link>
          <Link href="/" className="text-teal-400 font-semibold text-sm">Backfindr</Link>
        </div>
      </header>

      {/* Article */}
      <article className="max-w-3xl mx-auto px-6 py-12">
        {/* Meta */}
        <div className="flex flex-wrap items-center gap-3 mb-6">
          <span className="flex items-center gap-1.5 text-teal-400 text-xs font-medium bg-teal-500/10 border border-teal-500/20 px-2.5 py-1 rounded-full">
            <Tag className="w-3 h-3" />
            {post.category}
          </span>
          <span className="flex items-center gap-1.5 text-white/30 text-xs">
            <Calendar className="w-3 h-3" />
            {post.date}
          </span>
          <span className="flex items-center gap-1.5 text-white/30 text-xs">
            <Clock className="w-3 h-3" />
            {post.readTime} de leitura
          </span>
        </div>

        {/* Title */}
        <h1 className="text-3xl md:text-4xl font-bold text-white leading-tight mb-4">{post.title}</h1>
        <p className="text-white/50 text-lg leading-relaxed mb-10 border-b border-white/[0.06] pb-10">{post.description}</p>

        {/* Content */}
        <div className="prose prose-invert prose-sm max-w-none space-y-4">
          {paragraphs.map((block, i) => {
            if (block.startsWith('## ')) {
              return <h2 key={i} className="text-xl font-bold text-white mt-8 mb-3">{block.replace('## ', '')}</h2>;
            }
            if (block.startsWith('- ')) {
              const items = block.split('\n').filter(l => l.startsWith('- '));
              return (
                <ul key={i} className="space-y-2 pl-4">
                  {items.map((item, j) => (
                    <li key={j} className="text-white/60 text-sm leading-relaxed flex gap-2">
                      <span className="text-teal-400 mt-1">•</span>
                      <span dangerouslySetInnerHTML={{ __html: item.replace('- ', '').replace(/\*\*(.*?)\*\*/g, '<strong class="text-white">$1</strong>') }} />
                    </li>
                  ))}
                </ul>
              );
            }
            if (block.startsWith('1. ') || block.match(/^\d+\./)) {
              const items = block.split('\n').filter(l => l.match(/^\d+\./));
              return (
                <ol key={i} className="space-y-2 pl-4">
                  {items.map((item, j) => (
                    <li key={j} className="text-white/60 text-sm leading-relaxed flex gap-2">
                      <span className="text-teal-400 font-bold flex-shrink-0">{j + 1}.</span>
                      <span dangerouslySetInnerHTML={{ __html: item.replace(/^\d+\.\s*/, '').replace(/\*\*(.*?)\*\*/g, '<strong class="text-white">$1</strong>') }} />
                    </li>
                  ))}
                </ol>
              );
            }
            if (block.startsWith('---')) {
              return <hr key={i} className="border-white/[0.08] my-8" />;
            }
            return (
              <p key={i} className="text-white/60 text-sm leading-relaxed"
                dangerouslySetInnerHTML={{ __html: block.replace(/\*\*(.*?)\*\*/g, '<strong class="text-white">$1</strong>') }} />
            );
          })}
        </div>

        {/* CTA */}
        <div className="mt-12 p-6 bg-teal-500/[0.06] border border-teal-500/20 rounded-2xl text-center">
          <p className="text-white font-semibold mb-1">Pronto para proteger seus objetos?</p>
          <p className="text-white/40 text-sm mb-4">Cadastre-se gratuitamente e comece a usar o Backfindr agora.</p>
          <Link href="/auth/register"
            className="inline-flex items-center gap-2 bg-teal-500 hover:bg-teal-400 text-white font-semibold text-sm px-6 py-2.5 rounded-xl transition-colors">
            Criar conta grátis
          </Link>
        </div>

        {/* Back */}
        <div className="mt-8 text-center">
          <Link href="/blog" className="text-white/30 hover:text-white text-sm transition-colors">
            ← Ver todos os artigos
          </Link>
        </div>
      </article>
    </div>
  );
}
