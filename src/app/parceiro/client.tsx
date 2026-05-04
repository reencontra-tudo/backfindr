"use client";

import Link from "next/link";

export default function ParceiroClient() {
  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <section className="mx-auto max-w-6xl px-6 py-16">
        <p className="mb-4 text-sm font-semibold uppercase tracking-[0.28em] text-emerald-400">
          Backfindr Parceiros
        </p>

        <h1 className="max-w-4xl text-4xl font-bold leading-tight md:text-6xl">
          Seja parceiro do Backfindr e ajude pessoas a recuperarem o que foi perdido.
        </h1>

        <p className="mt-6 max-w-3xl text-lg leading-8 text-slate-300">
          O Backfindr é uma plataforma gratuita para cadastrar objetos perdidos,
          itens encontrados, casos de roubo, bicicletas, celulares, veículos e
          pets desaparecidos.
        </p>

        <p className="mt-4 max-w-3xl text-lg leading-8 text-slate-300">
          Como parceiro, você pode divulgar a plataforma, orientar pessoas a
          registrarem suas ocorrências e aumentar as chances de reencontro.
        </p>

        <div className="mt-8 flex flex-col gap-4 sm:flex-row">
          <Link
            href="/auth/register"
            className="rounded-xl bg-emerald-500 px-6 py-3 text-center font-semibold text-slate-950 hover:bg-emerald-400"
          >
            Cadastrar ocorrência grátis
          </Link>

          <Link
            href="/"
            className="rounded-xl border border-slate-700 px-6 py-3 text-center font-semibold text-white hover:bg-slate-900"
          >
            Voltar para o início
          </Link>
        </div>

        <div className="mt-12 grid gap-5 md:grid-cols-3">
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
            <h2 className="text-xl font-bold">Perdeu algo?</h2>
            <p className="mt-3 text-slate-300">
              Cadastre gratuitamente o item perdido para aumentar as chances de
              alguém encontrar e entrar em contato.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
            <h2 className="text-xl font-bold">Encontrou algo?</h2>
            <p className="mt-3 text-slate-300">
              Publique o item encontrado e ajude o verdadeiro dono a recuperar
              com mais segurança.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
            <h2 className="text-xl font-bold">Pet desaparecido?</h2>
            <p className="mt-3 text-slate-300">
              Divulgue pets desaparecidos e conecte informações em uma página
              simples, gratuita e acessível.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}