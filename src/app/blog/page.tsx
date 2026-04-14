import type { Metadata } from 'next';
import Link from 'next/link';
import { MapPin, ArrowRight, Clock } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Blog — Dicas para proteger seus objetos e pets',
  description: 'Dicas práticas sobre como recuperar objetos perdidos, proteger pets com QR Code e usar tecnologia para não perder o que importa.',
  openGraph: {
    title: 'Blog Backfindr — Dicas para proteger seus objetos',
    description: 'Aprenda como recuperar objetos perdidos com QR Code e IA.',
    url: 'https://backfindr.com/blog',
  },
};

const POSTS = [
  {
    slug: 'como-recuperar-objeto-perdido-sao-paulo',
    title: 'Como recuperar um objeto perdido em São Paulo em 2026',
    excerpt: 'São Paulo registra mais de 2.000 ocorrências de objetos perdidos por dia. Veja o passo a passo mais eficiente para recuperar o que você perdeu.',
    category: 'Guia prático',
    readTime: '5 min',
    date: '14 abr 2026',
    featured: true,
    emoji: '📱',
  },
  {
    slug: 'qr-code-para-pets-como-funciona',
    title: 'QR Code para pets: como funciona e por que vale a pena',
    excerpt: 'Mais de 30% dos cães fogem ao menos uma vez na vida. Descubra como um QR Code na coleira pode ser a diferença entre reencontrar ou não seu pet.',
    category: 'Pets',
    readTime: '4 min',
    date: '12 abr 2026',
    featured: false,
    emoji: '🐕',
  },
  {
    slug: 'documentos-perdidos-o-que-fazer',
    title: 'Perdi meus documentos. E agora? O guia completo',
    excerpt: 'RG, CPF, CNH — perder documentos gera dor de cabeça, mas há um caminho certo a seguir. Confira o checklist completo com prazos e órgãos responsáveis.',
    category: 'Documentos',
    readTime: '7 min',
    date: '10 abr 2026',
    featured: false,
    emoji: '📄',
  },
  {
    slug: 'ia-para-encontrar-objetos-perdidos',
    title: 'Como a IA encontra seu objeto perdido antes que você perceba',
    excerpt: 'O Backfindr usa inteligência artificial para cruzar automaticamente objetos perdidos com achados. Entenda como o algoritmo funciona.',
    category: 'Tecnologia',
    readTime: '6 min',
    date: '08 abr 2026',
    featured: false,
    emoji: '🤖',
  },
  {
    slug: 'objetos-perdidos-no-metro-sp',
    title: 'Metrô de SP: o que acontece com objetos esquecidos nos vagões',
    excerpt: 'O Metrô de São Paulo recolhe centenas de objetos por dia. Saiba onde ir, quais são os prazos e como aumentar suas chances de recuperar o que esqueceu.',
    category: 'Guia prático',
    readTime: '4 min',
    date: '05 abr 2026',
    featured: false,
    emoji: '🚇',
  },
  {
    slug: 'como-proteger-bagagem-viagem',
    title: 'Viagem sem susto: como proteger sua bagagem com QR Code',
    excerpt: 'Malas extraviadas em aeroportos causam prejuízo a milhões de viajantes por ano. Veja como o QR Code pode acelerar a recuperação da sua bagagem.',
    category: 'Viagem',
    readTime: '3 min',
    date: '02 abr 2026',
    featured: false,
    emoji: '✈️',
  },
];

