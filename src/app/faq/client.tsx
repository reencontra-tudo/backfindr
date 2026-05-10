'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ChevronDown, MapPin, ArrowRight } from 'lucide-react';
import type { Metadata } from 'next';

// ─── FAQ Data ─────────────────────────────────────────────────────────────────
const SECTIONS = [
  {
    title: 'Como funciona',
    items: [
      {
        q: 'O que é o Backfindr?',
        a: 'O Backfindr é uma plataforma de recuperação de objetos perdidos. Você registra seus itens, recebe um QR Code único para cada um, e quando alguém encontrar e escanear o código, você é notificado imediatamente — sem expor seus dados pessoais.',
      },
      {
        q: 'Como o QR Code funciona na prática?',
        a: 'Você imprime ou salva o QR Code e cola no objeto (coleira do pet, carteira, mochila, etc.). Qualquer pessoa com um celular pode escanear o código sem precisar ter conta no Backfindr. Ao escanear, ela vê uma página pública com informações básicas do objeto e pode iniciar o contato de forma segura.',
      },
      {
        q: 'Preciso instalar algum aplicativo?',
        a: 'Não. O Backfindr funciona completamente pelo navegador, tanto para quem registra objetos quanto para quem escaneia o QR Code. Para receber notificações push, recomendamos adicionar o site à tela inicial do celular (funciona como um app).',
      },
      {
        q: 'O QR Code expira?',
        a: 'Não. O QR Code é permanente em todos os planos. Se alguém encontrar seu item e escanear meses ou anos depois, você ainda recebe o aviso.',
      },
      {
        q: 'O que é o matching por IA?',
        a: 'Quando você registra um objeto perdido, nossa IA compara automaticamente com todos os objetos encontrados na plataforma — considerando categoria, descrição, localização e data. Quando há uma correspondência forte, os dois usuários são notificados para iniciar o processo de devolução.',
      },
    ],
  },
  {
    title: 'Privacidade e segurança',
    items: [
      {
        q: 'Quem encontrar meu objeto vai ver meu telefone ou e-mail?',
        a: 'Não. A página pública do objeto mostra apenas o nome do item, uma descrição e uma foto. O contato é feito por um chat mediado dentro da plataforma — seus dados pessoais nunca são expostos.',
      },
      {
        q: 'Posso confiar em quem escaneia o QR?',
        a: 'O chat mediado protege sua identidade. Você decide se quer compartilhar mais informações após conversar com a pessoa. A plataforma registra todas as interações para segurança de ambos os lados.',
      },
      {
        q: 'Meus dados são vendidos para terceiros?',
        a: 'Não. Seus dados são usados exclusivamente para o funcionamento da plataforma. Consulte nossa Política de Privacidade para detalhes completos.',
      },
    ],
  },
  {
    title: 'Pets',
    items: [
      {
        q: 'O Backfindr funciona para pets?',
        a: 'Sim. Pets são uma das categorias mais importantes da plataforma. Você registra o animal com foto, raça, cor e microchip, gera um QR Code para a coleira, e se o pet sumir, qualquer pessoa que o encontrar pode escanear e iniciar o contato imediatamente.',
      },
      {
        q: 'E se meu pet não tiver coleira no momento que sumir?',
        a: 'Você ainda pode registrar o pet como "perdido" e nossa IA fará matching com registros de animais encontrados na sua região. Adicione fotos claras e uma descrição detalhada para aumentar as chances.',
      },
      {
        q: 'Posso registrar mais de um pet?',
        a: 'Sim. No plano gratuito você pode registrar até 3 objetos (incluindo pets). Para famílias com múltiplos animais, o plano Pro permite até 20 registros.',
      },
    ],
  },
  {
    title: 'Planos e pagamento',
    items: [
      {
        q: 'O plano gratuito tem limite?',
        a: 'Sim. O plano gratuito permite até 3 objetos registrados simultaneamente. O QR Code é permanente e o matching por IA está incluído. Para mais objetos ou funcionalidades avançadas, veja os planos pagos.',
      },
      {
        q: 'Posso cancelar a qualquer momento?',
        a: 'Sim. Sem multa, sem burocracia. Ao cancelar, você continua com acesso ao plano pago até o fim do período já pago.',
      },
      {
        q: 'Quais formas de pagamento são aceitas?',
        a: 'Aceitamos Pix e cartão de crédito/débito via Mercado Pago para usuários brasileiros.',
      },
      {
        q: 'O que acontece com meus objetos se eu cancelar o plano pago?',
        a: 'Seus objetos são mantidos. Se você tiver mais objetos do que o limite do plano gratuito permite, os mais antigos ficam inativos até que você faça upgrade novamente ou remova alguns.',
      },
      {
        q: 'O plano Business aceita CNPJ?',
        a: 'Sim. O plano Business aceita tanto CPF quanto CNPJ e inclui nota fiscal mediante solicitação.',
      },
    ],
  },
  {
    title: 'Problemas técnicos',
    items: [
      {
        q: 'Não recebi o e-mail de confirmação. O que fazer?',
        a: 'Verifique a pasta de spam. Se não encontrar, tente reenviar pela tela de login. Se o problema persistir, entre em contato pelo e-mail suporte@backfindr.com.',
      },
      {
        q: 'O QR Code não está sendo reconhecido.',
        a: 'Certifique-se de que o QR Code está impresso ou exibido com boa resolução e sem distorções. Tente escanear com a câmera nativa do celular (iOS ou Android) antes de usar um app de terceiros.',
      },
      {
        q: 'Não estou recebendo notificações.',
        a: 'Para receber notificações push, você precisa ter o site adicionado à tela inicial do celular (como PWA) e ter concedido permissão de notificações. No iOS: Safari > Compartilhar > Adicionar à Tela de Início. No Android: Chrome > Menu > Adicionar à tela inicial.',
      },
      {
        q: 'Como excluo minha conta?',
        a: 'Acesse Configurações > Conta > Excluir conta. Todos os seus dados e objetos serão removidos permanentemente em até 30 dias.',
      },
    ],
  },
];

