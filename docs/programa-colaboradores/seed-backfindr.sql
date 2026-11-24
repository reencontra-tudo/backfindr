-- Programa de Colaboradores — seed do primeiro (e único) colaborador do piloto: o próprio Backfindr (`/@backfindr`).
--
-- NÃO EXECUTAR em nenhum banco compartilhado com a produção sem ORDEM ESCRITA do fundador. Pensado para o banco ISOLADO de teste (ver DESENHO.md §10).
-- Pré-requisito: a migration 026 aplicada nesse banco. Não altera nenhuma outra tabela.
--
-- O código curto é gerado pelo sistema (alfabeto sem 0, O, 1, I; 4 caracteres). O valor abaixo foi sorteado para este seed; se já existir no banco,
-- troque por outro do mesmo alfabeto. `interno = true`: o Backfindr nunca comissiona (e o piloto não tem nada financeiro).
-- `verificado_em` preenchido: o fundador é o próprio responsável pelo canal (a página só fica indexável com verificação, ver PC-03).
-- Sem região e sem raio: a página mostra só as ocorrências cadastradas com o código (a região é opcional).

INSERT INTO colaboradores (slug, codigo_curto, nome, descricao, canal_url, modalidade, estado, interno, verificado_em)
VALUES (
  'backfindr',
  'HX7R',
  'Backfindr',
  'Ocorrências de objetos, documentos e pets perdidos, achados ou roubados registradas no Backfindr.',
  'https://backfindr.com',
  'comunidade_criador',
  'ativo',
  TRUE,
  NOW()
)
ON CONFLICT DO NOTHING;

-- Verificação (somente leitura):
--   select slug, codigo_curto, estado, interno, verificado_em is not null as verificado from colaboradores;   -- 1 linha: backfindr | HX7R | ativo | t | t
--
-- Reversão (a linha NUNCA é apagada: o gatilho recusa DELETE; o @nome nunca é reutilizado). Para tirar a página do ar:
--   update colaboradores set estado = 'saiu', atualizado_em = now() where slug = 'backfindr';     -- a página passa a redirecionar (308) para o Feed
-- Para desfazer tudo num banco de teste, remova o banco ou a branch de teste inteira, ou use a reversão completa da migration 026.
