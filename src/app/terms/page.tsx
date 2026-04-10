import Link from 'next/link';
import { MapPin } from 'lucide-react';

export default function TermsPage() {
  const sections = [
    {
      title: '1. Aceitação dos Termos',
      content: 'Ao acessar e usar o Backfindr, você concorda com estes Termos de Uso. Se não concordar, não utilize a plataforma. Reservamo-nos o direito de atualizar estes termos a qualquer momento, com notificação prévia por e-mail.',
    },
    {
      title: '2. Descrição do Serviço',
      content: 'O Backfindr é uma plataforma de recuperação de objetos perdidos que permite o registro de objetos, geração de QR Codes únicos, matching por inteligência artificial e comunicação mediada entre usuários para facilitar a devolução de objetos perdidos.',
    },
    {
      title: '3. Uso Aceitável',
      content: 'Você concorda em usar o Backfindr apenas para fins legítimos de registro e recuperação de objetos. É proibido registrar objetos que não sejam de sua propriedade sem autorização, usar a plataforma para fraudes, spam ou qualquer atividade ilegal.',
    },
    {
      title: '4. Privacidade e Dados',
      content: 'Coletamos apenas os dados necessários para o funcionamento da plataforma: nome, e-mail, descrição dos objetos e localização aproximada. Seus dados de contato nunca são expostos publicamente. A comunicação entre usuários é mediada pelo Backfindr para proteger sua privacidade.',
    },
    {
      title: '5. QR Codes e Objetos',
      content: 'Cada QR Code gerado é único e permanente, vinculado ao objeto registrado. Você é responsável pelas informações fornecidas sobre seus objetos. O Backfindr não se responsabiliza pela recuperação garantida de objetos perdidos.',
    },
    {
      title: '6. Plano Gratuito e Pro',
      content: 'O plano gratuito permite o registro de objetos com funcionalidades básicas. O plano Pro oferece recursos adicionais mediante assinatura mensal. Os preços podem ser alterados com aviso prévio de 30 dias.',
    },
    {
      title: '7. Limitação de Responsabilidade',
      content: 'O Backfindr é uma plataforma de intermediação. Não somos responsáveis pela recuperação efetiva dos objetos, pela conduta dos usuários ou por danos decorrentes do uso da plataforma. Nossa responsabilidade é limitada ao valor pago pelo serviço nos últimos 12 meses.',
    },
    {
      title: '8. Contato',
      content: 'Para dúvidas sobre estes termos, entre em contato pelo e-mail: legal@backfindr.com',
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
          <h1 className="text-3xl font-bold text-white tracking-tight mb-2">Termos de Uso</h1>
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
          <Link href="/privacy" className="text-teal-400 hover:text-teal-300 text-sm transition-colors">
            Política de Privacidade →
          </Link>
          <Link href="/" className="text-white/30 hover:text-white text-sm transition-colors">
            Voltar ao início
          </Link>
        </div>
      </div>
    </div>
  );
}