// ─── Accordion Item ───────────────────────────────────────────────────────────
function AccordionItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-white/[0.08] rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left hover:bg-white/[0.03] transition-colors"
      >
        <span className="text-sm font-medium text-white">{q}</span>
        <ChevronDown
          className={`w-4 h-4 flex-shrink-0 text-white/40 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && (
        <div className="px-5 pb-4">
          <p className="text-sm text-white/50 leading-relaxed">{a}</p>
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function FaqPage() {
  return (
    <div className="min-h-screen bg-[#07090e] text-white">
      {/* Nav */}
      <nav className="border-b border-white/[0.06] px-5 py-4">
        <div className="mx-auto max-w-5xl flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-teal-500 flex items-center justify-center">
              <MapPin className="w-3.5 h-3.5 text-white" strokeWidth={2.5} />
            </div>
            <span className="text-white font-semibold text-[15px]">Backfindr</span>
          </Link>
          <Link
            href="/auth/register"
            className="inline-flex items-center gap-1.5 rounded-xl bg-teal-500 px-4 py-2 text-xs font-bold text-white hover:bg-teal-400 transition-colors"
          >
            Criar conta grátis
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <div className="px-5 py-16 text-center">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.22em] text-white/28">central de ajuda</p>
        <h1 className="text-3xl font-extrabold text-white md:text-4xl mb-4">Perguntas frequentes</h1>
        <p className="text-sm text-white/45 max-w-xl mx-auto">
          Encontre respostas rápidas para as dúvidas mais comuns. Se não encontrar o que procura, entre em contato pelo e-mail{' '}
          <a href="mailto:suporte@backfindr.com" className="text-teal-400 hover:text-teal-300 transition-colors">
            suporte@backfindr.com
          </a>
          .
        </p>
      </div>

      {/* Sections */}
      <div className="px-5 pb-24">
        <div className="mx-auto max-w-3xl space-y-12">
          {SECTIONS.map((section) => (
            <div key={section.title}>
              <h2 className="text-base font-bold text-teal-400 mb-4 uppercase tracking-wide text-xs">
                {section.title}
              </h2>
              <div className="space-y-2">
                {section.items.map((item) => (
                  <AccordionItem key={item.q} q={item.q} a={item.a} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* CTA */}
      <div className="border-t border-white/[0.06] px-5 py-16 text-center">
        <h2 className="text-xl font-bold text-white mb-2">Ainda tem dúvidas?</h2>
        <p className="text-sm text-white/40 mb-6">Nossa equipe responde em até 24 horas.</p>
        <a
          href="mailto:suporte@backfindr.com"
          className="inline-flex items-center gap-2 rounded-2xl border border-white/[0.12] bg-white/[0.03] px-6 py-3 text-sm font-semibold text-white/85 hover:border-white/[0.2] hover:bg-white/[0.06] transition-colors"
        >
          Enviar e-mail para o suporte
          <ArrowRight className="w-4 h-4" />
        </a>
      </div>

      {/* Footer */}
      <footer className="border-t border-white/[0.06] px-5 py-8">
        <div className="mx-auto max-w-5xl flex flex-wrap items-center justify-center gap-5 text-xs text-white/30">
          <Link href="/" className="hover:text-white/60 transition-colors">Home</Link>
          <Link href="/pricing" className="hover:text-white/60 transition-colors">Planos</Link>
          <Link href="/map" className="hover:text-white/60 transition-colors">Mapa</Link>
          <Link href="/privacy" className="hover:text-white/60 transition-colors">Privacidade</Link>
          <Link href="/terms" className="hover:text-white/60 transition-colors">Termos</Link>
        </div>
      </footer>
    </div>
  );
}
