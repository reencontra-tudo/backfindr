// Linha «Divulgado por <colaborador>» do cartaz (JSX para o next/og/Satori: estilos em linha, cada <div> com display explícito, texto em UM só nó).
// Só entra no cartaz quando existe marca; sem marca, nada é renderizado e o cartaz sai como sempre.
import type { MarcaCartaz } from '@/lib/colaboradores/marca';

export function MarcaDoCartaz({ marca, fonte, cor, logo, margemTopo, justificar }: {
  marca: MarcaCartaz; fonte: number; cor: string; logo: number; margemTopo: number; justificar?: 'flex-start' | 'flex-end';
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: `${Math.round(fonte * 0.4)}px`, marginTop: `${margemTopo}px`, ...(justificar ? { justifyContent: justificar } : {}) }}>
      {marca.logo && <img src={marca.logo} style={{ width: `${logo}px`, height: `${logo}px`, borderRadius: `${logo / 2}px`, objectFit: 'cover' }} />}
      <span style={{ display: 'flex', color: cor, fontSize: `${fonte}px`, fontWeight: 700 }}>{`Divulgado por ${marca.nome}`}</span>
    </div>
  );
}
