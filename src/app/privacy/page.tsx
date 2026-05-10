import type { Metadata } from 'next';
import Link from 'next/link';
import { MapPin } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Política de Privacidade',
  description: 'Saiba como o Backfindr coleta, usa e protege seus dados pessoais. Transparência total sobre privacidade e segurança da informação.',
  alternates: { canonical: 'https://www.backfindr.com/privacy' },
  openGraph: {
    title: 'Política de Privacidade | Backfindr',
    description: 'Como coletamos, usamos e protegemos seus dados.',
    url: 'https://www.backfindr.com/privacy',
    type: 'website',
  },
  robots: { index: true, follow: false },
};

export default function PrivacyPage() {
  const sections = [
    {
      title: '1. Dados que Coletamos',
      content: 'Coletamos apenas os dados necessários: nome completo, endereço de e-mail, telefone (opcional), descrição e fotos dos objetos registrados, localização aproximada do objeto (com sua permissão), e dados de uso anônimos para melhoria do serviço.',
    },
    {
      title: '2. Como Usamos seus Dados',
      content: 'Seus dados são usados exclusivamente para: autenticar sua conta, operar o sistema de QR Codes e matching, enviar notificações sobre seus objetos, e mediar comunicações com outros usuários. Nunca vendemos seus dados a terceiros.',
    },
    {
      title: '3. Privacidade nas Comunicações',
      content: 'Toda comunicação entre usuários é mediada pelo Backfindr. Quando alguém escaneia o QR Code do seu objeto, seu e-mail, telefone ou localização real não são expostos. A comunicação ocorre através do nosso sistema de chat seguro.',
    },
    {
      title: '4. Armazenamento e Segurança',
      content: 'Seus dados são armazenados em servidores seguros com criptografia. Utilizamos HTTPS em todas as comunicações. Senhas são armazenadas com hash bcrypt. Tokens de autenticação expiram automaticamente.',
    },
    {
      title: '5. Compartilhamento de Dados',
      content: 'Não compartilhamos seus dados pessoais com terceiros, exceto: quando exigido por lei ou ordem judicial, com provedores de serviço essenciais (hospedagem, e-mail) sob acordo de confidencialidade, e mediante seu consentimento explícito.',
    },
    {
      title: '6. Seus Direitos (LGPD)',
      content: 'De acordo com a Lei Geral de Proteção de Dados (LGPD), você tem direito a: acessar seus dados, corrigir informações incorretas, exportar seus dados, e solicitar a exclusão da sua conta e dados. Exerça seus direitos pelo e-mail: privacidade@backfindr.com',
    },
    {
      title: '7. Cookies',
      content: 'Utilizamos apenas cookies essenciais para autenticação e preferências de sessão. Não utilizamos cookies de rastreamento ou publicidade.',
    },
    {
      title: '8. Contato DPO',
      content: 'Encarregado de Proteção de Dados: privacidade@backfindr.com. Responderemos em até 15 dias úteis.',
    },
  ];

  return (
    <div className="min-h-screen bg-[#080b0f] text-white">
      <nav className="border-b border-white/[0.06] px-5 h-14 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-teal-500 flex items-center justify-center">
            <MapPin className="w-3.5 h-3.5 text-white" strokeWidth={2.5} />
          </div>
          <span className="text-white font-semibold text-[15px]">Backfindr</span>
        </Link>
      </nav>

      <div className="max-w-2xl mx-auto px-5 py-12">
        <div className="mb-10">
          <p className="text-teal-500 text-xs uppercase tracking-widest mb-3">Legal</p>
          <h1 className="text-3xl font-bold text-white tracking-tight mb-2">Política de Privacidade</h1>
          <p className="text-white/30 text-sm">Última atualização: Abril de 2026</p>
        </div>

        <div className="space-y-8">
          {sections.map(s => (
            <div key={s.title}>
              <h2 className="text-white font-semibold mb-2">{s.title}</h2>
              <p className="text-white/40 text-sm leading-relaxed">{s.content}</p>
            </div>
          ))}
        </div>

        <div className="mt-12 pt-8 border-t border-white/[0.06] flex items-center justify-between">
          <Link href="/terms" className="text-teal-400 hover:text-teal-300 text-sm transition-colors">
            Termos de Uso →
          </Link>
          <Link href="/" className="text-white/30 hover:text-white text-sm transition-colors">
            Voltar ao início
          </Link>
        </div>
      </div>
    </div>
  );
}
