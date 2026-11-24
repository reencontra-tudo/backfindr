import { readFileSync } from 'fs';
import { BUSCAS, lerRss, filtrarNoticias, avaliarTitulo, tituloSemFonte, IDADE_MAXIMA_DIAS } from '/home/user/backfindr/src/lib/noticias/filtro.ts';
const agora = Date.now();
const todos: any[] = [];
BUSCAS.forEach((b, i) => {
  const itens = lerRss(readFileSync(`/tmp/rss/q${i + 1}.xml`, 'utf8'));
  const idade = itens.filter(n => agora - Date.parse(n.pubDate) <= IDADE_MAXIMA_DIAS * 864e5).length;
  const bons = itens.filter(n => avaliarTitulo(tituloSemFonte(n.title, n.source)).ok).length;
  console.log(`busca ${i + 1} «${b}»: ${itens.length} itens crus, ${idade} dentro de ${IDADE_MAXIMA_DIAS} dias, ${bons} passam na relevância (sem idade)`);
  todos.push(...itens);
});
const r = filtrarNoticias(todos, { agora });
console.log(`\nTOTAL cru ${todos.length} → painel ${r.length}\n`);
r.forEach((n, i) => console.log(`${i + 1}. ${n.title} | ${n.source} | ${n.pubDate.slice(5, 16)}`));
// o que o filtro derrubou por relevância dentro da idade (amostra para revisão)
const dentro = todos.filter(n => agora - Date.parse(n.pubDate) <= IDADE_MAXIMA_DIAS * 864e5);
const fora = dentro.filter(n => !avaliarTitulo(tituloSemFonte(n.title, n.source)).ok);
console.log(`\n--- ${fora.length} derrubados por relevância (primeiros 25) ---`);
fora.slice(0, 25).forEach(n => console.log(`- ${tituloSemFonte(n.title, n.source).slice(0, 110)} [${avaliarTitulo(tituloSemFonte(n.title, n.source)).motivo}]`));