export default function BlogPage() {
  const featured = POSTS.find(p => p.featured);
  const others   = POSTS.filter(p => !p.featured);

  return (
    <div className="min-h-screen bg-[#080b0f] text-white">
      {/* Nav */}
      <header className="border-b border-white/[0.06] sticky top-0 z-50 bg-[#080b0f]/90 backdrop-blur-xl">
        <nav className="max-w-4xl mx-auto px-5 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-teal-500 flex items-center justify-center">
              <MapPin className="w-3 h-3 text-white" strokeWidth={2.5} />
            </div>
            <span className="text-white font-semibold text-sm">Backfindr</span>
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/" className="text-white/40 hover:text-white text-sm transition-colors">Plataforma</Link>
            <Link href="/auth/register"
              className="text-sm font-medium bg-teal-500 hover:bg-teal-400 text-white px-4 py-1.5 rounded-lg transition-all">
              Começar grátis
            </Link>
          </div>
        </nav>
      </header>

      <main className="max-w-4xl mx-auto px-5 py-16">
        {/* Header */}
        <div className="mb-14">
          <p className="text-[11px] text-teal-500 uppercase tracking-[0.15em] font-semibold mb-3">Blog</p>
          <h1 className="text-4xl font-bold tracking-tight text-white mb-4">
            Proteja o que importa.<br />Recupere o que perdeu.
          </h1>
          <p className="text-white/40 text-lg max-w-xl">
            Guias práticos, dicas de tecnologia e histórias de recuperação. Tudo sobre objetos perdidos e como a IA está mudando esse cenário.
          </p>
        </div>

        {/* Featured */}
        {featured && (
          <Link href={`/blog/${featured.slug}`}
            className="block mb-12 group bg-white/[0.02] hover:bg-white/[0.04] border border-white/[0.07] hover:border-white/[0.14] rounded-3xl p-8 transition-all duration-300">
            <div className="flex items-start gap-6">
              <div className="text-5xl flex-shrink-0">{featured.emoji}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-[10px] text-teal-400 bg-teal-500/10 border border-teal-500/20 px-2.5 py-1 rounded-full font-semibold uppercase tracking-wider">
                    {featured.category}
                  </span>
                  <span className="text-white/20 text-xs">Destaque</span>
                </div>
                <h2 className="text-2xl font-bold text-white group-hover:text-teal-300 transition-colors mb-3 leading-tight">
                  {featured.title}
                </h2>
                <p className="text-white/50 leading-relaxed mb-4">{featured.excerpt}</p>
                <div className="flex items-center gap-4 text-white/30 text-xs">
                  <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{featured.readTime} de leitura</span>
                  <span>{featured.date}</span>
                  <span className="ml-auto flex items-center gap-1 text-teal-400 group-hover:gap-2 transition-all">
                    Ler artigo <ArrowRight className="w-3.5 h-3.5" />
                  </span>
                </div>
              </div>
            </div>
          </Link>
        )}

        {/* Grid */}
        <div className="grid sm:grid-cols-2 gap-5">
          {others.map(post => (
            <Link key={post.slug} href={`/blog/${post.slug}`}
              className="group bg-white/[0.02] hover:bg-white/[0.04] border border-white/[0.07] hover:border-white/[0.14] rounded-2xl p-6 transition-all duration-300">
              <div className="text-3xl mb-4">{post.emoji}</div>
              <span className="text-[10px] text-teal-400/70 bg-teal-500/[0.08] border border-teal-500/15 px-2 py-0.5 rounded-full font-semibold uppercase tracking-wider">
                {post.category}
              </span>
              <h2 className="text-base font-bold text-white group-hover:text-teal-300 transition-colors mt-3 mb-2 leading-tight">
                {post.title}
              </h2>
              <p className="text-white/40 text-sm leading-relaxed mb-4 line-clamp-2">{post.excerpt}</p>
              <div className="flex items-center justify-between text-white/20 text-xs">
                <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{post.readTime}</span>
                <span>{post.date}</span>
              </div>
            </Link>
          ))}
        </div>

        {/* CTA */}
        <div className="mt-16 text-center p-10 rounded-3xl border border-white/[0.07] bg-white/[0.02]">
          <p className="text-white font-bold text-xl mb-2">Proteja seus objetos agora</p>
          <p className="text-white/40 text-sm mb-6">Crie QR Codes gratuitos para tudo que importa. Leva 2 minutos.</p>
          <Link href="/auth/register"
            className="inline-flex items-center gap-2 bg-teal-500 hover:bg-teal-400 text-white font-semibold px-6 py-3 rounded-xl transition-all text-sm"
            style={{ boxShadow: '0 0 0 1px rgba(20,184,166,0.4),0 4px 20px rgba(20,184,166,0.15)' }}>
            Criar minha conta grátis <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </main>

      <footer className="border-t border-white/[0.06] py-8 px-5 mt-10">
        <div className="max-w-4xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-md bg-teal-500 flex items-center justify-center">
              <MapPin className="w-2.5 h-2.5 text-white" strokeWidth={2.5} />
            </div>
            <span className="text-white text-sm font-semibold">Backfindr</span>
          </div>
          <p className="text-white/20 text-xs">© 2026 Backfindr · São Paulo, Brasil</p>
          <div className="flex gap-6 text-xs text-white/30">
            <Link href="/privacy" className="hover:text-white transition-colors">Privacidade</Link>
            <Link href="/terms" className="hover:text-white transition-colors">Termos</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
