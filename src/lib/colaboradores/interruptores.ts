// Programa de Colaboradores: os DOIS interruptores devem estar sempre juntos.
//   COLABORADORES_ATIVO              (servidor, lido na hora do pedido): middleware, rotas, cadastro, página, sitemap
//   NEXT_PUBLIC_COLABORADORES_ATIVO  (navegador, fixado na hora do build): campo do formulário e captura do ?colab=
// Só um ligado não quebra nada (o servidor ignora ou recusa; o navegador não mostra o campo), mas o programa fica pela metade. O admin mostra um aviso.
import { colaboradoresAtivo } from './rota';
import { colaboradoresAtivoNoCliente } from './cliente';

export interface EstadoInterruptores {
  servidor: boolean;
  navegador: boolean;
  /** true = um ligado e o outro desligado. */
  divergente: boolean;
}

export function estadoInterruptores(servidor: boolean, navegador: boolean): EstadoInterruptores {
  return { servidor, navegador, divergente: servidor !== navegador };
}

export function lerInterruptores(
  servidor: boolean = colaboradoresAtivo(),
  navegador: boolean = colaboradoresAtivoNoCliente(),
): EstadoInterruptores {
  return estadoInterruptores(servidor, navegador);
}

export function textoDoAviso(e: EstadoInterruptores): string {
  const l = (b: boolean) => (b ? 'ligado' : 'desligado');
  return `Atenção: os dois interruptores do Programa de Colaboradores estão diferentes (servidor: ${l(e.servidor)}; navegador: ${l(e.navegador)}). Ligue ou desligue os dois juntos e refaça o deploy.`;
}
