import Link from 'next/link';

// Página pública de um link de custódia ou de entrega cujo prazo de validade passou.
// Mostra só o estado: nenhum nome, telefone, endereço, descrição ou data. Sem estado e sem ganchos.
export default function LinkConcluido() {
  return (
    <div className="min-h-screen bg-[#080b0f] flex flex-col items-center justify-center p-6 text-center gap-6">
      <div className="w-16 h-16 rounded-2xl bg-teal-500/10 flex items-center justify-center text-teal-400 text-3xl" aria-hidden="true">
        ✓
      </div>
      <div>
        <h1 className="text-white text-xl font-bold mb-2">Concluída</h1>
        <p className="text-white/40 text-sm leading-relaxed">Este link não está mais disponível.</p>
      </div>
      <Link href="/" className="text-teal-400 hover:text-teal-300 text-sm transition-colors">
        Ir para o Backfindr
      </Link>
    </div>
  );
}
