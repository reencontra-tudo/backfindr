// Limpeza dos testes que usam Postgres real (TEST_DATABASE_URL, banco local DESCARTÁVEL).
// Cada arquivo de teste cria as suas próprias tabelas no `beforeAll` (DROP + CREATE) e, ao terminar, chama `removerTabelas` com a lista EXATA do que criou.
// Por que remover a tabela e não só as linhas: o livro (`colaborador_lancamentos`) e a auditoria só aceitam INSERT por gatilho (nem DELETE nem TRUNCATE passam),
// mas `DROP TABLE` não dispara esses gatilhos — e é o que os próprios testes já fazem ao recriar o esquema. Assim não sobra linha nem tabela para o teste seguinte,
// e a suíte não depende mais da ORDEM em que os arquivos rodam.
// Nunca lança erro (roda no `afterAll`, inclusive depois de falha): problema na limpeza vira aviso, não derruba o resultado dos testes.
import type { Pool } from 'pg';

const NOME_SEGURO = /^[a-z_][a-z0-9_]*$/;

export async function removerTabelas(pool: Pick<Pool, 'query'> | undefined | null, tabelas: readonly string[]): Promise<void> {
  if (!pool) return;
  const validas = tabelas.filter((t) => NOME_SEGURO.test(t));
  if (validas.length !== tabelas.length) { console.warn('[limpeza-banco] nome de tabela inválido ignorado'); }
  if (validas.length === 0) return;
  try { await pool.query(`DROP TABLE IF EXISTS ${validas.map((t) => `"${t}"`).join(', ')} CASCADE`); }
  catch (e) { console.warn('[limpeza-banco] não foi possível remover as tabelas do teste:', e instanceof Error ? e.message : 'erro'); }
}
