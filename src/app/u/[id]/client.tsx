'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { MapPin, CheckCircle2, Package, Star, Calendar } from 'lucide-react';
import { api, parseApiError } from '@/lib/api';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface PublicProfile {
  id: string;
  name: string;
  avatar_url?: string;
  plan: string;
  created_at: string;
  stats: {
    objects_registered: number;
    objects_returned: number;
    found_and_returned: number;
  };
}

export default function UserProfilePage() {
  const { id } = useParams<{ id: string }>();
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    api.get(`/users/${id}/public`)
      .then(({ data }) => setProfile(data))
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#080b0f] flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-teal-500 border-t-transparent animate-spin" />
      </div>
    );
  }

  if (notFound || !profile) {
    return (
      <div className="min-h-screen bg-[#080b0f] flex flex-col items-center justify-center text-center px-5">
        <p className="text-white font-bold text-xl mb-2">Perfil não encontrado</p>
        <Link href="/" className="text-teal-400 text-sm mt-4">Voltar ao Backfindr →</Link>
      </div>
    );
  }

  const initials = profile.name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();

  return (
    <div className="min-h-screen bg-[#080b0f] text-white">
      <nav className="border-b border-white/[0.06] px-5 h-14 flex items-center">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-teal-500 flex items-center justify-center">
            <MapPin className="w-3.5 h-3.5 text-white" strokeWidth={2.5} />
          </div>
          <span className="text-white font-semibold text-[15px]">Backfindr</span>
        </Link>
      </nav>

      <div className="max-w-xl mx-auto px-5 py-12">
        {/* Avatar + info */}
        <div className="flex items-center gap-5 mb-10">
          {profile.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={profile.avatar_url} alt={profile.name}
              className="w-16 h-16 rounded-full border border-white/[0.1] flex-shrink-0" />
          ) : (
            <div className="w-16 h-16 rounded-full bg-teal-500 flex items-center justify-center text-white font-bold text-xl flex-shrink-0">
              {initials}
            </div>
          )}
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-xl font-bold text-white">{profile.name}</h1>
              {profile.plan === 'pro' && (
                <span className="flex items-center gap-1 text-xs text-yellow-400 bg-yellow-500/10 border border-yellow-500/20 px-2 py-0.5 rounded-full">
                  <Star className="w-3 h-3" /> Pro
                </span>
              )}
            </div>
            <div className="flex items-center gap-1 text-white/30 text-xs">
              <Calendar className="w-3 h-3" />
              Membro desde {format(new Date(profile.created_at), "MMMM 'de' yyyy", { locale: ptBR })}
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mb-10">
          {[
            { icon: <Package className="w-4 h-4 text-white/40" />, value: profile.stats.objects_registered, label: 'Objetos\nregistrados' },
            { icon: <CheckCircle2 className="w-4 h-4 text-green-400" />, value: profile.stats.objects_returned, label: 'Recuperados\npelo dono' },
            { icon: <CheckCircle2 className="w-4 h-4 text-teal-400" />, value: profile.stats.found_and_returned, label: 'Devolvidos\npor ele' },
          ].map((s, i) => (
            <div key={i} className="bg-white/[0.03] border border-white/[0.07] rounded-xl p-4 text-center">
              <div className="flex justify-center mb-2">{s.icon}</div>
              <p className="text-2xl font-bold text-white">{s.value}</p>
              <p className="text-white/30 text-[10px] mt-1 leading-tight whitespace-pre">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Trust badge */}
        {profile.stats.found_and_returned > 0 && (
          <div className="bg-teal-500/[0.06] border border-teal-500/20 rounded-xl p-4 flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-full bg-teal-500/20 flex items-center justify-center flex-shrink-0">
              <CheckCircle2 className="w-5 h-5 text-teal-400" />
            </div>
            <div>
              <p className="text-teal-300 text-sm font-medium">Usuário confiável</p>
              <p className="text-white/40 text-xs mt-0.5">
                Já devolveu {profile.stats.found_and_returned} objeto{profile.stats.found_and_returned > 1 ? 's' : ''} para seus donos.
              </p>
            </div>
          </div>
        )}

        {/* CTA */}
        <div className="border border-white/[0.06] rounded-xl p-5 text-center">
          <p className="text-white font-medium mb-1">Registre seus objetos no Backfindr</p>
          <p className="text-white/30 text-sm mb-4">QR Code único · IA de matching · Gratuito para sempre</p>
          <Link href="/auth/register"
            className="inline-flex items-center gap-2 bg-teal-500 hover:bg-teal-400 text-white text-sm font-semibold px-6 py-2.5 rounded-lg transition-all"
            style={{ boxShadow: '0 0 0 1px rgba(20,184,166,0.4)' }}>
            Criar conta grátis
          </Link>
        </div>
      </div>
    </div>
  );
}
