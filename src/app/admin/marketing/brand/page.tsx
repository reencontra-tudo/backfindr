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
      { name: 'Teal (Primária)', hex: '#14B8A6', usage: 'Botões, links, destaques, ações primárias' },
      { name: 'Teal Escuro', hex: '#0D9488', usage: 'Hover, bordas ativas' },
      { name: 'Dark Background', hex: '#0B0F14', usage: 'Fundo principal (dark mode)' },
      { name: 'Card Dark', hex: '#111827', usage: 'Cards, painéis, modais' },
      { name: 'Branco', hex: '#FFFFFF', usage: 'Texto principal, ícones sobre fundo escuro' },
      { name: 'Cinza Claro', hex: '#9CA3AF', usage: 'Texto secundário, labels' },
    ],
    marca: [
      { name: 'Azul Royal', hex: '#1E3A8A', usage: 'Materiais institucionais, pitch decks, impressos' },
      { name: 'Azul Médio', hex: '#2563EB', usage: 'Gradientes do logo, elementos de marca' },
      { name: 'Teal Marca', hex: '#14B8A6', usage: 'Gradiente do logo (azul → teal)' },
    ],
    status: [
      { name: 'Perdido', hex: '#F59E0B', usage: 'Badge e indicadores de status "Perdido"' },
      { name: 'Roubado', hex: '#EF4444', usage: 'Badge e indicadores de status "Roubado"' },
      { name: 'Encontrado', hex: '#10B981', usage: 'Badge e indicadores de status "Encontrado/Recuperado"' },
    ],
  };

  const logos = [
    { name: 'Logo Principal (fundo azul)', file: '/icons/logo-backfindr.png', desc: 'Para uso sobre fundos claros ou como ícone de app' },
    { name: 'Logo Transparente (gradiente)', file: '/icons/logo-backfindr-white.png', desc: 'Para uso sobre fundos coloridos (teal, escuro) — posters e materiais' },
    { name: 'Logo Teal (sólido)', file: '/icons/logo-backfindr-teal.png', desc: 'Versão alternativa em teal sólido' },
    { name: 'Logo Teal Dark', file: '/icons/logo-backfindr-teal-dark.png', desc: 'Versão teal com centro navy — alto contraste' },
  ];

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6 md:p-10">
      {/* Header */}
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center gap-4 mb-2">
          <img src="/icons/logo-backfindr-white.png" alt="Backfindr" className="w-12 h-12 rounded-xl" />
          <h1 className="text-3xl font-bold">Brand Book</h1>
        </div>
        <p className="text-gray-400 mb-10">
          Guia de identidade visual da marca Backfindr. Consulte as diretrizes abaixo para manter a consistência em todos os materiais.
        </p>

        {/* ── ESCRITA DA MARCA ── */}
        <section className="mb-12">
          <h2 className="text-xl font-bold text-teal-400 mb-4 border-b border-gray-800 pb-2">Escrita da Marca</h2>
          <div className="bg-gray-900 rounded-xl p-6 space-y-4">
            <div className="flex items-center gap-6">
              <span className="text-4xl font-black tracking-tight">Backfindr</span>
              <span className="px-3 py-1 bg-green-900/50 text-green-400 rounded-full text-sm font-medium">Correto</span>
            </div>
            <div className="flex items-center gap-6 opacity-50">
              <span className="text-4xl font-black tracking-tight line-through">backfindr</span>
              <span className="px-3 py-1 bg-red-900/50 text-red-400 rounded-full text-sm font-medium">Incorreto</span>
            </div>
            <p className="text-gray-400 text-sm mt-4">
              Sempre com <strong className="text-white">B maiúsculo</strong>. O &quot;r&quot; final permanece minúsculo. 
              Nunca use &quot;BackFindr&quot;, &quot;BACKFINDR&quot; ou &quot;backfindr&quot; em materiais oficiais.
            </p>
          </div>
        </section>

        {/* ── LOGOS ── */}
        <section className="mb-12">
          <h2 className="text-xl font-bold text-teal-400 mb-4 border-b border-gray-800 pb-2">Logos e Variações</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {logos.map((logo) => (
              <div key={logo.file} className="bg-gray-900 rounded-xl p-6 flex flex-col items-center gap-4">
                <div className="w-24 h-24 flex items-center justify-center bg-gray-800 rounded-2xl p-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={logo.file} alt={logo.name} className="w-full h-full object-contain" />
                </div>
                <div className="text-center">
                  <p className="font-semibold text-sm">{logo.name}</p>
                  <p className="text-gray-500 text-xs mt-1">{logo.desc}</p>
                </div>
                <a
                  href={logo.file}
                  download
                  className="mt-2 px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  Download PNG
                </a>
              </div>
            ))}
          </div>
        </section>

        {/* ── PALETA DE CORES ── */}
        <section className="mb-12">
          <h2 className="text-xl font-bold text-teal-400 mb-4 border-b border-gray-800 pb-2">Paleta de Cores</h2>

          {/* Cores de Produto */}
          <h3 className="text-lg font-semibold text-gray-300 mb-3 mt-6">Cores de Produto (Interface Digital)</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-8">
            {colors.produto.map((c) => (
              <button
                key={c.hex}
                onClick={() => copyColor(c.hex)}
                className="bg-gray-900 rounded-xl p-4 text-left hover:bg-gray-800 transition-colors group"
              >
                <div
                  className="w-full h-12 rounded-lg mb-3 border border-gray-700"
                  style={{ backgroundColor: c.hex }}
                />
                <p className="font-medium text-sm">{c.name}</p>
                <p className="text-gray-500 text-xs font-mono">
                  {copied === c.hex ? '✓ Copiado!' : c.hex}
                </p>
                <p className="text-gray-600 text-xs mt-1">{c.usage}</p>
              </button>
            ))}
          </div>

          {/* Cores de Marca */}
          <h3 className="text-lg font-semibold text-gray-300 mb-3">Cores de Marca (Institucional)</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-8">
            {colors.marca.map((c) => (
              <button
                key={c.hex}
                onClick={() => copyColor(c.hex)}
                className="bg-gray-900 rounded-xl p-4 text-left hover:bg-gray-800 transition-colors group"
              >
                <div
                  className="w-full h-12 rounded-lg mb-3 border border-gray-700"
                  style={{ backgroundColor: c.hex }}
                />
                <p className="font-medium text-sm">{c.name}</p>
                <p className="text-gray-500 text-xs font-mono">
                  {copied === c.hex ? '✓ Copiado!' : c.hex}
                </p>
                <p className="text-gray-600 text-xs mt-1">{c.usage}</p>
              </button>
            ))}
          </div>

          {/* Cores de Status */}
          <h3 className="text-lg font-semibold text-gray-300 mb-3">Cores de Status</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {colors.status.map((c) => (
              <button
                key={c.hex}
                onClick={() => copyColor(c.hex)}
                className="bg-gray-900 rounded-xl p-4 text-left hover:bg-gray-800 transition-colors group"
              >
                <div
                  className="w-full h-12 rounded-lg mb-3 border border-gray-700"
                  style={{ backgroundColor: c.hex }}
                />
                <p className="font-medium text-sm">{c.name}</p>
                <p className="text-gray-500 text-xs font-mono">
                  {copied === c.hex ? '✓ Copiado!' : c.hex}
                </p>
                <p className="text-gray-600 text-xs mt-1">{c.usage}</p>
              </button>
            ))}
          </div>
        </section>

        {/* ── TIPOGRAFIA ── */}
        <section className="mb-12">
          <h2 className="text-xl font-bold text-teal-400 mb-4 border-b border-gray-800 pb-2">Tipografia</h2>
          <div className="bg-gray-900 rounded-xl p-6 space-y-4">
            <div>
              <p className="text-gray-400 text-sm mb-1">Fonte Principal</p>
              <p className="text-2xl font-bold">Inter</p>
              <p className="text-gray-500 text-xs">Usada em toda a interface: títulos, corpo, labels</p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
              <div>
                <p className="font-black text-lg">Black (900)</p>
                <p className="text-gray-500 text-xs">Logo, títulos hero</p>
              </div>
              <div>
                <p className="font-bold text-lg">Bold (700)</p>
                <p className="text-gray-500 text-xs">Títulos, CTAs</p>
              </div>
              <div>
                <p className="font-semibold text-lg">Semibold (600)</p>
                <p className="text-gray-500 text-xs">Subtítulos, labels</p>
              </div>
              <div>
                <p className="font-normal text-lg">Regular (400)</p>
                <p className="text-gray-500 text-xs">Corpo de texto</p>
              </div>
            </div>
          </div>
        </section>

        {/* ── REGRAS DE USO ── */}
        <section className="mb-12">
          <h2 className="text-xl font-bold text-teal-400 mb-4 border-b border-gray-800 pb-2">Regras de Uso</h2>
          <div className="bg-gray-900 rounded-xl p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-semibold text-green-400 mb-2">Fazer</h4>
                <ul className="space-y-2 text-sm text-gray-300">
                  <li>• Usar &quot;Backfindr&quot; com B maiúsculo sempre</li>
                  <li>• Manter teal (#14B8A6) como cor primária na interface</li>
                  <li>• Usar logo transparente sobre fundos coloridos</li>
                  <li>• Manter espaçamento mínimo ao redor do logo</li>
                  <li>• Usar gradiente azul→teal apenas no logo</li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold text-red-400 mb-2">Não Fazer</h4>
                <ul className="space-y-2 text-sm text-gray-300">
                  <li>• Escrever &quot;backfindr&quot; todo minúsculo</li>
                  <li>• Usar azul royal na interface do produto</li>
                  <li>• Distorcer ou rotacionar o logo</li>
                  <li>• Usar o logo com fundo azul sobre fundo escuro</li>
                  <li>• Alterar as cores do gradiente do logo</li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* ── TOM DE VOZ ── */}
        <section className="mb-12">
          <h2 className="text-xl font-bold text-teal-400 mb-4 border-b border-gray-800 pb-2">Tom de Voz</h2>
          <div className="bg-gray-900 rounded-xl p-6 space-y-3">
            <p className="text-gray-300 text-sm">
              A comunicação da Backfindr é <strong className="text-white">empática, direta e esperançosa</strong>. 
              Falamos com pessoas que estão em situação de perda — o tom deve transmitir segurança e ação.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
              <div className="bg-gray-800 rounded-lg p-4">
                <p className="font-semibold text-teal-400 text-sm mb-1">Empático</p>
                <p className="text-gray-400 text-xs">&quot;Sabemos como é difícil perder algo importante.&quot;</p>
              </div>
              <div className="bg-gray-800 rounded-lg p-4">
                <p className="font-semibold text-teal-400 text-sm mb-1">Direto</p>
                <p className="text-gray-400 text-xs">&quot;Registre agora. Quanto antes, maiores as chances.&quot;</p>
              </div>
              <div className="bg-gray-800 rounded-lg p-4">
                <p className="font-semibold text-teal-400 text-sm mb-1">Esperançoso</p>
                <p className="text-gray-400 text-xs">&quot;Milhares de objetos já foram devolvidos com a Backfindr.&quot;</p>
              </div>
            </div>
          </div>
        </section>

        {/* Footer */}
        <div className="text-center text-gray-600 text-xs py-8 border-t border-gray-800">
          Brand Book v3.0 — Backfindr © {new Date().getFullYear()}
        </div>
      </div>
    </div>
  );
}
