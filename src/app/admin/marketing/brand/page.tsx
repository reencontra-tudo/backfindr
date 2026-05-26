'use client';

import { useState } from 'react';

export default function BrandPage() {
  const [copied, setCopied] = useState<string | null>(null);

  const copyColor = (hex: string) => {
    navigator.clipboard.writeText(hex);
    setCopied(hex);
    setTimeout(() => setCopied(null), 1500);
  };

  const colors = {
    produto: [
      { name: 'Teal (Primaria)', hex: '#14B8A6', usage: 'Botoes, links, destaques, acoes primarias' },
      { name: 'Teal Escuro', hex: '#0D9488', usage: 'Hover, bordas ativas' },
      { name: 'Dark Background', hex: '#0B0F14', usage: 'Fundo principal (dark mode)' },
      { name: 'Card Dark', hex: '#111827', usage: 'Cards, paineis, modais' },
      { name: 'Branco', hex: '#FFFFFF', usage: 'Texto principal, icones sobre fundo escuro' },
      { name: 'Cinza Claro', hex: '#9CA3AF', usage: 'Texto secundario, labels' },
    ],
    marca: [
      { name: 'Azul Royal', hex: '#1E3A8A', usage: 'Materiais institucionais, pitch decks, impressos' },
      { name: 'Azul Medio', hex: '#2563EB', usage: 'Gradientes do logo, elementos de marca' },
      { name: 'Teal Marca', hex: '#14B8A6', usage: 'Gradiente do logo (azul → teal)' },
    ],
    status: [
      { name: 'Perdido', hex: '#F59E0B', usage: 'Badge e indicadores de status "Perdido"' },
      { name: 'Roubado', hex: '#EF4444', usage: 'Badge e indicadores de status "Roubado"' },
      { name: 'Encontrado', hex: '#22C55E', usage: 'Badge e indicadores de status "Encontrado"' },
      { name: 'Em Analise', hex: '#3B82F6', usage: 'Badge e indicadores de status "Em Analise"' },
      { name: 'Recuperado', hex: '#8B5CF6', usage: 'Badge e indicadores de status "Recuperado"' },
    ],
  };

  const logos = [
    { name: 'Logo Principal (fundo azul)', file: '/icons/logo-backfindr.png', desc: 'Para uso como icone de app' },
    { name: 'Logo Transparente (gradiente)', file: '/icons/logo-backfindr-white.png', desc: 'Para posters, materiais e fundos coloridos' },
    { name: 'Logo Teal (solido)', file: '/icons/logo-backfindr-teal.png', desc: 'Versao alternativa em teal solido' },
    { name: 'Icone Branco', file: '/icons/logo-backfindr-icon-white.png', desc: 'Branco puro, para fundos coloridos/escuros' },
  ];

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6 md:p-10">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icons/logo-backfindr-white.png" alt="Backfindr" className="w-12 h-12 rounded-xl" />
          <h1 className="text-3xl font-bold">Brand Book</h1>
        </div>
        <p className="text-gray-400 mb-10">
          Guia completo de identidade visual da marca Backfindr. Documento definitivo para consulta em todos os contextos de uso.
        </p>

        {/* ═══════════════════════════════════════════════════ */}
        {/* 1. ESCRITA DA MARCA */}
        {/* ═══════════════════════════════════════════════════ */}
        <section className="mb-14">
          <h2 className="text-xl font-bold text-teal-400 mb-4 border-b border-gray-800 pb-2">1. Escrita da Marca</h2>
          <div className="bg-gray-900 rounded-xl p-6 space-y-4">
            <div className="flex items-center gap-6">
              <span className="text-4xl font-black tracking-tight">Backfindr</span>
              <span className="px-3 py-1 bg-green-900/50 text-green-400 rounded-full text-sm font-medium">Correto</span>
            </div>
            <div className="flex flex-wrap gap-4 opacity-50">
              {['backfindr', 'BackFindr', 'Back Findr', 'BACKFINDR', 'Backfinder'].map((wrong) => (
                <span key={wrong} className="text-xl font-bold line-through text-gray-500">{wrong}</span>
              ))}
            </div>
            <div className="mt-4 space-y-2 text-sm text-gray-300">
              <p>&#8226; Sempre &quot;Backfindr&quot; com <strong className="text-white">B maiusculo</strong></p>
              <p>&#8226; Em URLs e dominios: &quot;backfindr.com&quot; (minusculo, padrao web)</p>
              <p>&#8226; Em hashtags: #Backfindr ou #backfindr (ambos aceitos)</p>
              <p>&#8226; Nunca separar em duas palavras ou adicionar &quot;e&quot; (finder)</p>
              <p>&#8226; Em contextos legais/formais: &quot;Backfindr&quot;</p>
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════ */}
        {/* 2. LOCKUPS (Logo + Texto) */}
        {/* ═══════════════════════════════════════════════════ */}
        <section className="mb-14">
          <h2 className="text-xl font-bold text-teal-400 mb-4 border-b border-gray-800 pb-2">2. Lockups (Logo + Texto)</h2>
          <p className="text-gray-400 text-sm mb-6">Combinacoes padronizadas do simbolo com o nome da marca.</p>

          {/* Lockup Horizontal */}
          <div className="mb-8">
            <h3 className="font-semibold text-gray-200 mb-3">Lockup Horizontal (Padrao Principal)</h3>
            <div className="bg-gray-900 rounded-xl p-8 border border-gray-800">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/brand/lockup-horizontal.png" alt="Lockup Horizontal" className="w-full max-h-48 object-contain" />
            </div>
            <div className="mt-3 bg-gray-800/50 rounded-lg p-4 text-sm text-gray-300">
              <strong>Padrao A:</strong> Gap de 8px entre simbolo e texto | Fonte: Inter Bold 700 | Proporcao: altura do texto = 58% da altura do simbolo
            </div>
          </div>

          {/* Lockup Vertical */}
          <div className="mb-8">
            <h3 className="font-semibold text-gray-200 mb-3">Lockup Vertical (Espacos Quadrados)</h3>
            <div className="bg-gray-900 rounded-xl p-8 border border-gray-800 max-w-xs mx-auto">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/brand/lockup-vertical.png" alt="Lockup Vertical" className="w-full max-h-64 object-contain" />
            </div>
            <div className="mt-3 bg-gray-800/50 rounded-lg p-4 text-sm text-gray-300">
              <strong>Uso:</strong> App icons, favicons, avatares de redes sociais, espacos quadrados
            </div>
          </div>

          {/* Tabela de proporcoes */}
          <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
            <h3 className="font-semibold text-gray-200 mb-4">Proporcao Logo:Texto por Contexto</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-700 text-gray-400">
                    <th className="text-left py-2">Contexto</th>
                    <th className="text-left py-2">Simbolo</th>
                    <th className="text-left py-2">Texto</th>
                    <th className="text-left py-2">Gap</th>
                  </tr>
                </thead>
                <tbody className="text-gray-300">
                  <tr className="border-b border-gray-800"><td className="py-2">Header web</td><td>32px</td><td>18px</td><td>8px</td></tr>
                  <tr className="border-b border-gray-800"><td className="py-2">Poster (rodape)</td><td>48-72px</td><td>28-36px</td><td>8px</td></tr>
                  <tr className="border-b border-gray-800"><td className="py-2">Impressao A4</td><td>90px</td><td>50px</td><td>12px</td></tr>
                  <tr><td className="py-2">Redes sociais</td><td>64px</td><td>36px</td><td>8px</td></tr>
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════ */}
        {/* 3. AREA DE PROTECAO */}
        {/* ═══════════════════════════════════════════════════ */}
        <section className="mb-14">
          <h2 className="text-xl font-bold text-teal-400 mb-4 border-b border-gray-800 pb-2">3. Area de Protecao</h2>
          <p className="text-gray-400 text-sm mb-6">Espaco minimo ao redor do logo que nunca deve ser invadido por outros elementos.</p>
          <div className="bg-gray-900 rounded-xl p-8 border border-gray-800 max-w-md mx-auto">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/clear-space.png" alt="Area de Protecao" className="w-full object-contain" />
          </div>
          <div className="mt-4 bg-gray-800/50 rounded-lg p-4 text-sm text-gray-300">
            <strong>Regra:</strong> A area de protecao minima e igual a &quot;X&quot;, onde X = largura da seta interna do pin. Nenhum texto, imagem ou borda pode invadir essa area.
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════ */}
        {/* 4. TAMANHOS MINIMOS */}
        {/* ═══════════════════════════════════════════════════ */}
        <section className="mb-14">
          <h2 className="text-xl font-bold text-teal-400 mb-4 border-b border-gray-800 pb-2">4. Tamanhos Minimos</h2>
          <p className="text-gray-400 text-sm mb-6">Limites de reducao para manter a legibilidade do logo.</p>
          <div className="bg-gray-900 rounded-xl p-8 border border-gray-800">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/minimum-sizes.png" alt="Tamanhos Minimos" className="w-full object-contain" />
          </div>
          <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-gray-900 rounded-lg p-4 border border-green-800/50">
              <p className="text-green-400 font-semibold text-sm">Impressao</p>
              <p className="text-white text-xl font-bold">Min. 30mm</p>
              <p className="text-gray-500 text-xs">Largura minima para materiais impressos</p>
            </div>
            <div className="bg-gray-900 rounded-lg p-4 border border-green-800/50">
              <p className="text-green-400 font-semibold text-sm">Digital</p>
              <p className="text-white text-xl font-bold">Min. 32px</p>
              <p className="text-gray-500 text-xs">Largura minima para uso em telas</p>
            </div>
            <div className="bg-gray-900 rounded-lg p-4 border border-red-800/50">
              <p className="text-red-400 font-semibold text-sm">Proibido</p>
              <p className="text-white text-xl font-bold">&lt; 32px</p>
              <p className="text-gray-500 text-xs">Abaixo disso o logo perde legibilidade</p>
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════ */}
        {/* 5. VARIACOES DE FUNDO */}
        {/* ═══════════════════════════════════════════════════ */}
        <section className="mb-14">
          <h2 className="text-xl font-bold text-teal-400 mb-4 border-b border-gray-800 pb-2">5. Variacoes de Fundo</h2>
          <p className="text-gray-400 text-sm mb-6">Como o logo se comporta sobre diferentes fundos.</p>
          <div className="bg-gray-900 rounded-xl p-8 border border-gray-800">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/background-variations.png" alt="Variacoes de Fundo" className="w-full object-contain" />
          </div>
          <div className="mt-4 bg-gray-900 rounded-lg p-4 border border-gray-800 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-700 text-gray-400">
                  <th className="text-left py-2">Fundo</th>
                  <th className="text-left py-2">Versao do Logo</th>
                  <th className="text-left py-2">Texto</th>
                </tr>
              </thead>
              <tbody className="text-gray-300">
                <tr className="border-b border-gray-800"><td className="py-2">Claro (#FFFFFF)</td><td>Logo colorido (gradiente)</td><td>Texto escuro (#111827)</td></tr>
                <tr className="border-b border-gray-800"><td className="py-2">Escuro (#111827)</td><td>Logo colorido (gradiente)</td><td>Texto branco (#FFFFFF)</td></tr>
                <tr className="border-b border-gray-800"><td className="py-2">Teal (#14B8A6)</td><td>Logo colorido (gradiente)</td><td>Texto branco (#FFFFFF)</td></tr>
                <tr><td className="py-2">Sobre foto</td><td>Logo colorido (gradiente)</td><td>Texto branco com sombra sutil</td></tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════ */}
        {/* 6. USOS INCORRETOS */}
        {/* ═══════════════════════════════════════════════════ */}
        <section className="mb-14">
          <h2 className="text-xl font-bold text-teal-400 mb-4 border-b border-gray-800 pb-2">6. Usos Incorretos</h2>
          <p className="text-gray-400 text-sm mb-6">Exemplos visuais do que nunca deve ser feito com o logo.</p>
          <div className="bg-gray-900 rounded-xl p-8 border border-gray-800">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/incorrect-usage.png" alt="Usos Incorretos" className="w-full object-contain" />
          </div>
          <div className="mt-4 grid grid-cols-2 md:grid-cols-3 gap-3">
            {[
              'Nao distorcer ou esticar',
              'Nao rotacionar',
              'Nao alterar as cores do gradiente',
              'Nao adicionar sombras ou efeitos',
              'Nao sobrepor texto ao logo',
              'Nao usar em fundos confusos/poluidos',
            ].map((rule) => (
              <div key={rule} className="bg-gray-900 rounded-lg p-3 border border-red-900/40 text-sm text-gray-300">
                <span className="text-red-400 mr-1">&#10007;</span> {rule}
              </div>
            ))}
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════ */}
        {/* 7. FAVICON E APP ICON */}
        {/* ═══════════════════════════════════════════════════ */}
        <section className="mb-14">
          <h2 className="text-xl font-bold text-teal-400 mb-4 border-b border-gray-800 pb-2">7. Favicon e App Icon</h2>
          <p className="text-gray-400 text-sm mb-6">Especificacoes para icones de aplicativo e favicon.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/brand/app-icon.png" alt="App Icon" className="w-full max-h-72 object-contain" />
            </div>
            <div className="space-y-4">
              <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
                <h4 className="font-semibold text-sm text-gray-200 mb-2">App Icon (iOS/Android)</h4>
                <ul className="text-sm text-gray-400 space-y-1">
                  <li>&#8226; Tamanho master: 1024x1024px</li>
                  <li>&#8226; Corner radius: 22.37% (iOS aplica automaticamente)</li>
                  <li>&#8226; Background: #0f172a (slate-900)</li>
                  <li>&#8226; Logo centralizado, ocupando 65% da area</li>
                </ul>
              </div>
              <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
                <h4 className="font-semibold text-sm text-gray-200 mb-2">Favicon</h4>
                <ul className="text-sm text-gray-400 space-y-1">
                  <li>&#8226; Tamanhos: 16x16, 32x32, 180x180 (apple-touch)</li>
                  <li>&#8226; Formato: PNG com fundo transparente</li>
                  <li>&#8226; Usar apenas o simbolo (pin), sem texto</li>
                </ul>
              </div>
              <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
                <h4 className="font-semibold text-sm text-gray-200 mb-2">PWA Splash</h4>
                <ul className="text-sm text-gray-400 space-y-1">
                  <li>&#8226; Background: #0f172a</li>
                  <li>&#8226; Logo centralizado (lockup vertical)</li>
                  <li>&#8226; Tamanho: 512x512px</li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════ */}
        {/* 8. ASSINATURA DE RODAPE */}
        {/* ═══════════════════════════════════════════════════ */}
        <section className="mb-14">
          <h2 className="text-xl font-bold text-teal-400 mb-4 border-b border-gray-800 pb-2">8. Assinatura de Rodape (Posters)</h2>
          <p className="text-gray-400 text-sm mb-6">Padrao para rodape de posters, cartazes e materiais impressos.</p>
          <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/footer-signature.png" alt="Assinatura de Rodape" className="w-full object-contain" />
          </div>
          <div className="mt-4 bg-gray-900 rounded-lg p-4 border border-gray-800 overflow-x-auto">
            <table className="w-full text-sm">
              <tbody className="text-gray-300">
                <tr className="border-b border-gray-800"><td className="py-2 text-gray-400 w-40">Fundo</td><td>Teal (#14B8A6)</td></tr>
                <tr className="border-b border-gray-800"><td className="py-2 text-gray-400">Elementos</td><td>Brancos (#FFFFFF)</td></tr>
                <tr className="border-b border-gray-800"><td className="py-2 text-gray-400">Layout</td><td>QR Code (esquerda) | CTA central | Logo + nome (direita)</td></tr>
                <tr className="border-b border-gray-800"><td className="py-2 text-gray-400">Logo</td><td>48px altura + gap 8px + &quot;Backfindr&quot; Inter Bold 700</td></tr>
                <tr><td className="py-2 text-gray-400">Altura rodape</td><td>~15% da altura total do poster</td></tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════ */}
        {/* 9. PALETA DE CORES */}
        {/* ═══════════════════════════════════════════════════ */}
        <section className="mb-14">
          <h2 className="text-xl font-bold text-teal-400 mb-4 border-b border-gray-800 pb-2">9. Paleta de Cores</h2>

          <h3 className="text-lg font-semibold text-gray-300 mb-3 mt-6">Cores de Produto (Interface Digital)</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-8">
            {colors.produto.map((c) => (
              <button
                key={c.hex + c.name}
                onClick={() => copyColor(c.hex)}
                className="bg-gray-900 rounded-xl p-4 text-left hover:bg-gray-800 transition-colors"
              >
                <div className="w-full h-12 rounded-lg mb-3 border border-gray-700" style={{ backgroundColor: c.hex }} />
                <p className="font-medium text-sm">{c.name}</p>
                <p className="text-gray-500 text-xs font-mono">{copied === c.hex ? '✓ Copiado!' : c.hex}</p>
                <p className="text-gray-600 text-xs mt-1">{c.usage}</p>
              </button>
            ))}
          </div>

          <h3 className="text-lg font-semibold text-gray-300 mb-3">Cores de Marca (Institucional)</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-8">
            {colors.marca.map((c) => (
              <button
                key={c.hex + c.name}
                onClick={() => copyColor(c.hex)}
                className="bg-gray-900 rounded-xl p-4 text-left hover:bg-gray-800 transition-colors"
              >
                <div className="w-full h-12 rounded-lg mb-3 border border-gray-700" style={{ backgroundColor: c.hex }} />
                <p className="font-medium text-sm">{c.name}</p>
                <p className="text-gray-500 text-xs font-mono">{copied === c.hex ? '✓ Copiado!' : c.hex}</p>
                <p className="text-gray-600 text-xs mt-1">{c.usage}</p>
              </button>
            ))}
          </div>

          <h3 className="text-lg font-semibold text-gray-300 mb-3">Cores de Status</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            {colors.status.map((c) => (
              <button
                key={c.hex + c.name}
                onClick={() => copyColor(c.hex)}
                className="bg-gray-900 rounded-xl p-4 text-left hover:bg-gray-800 transition-colors"
              >
                <div className="w-full h-12 rounded-lg mb-3 border border-gray-700" style={{ backgroundColor: c.hex }} />
                <p className="font-medium text-sm">{c.name}</p>
                <p className="text-gray-500 text-xs font-mono">{copied === c.hex ? '✓ Copiado!' : c.hex}</p>
                <p className="text-gray-600 text-xs mt-1">{c.usage}</p>
              </button>
            ))}
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════ */}
        {/* 10. TIPOGRAFIA */}
        {/* ═══════════════════════════════════════════════════ */}
        <section className="mb-14">
          <h2 className="text-xl font-bold text-teal-400 mb-4 border-b border-gray-800 pb-2">10. Tipografia</h2>
          <div className="bg-gray-900 rounded-xl p-6 border border-gray-800 space-y-6">
            <div>
              <p className="text-gray-400 text-sm mb-1">Fonte Principal</p>
              <p className="text-3xl font-bold">Inter</p>
              <p className="text-gray-500 text-xs">Google Fonts | Variable Font | Usada em toda a interface</p>
            </div>
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-gray-800 pb-3">
                <span className="text-2xl font-black">Backfindr - Black 900</span>
                <span className="text-gray-500 text-sm">Titulos hero, impacto</span>
              </div>
              <div className="flex items-center justify-between border-b border-gray-800 pb-3">
                <span className="text-2xl font-bold">Backfindr - Bold 700</span>
                <span className="text-gray-500 text-sm">Lockup, subtitulos, CTAs</span>
              </div>
              <div className="flex items-center justify-between border-b border-gray-800 pb-3">
                <span className="text-2xl font-semibold">Backfindr - Semibold 600</span>
                <span className="text-gray-500 text-sm">Labels, navegacao, cards</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-2xl font-normal">Backfindr - Regular 400</span>
                <span className="text-gray-500 text-sm">Corpo de texto, descricoes</span>
              </div>
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════ */}
        {/* 11. REGRAS DE USO */}
        {/* ═══════════════════════════════════════════════════ */}
        <section className="mb-14">
          <h2 className="text-xl font-bold text-teal-400 mb-4 border-b border-gray-800 pb-2">11. Regras de Uso</h2>
          <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-semibold text-green-400 mb-3">&#10003; Fazer</h4>
                <ul className="space-y-2 text-sm text-gray-300">
                  <li>&#8226; Usar &quot;Backfindr&quot; com B maiusculo sempre</li>
                  <li>&#8226; Manter teal (#14B8A6) como cor primaria na interface</li>
                  <li>&#8226; Usar logo transparente sobre fundos coloridos</li>
                  <li>&#8226; Manter area de protecao ao redor do logo</li>
                  <li>&#8226; Usar gradiente azul→teal apenas no logo</li>
                  <li>&#8226; Respeitar gap de 8px entre logo e texto</li>
                  <li>&#8226; Usar Inter Bold 700 no lockup</li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold text-red-400 mb-3">&#10007; Nao Fazer</h4>
                <ul className="space-y-2 text-sm text-gray-300">
                  <li>&#8226; Escrever &quot;backfindr&quot; todo minusculo</li>
                  <li>&#8226; Usar azul royal na interface do produto</li>
                  <li>&#8226; Distorcer, rotacionar ou esticar o logo</li>
                  <li>&#8226; Usar o logo com fundo azul sobre fundo escuro</li>
                  <li>&#8226; Alterar as cores do gradiente do logo</li>
                  <li>&#8226; Usar o logo abaixo do tamanho minimo (32px)</li>
                  <li>&#8226; Adicionar sombras, brilhos ou efeitos ao logo</li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════ */}
        {/* 12. TOM DE VOZ */}
        {/* ═══════════════════════════════════════════════════ */}
        <section className="mb-14">
          <h2 className="text-xl font-bold text-teal-400 mb-4 border-b border-gray-800 pb-2">12. Tom de Voz</h2>
          <p className="text-gray-400 text-sm mb-6">
            A comunicacao da Backfindr e <strong className="text-white">empatica, direta e esperancosa</strong>. 
            Falamos com pessoas em situacao de perda — o tom deve transmitir seguranca e acao.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
              <p className="font-bold text-lg mb-2">Empatico</p>
              <p className="text-gray-400 text-sm mb-4">Entendemos a dor de perder algo importante. Comunicamos com acolhimento e solidariedade.</p>
              <div className="bg-gray-800 rounded-lg p-3">
                <p className="text-xs text-gray-500 mb-1">Exemplo:</p>
                <p className="text-sm text-gray-300 italic">&quot;Sabemos como e dificil. Estamos aqui para ajudar voce a recuperar o que e seu.&quot;</p>
              </div>
            </div>
            <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
              <p className="font-bold text-lg mb-2">Direto</p>
              <p className="text-gray-400 text-sm mb-4">Comunicacao clara e objetiva. Sem rodeios, sem jargoes. O usuario precisa agir rapido.</p>
              <div className="bg-gray-800 rounded-lg p-3">
                <p className="text-xs text-gray-500 mb-1">Exemplo:</p>
                <p className="text-sm text-gray-300 italic">&quot;Registre agora. Compartilhe. Aumente suas chances.&quot;</p>
              </div>
            </div>
            <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
              <p className="font-bold text-lg mb-2">Esperancoso</p>
              <p className="text-gray-400 text-sm mb-4">Transmitimos esperanca realista. Cada compartilhamento aumenta as chances de reencontro.</p>
              <div className="bg-gray-800 rounded-lg p-3">
                <p className="text-xs text-gray-500 mb-1">Exemplo:</p>
                <p className="text-sm text-gray-300 italic">&quot;Cada pessoa que ve seu cartaz e uma chance a mais de reencontro.&quot;</p>
              </div>
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════ */}
        {/* 13. DOWNLOADS */}
        {/* ═══════════════════════════════════════════════════ */}
        <section className="mb-14">
          <h2 className="text-xl font-bold text-teal-400 mb-4 border-b border-gray-800 pb-2">13. Downloads</h2>
          <p className="text-gray-400 text-sm mb-6">Assets oficiais para download e uso em materiais.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {logos.map((logo) => (
              <div key={logo.file} className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
                <div className="h-28 bg-gray-800 flex items-center justify-center p-4">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={logo.file} alt={logo.name} className="max-h-20 object-contain" />
                </div>
                <div className="p-4">
                  <p className="font-semibold text-sm">{logo.name}</p>
                  <p className="text-gray-500 text-xs mt-1">{logo.desc}</p>
                  <a
                    href={logo.file}
                    download
                    className="mt-3 inline-block px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white text-xs font-medium rounded-lg transition-colors"
                  >
                    Download PNG
                  </a>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Footer */}
        <div className="text-center text-gray-600 text-xs py-8 border-t border-gray-800">
          Brand Book v4.0 — Backfindr &copy; {new Date().getFullYear()} — Documento interno definitivo
        </div>
      </div>
    </div>
  );
}
