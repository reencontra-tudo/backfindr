// Mascara, no Microsoft Clarity, todo o conteúdo dos filhos (texto, imagens, valores).
// O Clarity calcula a máscara quando o nó é criado, e os filhos herdam do pai; por isso o atributo
// vai num layout de segmento (src/app/<segmento>/layout.tsx), que monta junto com a página.
// `contents` não gera caixa: o layout visual não muda. Não afeta nada fora do Clarity.
export default function ClarityMask({ children }: { children: React.ReactNode }) {
  return (
    <div data-clarity-mask="True" className="contents">
      {children}
    </div>
  );
}
