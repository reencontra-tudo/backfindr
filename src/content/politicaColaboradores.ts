// TEXTO OFICIAL da Política do Programa de Colaboradores Backfindr — versão aprovada pelo fundador em 23/11/2026 (fonte: docs/programa-colaboradores/POLITICA.md).
// NÃO redigir política nova: alterações só com ordem do fundador (e, ao mudar, trocar `POLITICA_VERSAO`). Pendente: revisão por advogado e contador.
// Gerado a partir do POLITICA.md; `tests/colaboradores-politica.test.ts` confere que continua igual ao documento.

export const POLITICA_VERSAO = '2026-11-23';
export const POLITICA_TITULO = 'Política do Programa de Colaboradores Backfindr';

export interface BlocoPolitica { tipo: 'p' | 'li' | 'check'; texto: string }
export interface SecaoPolitica { titulo: string; blocos: BlocoPolitica[] }

export const POLITICA_SECOES: SecaoPolitica[] = [
  {
    "titulo": "1. Objetivo e quem pode participar",
    "blocos": [
      {
        "tipo": "p",
        "texto": "O Programa de Colaboradores leva o Backfindr a mais pessoas que perderam, acharam ou tiveram algo roubado. Em troca, o colaborador recebe uma página própria e comissão sobre o \"ampliar alcance\"."
      },
      {
        "tipo": "p",
        "texto": "Pode participar o administrador de qualquer grupo, perfil ou página em rede social, **de qualquer tamanho**, desde que divulgue a sua página de colaborador e o Backfindr."
      },
      {
        "tipo": "p",
        "texto": "A participação é gratuita. O colaborador não paga nada para entrar nem para manter a página."
      }
    ]
  },
  {
    "titulo": "2. O que o colaborador recebe",
    "blocos": [
      {
        "tipo": "li",
        "texto": "**Página própria** em backfindr.com/@[nome] (ex.: backfindr.com/@animaisperdidoszonaleste), com o nome e a imagem do grupo ou perfil no topo e a assinatura \"por Backfindr\"."
      },
      {
        "tipo": "li",
        "texto": "**Link de volta** para o grupo ou perfil de origem, em destaque na página."
      },
      {
        "tipo": "li",
        "texto": "**Ferramentas do Backfindr** para os membros: cadastro de perdido, achado e roubado, mapa, busca e aviso de possíveis correspondências."
      },
      {
        "tipo": "li",
        "texto": "**Imagem de divulgação** de cada ocorrência com a marca do colaborador, pronta para postar no grupo ou perfil."
      },
      {
        "tipo": "li",
        "texto": "**Painel simples** com a lista de ocorrências cadastradas pelo seu link e o valor de comissão acumulado."
      },
      {
        "tipo": "li",
        "texto": "**Comissão de 25%** sobre o \"ampliar alcance\" comprado para ocorrências cadastradas com o seu código (seção 4)."
      },
      {
        "tipo": "p",
        "texto": "As ocorrências cadastradas pela página também aparecem no Backfindr inteiro, o que amplia o alcance de cada aviso."
      }
    ]
  },
  {
    "titulo": "3. Obrigações do colaborador",
    "blocos": [
      {
        "tipo": "li",
        "texto": "Divulgar a sua página de colaborador e o Backfindr no grupo, perfil ou página de origem."
      },
      {
        "tipo": "li",
        "texto": "Manter atualizados nome, imagem e link de origem informados no cadastro."
      },
      {
        "tipo": "li",
        "texto": "Usar a marca Backfindr apenas como fornecida, sem alterar logo, nome ou assinatura."
      },
      {
        "tipo": "li",
        "texto": "Informar os membros com veracidade sobre o que o Backfindr faz, sem prometer resultado."
      },
      {
        "tipo": "li",
        "texto": "Seguir as regras de segurança e de uso do Backfindr, as mesmas que valem para qualquer usuário."
      },
      {
        "tipo": "li",
        "texto": "Avisar o Backfindr quando identificar golpe, ocorrência falsa ou uso indevido da página."
      },
      {
        "tipo": "p",
        "texto": "**Troca do canal de origem:** o colaborador pode trocar o grupo ou perfil ligado à página. O novo canal passa pela verificação de novo, e a liberação de comissão fica suspensa até a confirmação."
      }
    ]
  },
  {
    "titulo": "4. Comissão: cálculo, acúmulo e saque",
    "blocos": [
      {
        "tipo": "p",
        "texto": "O colaborador recebe **25% do valor pago pelo usuário** em cada compra de \"ampliar alcance\" para uma ocorrência cadastrada com o seu código."
      },
      {
        "tipo": "li",
        "texto": "**Código do colaborador:** cada ocorrência pode levar o código de um colaborador, informado no cadastro da ocorrência. O código pode ser o @nome do colaborador ou um código curto exclusivo dele (ex.: ZL27); os dois valem. Ao digitar, o sistema mostra o nome do colaborador para confirmação. Quem chega pelo link do colaborador já encontra o código preenchido. O código fica vinculado àquela ocorrência e não pode ser trocado. Cada nova ocorrência depende do link ou do código usado no cadastro dela. Compras de \"ampliar alcance\" para uma ocorrência geram comissão ao colaborador do código dela, enquanto ele estiver no programa."
      },
      {
        "tipo": "li",
        "texto": "**Compras que não contam:** compras do próprio colaborador e compras canceladas, estornadas ou contestadas. Se o estorno ocorrer depois do crédito, o valor é descontado do saldo."
      },
      {
        "tipo": "li",
        "texto": "**Acúmulo:** o painel mostra o valor ganho, que vai se somando até o pedido de saque."
      },
      {
        "tipo": "li",
        "texto": "**Saque:** o colaborador pede o saque pelo painel quando o saldo atingir o valor mínimo. O valor mínimo para saque é de R$ 50."
      },
      {
        "tipo": "li",
        "texto": "**Repasse:** no início, o Backfindr faz o repasse manualmente, por PIX, para a conta informada pelo colaborador, em até 10 dias úteis após o pedido. Quando houver volume, o processo passa a ser automático."
      },
      {
        "tipo": "li",
        "texto": "**Natureza:** a comissão é uma participação nas vendas que o colaborador ajudou a gerar. Não é salário, não cria vínculo de emprego e não é pagamento por cadastro."
      },
      {
        "tipo": "li",
        "texto": "**Tributos:** cada colaborador é responsável pelos tributos sobre o que recebe."
      },
      {
        "tipo": "p",
        "texto": "**Verificação do canal:** a página entra no ar logo após o cadastro, mas a comissão só é liberada depois que o Backfindr confirma que o colaborador administra o grupo ou perfil informado. A confirmação é feita por um código publicado no canal ou pelo link da página na bio do perfil."
      },
      {
        "tipo": "p",
        "texto": "**Caráter das regras de comissão:** as regras desta seção valem apenas para o Programa de Colaboradores, não constituem regra geral do Backfindr e podem ser alteradas a qualquer tempo, a critério do Backfindr."
      }
    ]
  },
  {
    "titulo": "5. Condutas proibidas",
    "blocos": [
      {
        "tipo": "li",
        "texto": "Pressionar quem perdeu algo a comprar \"ampliar alcance\", criar falsa urgência ou prometer que a compra garante o reencontro."
      },
      {
        "tipo": "li",
        "texto": "Cadastrar, incentivar ou permitir ocorrências falsas, duplicadas de propósito ou feitas só para gerar comissão."
      },
      {
        "tipo": "li",
        "texto": "Comprar \"ampliar alcance\" para si mesmo ou combinar compras com terceiros para gerar comissão."
      },
      {
        "tipo": "li",
        "texto": "Participar, facilitar ou se omitir diante de golpes, como falsos achados para extorquir quem perdeu algo."
      },
      {
        "tipo": "li",
        "texto": "Cobrar dos membros qualquer valor para usar a página ou o Backfindr."
      },
      {
        "tipo": "li",
        "texto": "Usar a página para vender produtos, serviços ou publicidade de terceiros."
      },
      {
        "tipo": "li",
        "texto": "Se passar pelo Backfindr, falar em nome dele ou dizer que é funcionário ou sócio."
      },
      {
        "tipo": "li",
        "texto": "Alterar a marca Backfindr ou usar o nome em outros sites sem autorização."
      },
      {
        "tipo": "li",
        "texto": "Coletar, copiar ou usar dados de usuários do Backfindr fora da plataforma."
      },
      {
        "tipo": "li",
        "texto": "Enviar mensagens em massa não solicitadas (spam) usando o nome do Backfindr."
      },
      {
        "tipo": "li",
        "texto": "Publicar conteúdo ofensivo, discriminatório, ilegal ou que exponha pessoas."
      }
    ]
  },
  {
    "titulo": "6. Penalidades e perda da página",
    "blocos": [
      {
        "tipo": "p",
        "texto": "**Qualquer transgressão desta política leva à perda da página e da participação no programa.** Não há advertência prévia."
      },
      {
        "tipo": "li",
        "texto": "A página sai do ar e o link deixa de funcionar."
      },
      {
        "tipo": "li",
        "texto": "Todo o saldo de comissão ainda não pago é cancelado."
      },
      {
        "tipo": "li",
        "texto": "O Backfindr pode suspender a página durante a análise de uma suspeita, sem pagar saques nesse período."
      },
      {
        "tipo": "li",
        "texto": "Casos de golpe ou crime são comunicados às autoridades quando a lei exigir ou permitir."
      },
      {
        "tipo": "li",
        "texto": "O colaborador excluído não pode voltar ao programa com outro grupo, perfil ou cadastro."
      }
    ]
  },
  {
    "titulo": "7. Dados pessoais e LGPD",
    "blocos": [
      {
        "tipo": "p",
        "texto": "O Backfindr é o responsável pelos dados dos usuários que se cadastram pela página do colaborador, e trata esses dados conforme a LGPD e a política de privacidade do Backfindr."
      },
      {
        "tipo": "li",
        "texto": "O colaborador vê apenas as ocorrências cadastradas pelo seu link, como já aparecem publicamente, sem dados de contato."
      },
      {
        "tipo": "li",
        "texto": "O colaborador não recebe nome, e-mail, telefone nem outros dados pessoais dos usuários."
      },
      {
        "tipo": "li",
        "texto": "Os dados de pagamento do colaborador (chave PIX, documento) são usados só para o repasse e guardados com segurança."
      }
    ]
  },
  {
    "titulo": "8. Saída do programa",
    "blocos": [
      {
        "tipo": "p",
        "texto": "O colaborador pode sair quando quiser, pelo painel ou por mensagem ao Backfindr. O Backfindr também pode encerrar o programa ou a participação de um colaborador."
      },
      {
        "tipo": "li",
        "texto": "A página sai do ar, e o endereço passa a levar ao Feed do Backfindr. O próprio colaborador pode reativar o seu @nome a qualquer momento. Outra pessoa só pode usar o mesmo @nome depois de 12 meses sem atividade, e recebe um código curto novo."
      },
      {
        "tipo": "li",
        "texto": "As ocorrências cadastradas por ela **continuam no Backfindr**, porque já fazem parte da plataforma."
      },
      {
        "tipo": "li",
        "texto": "Na saída voluntária, o saldo de comissão que já atingiu o valor mínimo pode ser sacado."
      },
      {
        "tipo": "li",
        "texto": "Após a saída, compras de usuários vindos do antigo link deixam de gerar comissão."
      }
    ]
  },
  {
    "titulo": "9. Alterações e pontos em aberto",
    "blocos": [
      {
        "tipo": "p",
        "texto": "O Backfindr pode alterar esta política e as regras de comissão a qualquer tempo, a seu critério, avisando os colaboradores pelo painel. Continuar no programa após o aviso significa aceitar a nova versão."
      },
      {
        "tipo": "p",
        "texto": "Antes de publicar para colaboradores reais:"
      },
      {
        "tipo": "check",
        "texto": "Revisão por advogado e contador (repasse a pessoas físicas, tributos, termos de aceite)."
      }
    ]
  }
];
