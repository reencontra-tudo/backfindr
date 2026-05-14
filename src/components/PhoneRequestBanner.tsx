'use client';

import { useState, useEffect } from 'react';
import { Phone, X, CheckCircle2, Loader2 } from 'lucide-react';
import { useAuthStore } from '@/hooks/useAuth';
import { api, parseApiError } from '@/lib/api';
import Cookies from 'js-cookie';

const STORAGE_KEY = 'backfindr_phone_banner_dismissed';

/**
 * PhoneRequestBanner
 *
 * Aparece no dashboard SOMENTE quando:
 *   1. Usuário está vinculado a um condomínio (tem porteiro_condominio_id ou unidade)
 *   2. Não tem telefone cadastrado (comum em login via Google)
 *   3. Não foi dispensado nos últimos 7 dias
 *
 * Objetivo: garantir que moradores recebam alertas de encomendas via WhatsApp.
 */
export default function PhoneRequestBanner() {
  const { user, fetchMe }   = useAuthStore();
  const [show, setShow]     = useState(false);
  const [phone, setPhone]   = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved]   = useState(false);
  const [hasUnidade, setHasUnidade] = useState(false);

  useEffect(() => {
    // Não mostrar se já tem telefone
    if (user?.phone) return;

    // Verificar se foi dispensado recentemente
    const dismissed = localStorage.getItem(STORAGE_KEY);
    if (dismissed) {
      const dismissedAt = parseInt(dismissed, 10);
      const sevenDays   = 7 * 24 * 60 * 60 * 1000;
      if (Date.now() - dismissedAt < sevenDays) return;
    }

    // Verificar se é morador de condomínio
    async function checkCondominio() {
      try {
        await api.get('/portaria/minha-unidade');
        setHasUnidade(true);
        setShow(true);
      } catch {
        // Sem unidade vinculada — não exibe
      }
    }

    checkCondominio();
  }, [user]);

  if (!show || !hasUnidade) return null;

  const handleDismiss = () => {
    localStorage.setItem(STORAGE_KEY, String(Date.now()));
    setShow(false);
  };

  const handleSave = async () => {
    const digits = phone.replace(/\D/g, '');
    if (digits.length < 10) return;

    setSaving(true);
    try {
      await api.patch('/users/me', { phone });
      await fetchMe(); // atualiza o store
      setSaved(true);
      setTimeout(() => setShow(false), 2000);
    } catch (e) {
      // toast já aparece via interceptor — não duplicar
      console.error(parseApiError(e));
    } finally {
      setSaving(false);
    }
  };

  // Tela de sucesso
  if (saved) return (
    <div className="mb-6 flex items-center gap-3 bg-teal-500/10 border border-teal-500/20 rounded-xl px-4 py-3">
      <CheckCircle2 className="w-4 h-4 text-teal-400 flex-shrink-0" />
      <p className="text-teal-300 text-sm font-semibold">
        WhatsApp salvo! Você receberá alertas de encomendas.
      </p>
    </div>
  );

  return (
    <div className="mb-6 bg-white/[0.03] border border-white/[0.08] rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 px-4 pt-4 pb-3">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-xl bg-[#25D366]/10 flex items-center justify-center flex-shrink-0 mt-0.5">
            <Phone className="w-4 h-4 text-[#25D366]" />
          </div>
          <div>
            <p className="text-white text-sm font-semibold">
              Adicione seu WhatsApp
            </p>
            <p className="text-white/40 text-xs mt-0.5 leading-relaxed">
              Seu condomínio usa o Backfindr Portaria. Adicione seu número para receber alertas quando encomendas chegarem.
            </p>
          </div>
        </div>
        <button
          onClick={handleDismiss}
          className="text-white/20 hover:text-white/50 transition-colors flex-shrink-0 mt-0.5"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Input + botão */}
      <div className="flex gap-2 px-4 pb-4">
        <input
          type="tel"
          value={phone}
          onChange={e => setPhone(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSave()}
          placeholder="(11) 99999-9999"
          className="flex-1 px-3 py-2.5 bg-white/[0.04] border border-white/[0.08] rounded-xl text-white text-sm placeholder-white/20 focus:outline-none focus:border-[#25D366]/40"
        />
        <button
          onClick={handleSave}
          disabled={saving || phone.replace(/\D/g, '').length < 10}
          className="px-4 py-2.5 bg-[#25D366] hover:bg-[#1ebe5d] disabled:bg-[#25D366]/40 rounded-xl text-white text-sm font-bold transition-colors flex items-center gap-1.5 flex-shrink-0"
        >
          {saving
            ? <Loader2 className="w-4 h-4 animate-spin" />
            : 'Salvar'}
        </button>
      </div>

      {/* Nota de privacidade */}
      <div className="px-4 pb-3">
        <p className="text-white/20 text-xs">
          Usado apenas para alertas do seu condomínio. Nunca compartilhado.
        </p>
      </div>
    </div>
  );
}
