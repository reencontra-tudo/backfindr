'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useEffect, useState } from 'react';

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <nav
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${
        scrolled ? 'border-b border-white/[0.08] bg-[#07090e]/88 backdrop-blur-xl' : ''
      }`}
    >
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-4">
        <Link href="/" className="flex items-center gap-3">
          <Image
            src="/branding/logo-backfindr.jpeg"
            alt="Logo Backfindr"
            width={40}
            height={40}
            className="h-10 w-10 rounded-xl object-cover shadow-lg"
            priority
          />
          <p className="text-sm font-bold tracking-tight text-white">Backfindr</p>
        </Link>

        <div className="hidden items-center gap-7 md:flex">
          <Link href="#ao-vivo" className="text-sm text-white/45 transition-colors hover:text-white">Ao vivo</Link>
          <Link href="#como-funciona" className="text-sm text-white/45 transition-colors hover:text-white">Como funciona</Link>
          <Link href="#pets" className="text-sm text-white/45 transition-colors hover:text-white">Pets</Link>
          <Link href="/map" className="text-sm text-white/45 transition-colors hover:text-white">Mapa</Link>
        </div>

        <div className="flex items-center gap-3">
          <Link href="/auth/login" className="text-sm text-white/50 transition-colors hover:text-white">
            Entrar
          </Link>
          <Link
            href="/auth/register"
            className="rounded-xl bg-teal-500 px-4 py-2 text-sm font-semibold text-white transition-all hover:bg-teal-400"
            style={{ boxShadow: '0 8px 24px rgba(20,184,166,0.22)' }}
          >
            Criar QR grátis
          </Link>
        </div>
      </div>
    </nav>
  );
}
