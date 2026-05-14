'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { Loader2, User, Bell, Shield, Trash2, Check, ChevronRight } from 'lucide-react';
import { useAuthStore } from '@/hooks/useAuth';
import { api, parseApiError } from '@/lib/api';
import { usePushNotifications } from '@/hooks/usePushNotifications';

type ProfileForm = { name: string; phone: string };

const inputClass = 'w-full bg-white/[0.03] border border-white/[0.07] rounded-lg px-3.5 py-2.5 text-white placeholder-white/20 text-sm outline-none focus:border-teal-500/50 focus:bg-white/[0.05] transition-all';

export default function SettingsPage() {
  const { user, fetchMe } = useAuthStore();
  const { register: registerPush, unregister } = usePushNotifications();
  const [saving, setSaving] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [activeTab, setActiveTab] = useState<'profile'|'security'|'notifications'|'danger'>('profile');

  const { register, handleSubmit, reset, formState: { isDirty } } = useForm<ProfileForm>();

  useEffect(() => {
    if (user) reset({ name: user.name, phone: user.phone ?? '' });
    if ('Notification' in window) setPushEnabled(Notification.permission === 'granted');
  }, [user, reset]);

  const onSaveProfile = async (data: ProfileForm) => {
    setSaving(true);
    try {
      await api.patch('/users/me', data);
      await fetchMe();
      toast.success('Perfil atualizado');
    } catch (e) { toast.error(parseApiError(e)); }
    finally { setSaving(false); }
  };

  const enablePush = async () => {
    await registerPush();
    setPushEnabled(Notification.permission === 'granted');
    if (Notification.permission === 'granted') toast.success('Notificações ativadas!');
  };

  const tabs = [
    { id: 'profile', label: 'Perfil', icon: <User className="w-4 h-4" /> },
    { id: 'security', label: 'Segurança', icon: <Shield className="w-4 h-4" /> },
    { id: 'notifications', label: 'Notificações', icon: <Bell className="w-4 h-4" /> },
    { id: 'danger', label: 'Conta', icon: <Trash2 className="w-4 h-4" /> },
  ] as const;

  return (
    <div className="p-8 max-w-2xl">
      <div className="mb-8">
        <h1 className="font-display text-2xl font-bold text-white">Configurações</h1>
        <p className="text-white/40 text-sm mt-0.5">Gerencie seu perfil e preferências</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-8 p-1 bg-white/[0.03] border border-white/[0.07] rounded-xl w-fit">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === t.id
                ? 'bg-white/[0.08] text-white'
                : 'text-white/40 hover:text-white/70'
            }`}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* Profile tab */}
      {activeTab === 'profile' && (
        <form onSubmit={handleSubmit(onSaveProfile)} className="space-y-6">
          {/* Avatar */}
          <div className="flex items-center gap-4 p-5 bg-white/[0.02] border border-white/[0.07] rounded-xl">
            <div className="w-14 h-14 rounded-full bg-teal-500 flex items-center justify-center text-white font-bold text-xl flex-shrink-0">
              {user?.name?.[0]?.toUpperCase() ?? '?'}
            </div>
            <div>
              <p className="text-white font-medium">{user?.name}</p>
              <p className="text-white/40 text-sm">{user?.email}</p>
              <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full mt-1 ${user?.plan === 'pro' ? 'bg-teal-500/10 text-teal-400 border border-teal-500/20' : 'bg-white/[0.05] text-white/40 border border-white/[0.08]'}`}>
                {user?.plan === 'pro' ? '⭐ Pro' : 'Gratuito'}
              </span>
            </div>
          </div>

          <div className="space-y-4 p-5 bg-white/[0.02] border border-white/[0.07] rounded-xl">
            <h3 className="text-white font-medium text-sm">Informações pessoais</h3>
            <div>
              <label className="block text-[13px] text-white/50 mb-1.5">Nome completo</label>
              <input {...register('name')} className={inputClass} />
            </div>
            <div>
              <label className="block text-[13px] text-white/50 mb-1.5">Telefone</label>
              <input {...register('phone')} placeholder="+55 11 99999-9999" className={inputClass} />
            </div>
            <div>
              <label className="block text-[13px] text-white/50 mb-1.5">E-mail</label>
              <input value={user?.email ?? ''} disabled className={inputClass + ' opacity-40 cursor-not-allowed'} />
              <p className="text-white/20 text-xs mt-1">O e-mail não pode ser alterado.</p>
            </div>
          </div>

          <button
            type="submit"
            disabled={saving || !isDirty}
            className="flex items-center gap-2 bg-teal-500 hover:bg-teal-400 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition-all"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            Salvar alterações
          </button>
        </form>
      )}

      {/* Security tab */}
      {activeTab === 'security' && (
        <div className="space-y-4">
          <div className="p-5 bg-white/[0.02] border border-white/[0.07] rounded-xl">
            <h3 className="text-white font-medium text-sm mb-4">Alterar senha</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-[13px] text-white/50 mb-1.5">Senha atual</label>
                <input type="password" placeholder="••••••••" className={inputClass} />
              </div>
              <div>
                <label className="block text-[13px] text-white/50 mb-1.5">Nova senha</label>
                <input type="password" placeholder="Mínimo 8 caracteres" className={inputClass} />
              </div>
              <div>
                <label className="block text-[13px] text-white/50 mb-1.5">Confirmar nova senha</label>
                <input type="password" placeholder="••••••••" className={inputClass} />
              </div>
              <button
                onClick={() => toast.info('Em breve disponível')}
                className="flex items-center gap-2 bg-teal-500 hover:bg-teal-400 text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition-all mt-2"
              >
                Alterar senha
              </button>
            </div>
          </div>

          <div className="p-5 bg-white/[0.02] border border-white/[0.07] rounded-xl">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white text-sm font-medium">Login com Google</p>
                <p className="text-white/40 text-xs mt-0.5">Conecte sua conta Google para login mais rápido</p>
              </div>
              <button
                onClick={() => window.location.href = '/api/auth/google'}
                className="flex items-center gap-2 border border-white/[0.08] bg-white/[0.04] hover:bg-white/[0.07] text-white/70 text-xs px-3 py-2 rounded-lg transition-all"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Conectar Google
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Notifications tab */}
      {activeTab === 'notifications' && (
        <div className="space-y-4">

          {/* Card principal de ativação */}
          <div className={`p-5 rounded-xl border transition-all ${
            pushEnabled
              ? 'bg-teal-500/[0.06] border-teal-500/20'
              : 'bg-white/[0.02] border-white/[0.07]'
          }`}>
            <div className="flex items-start gap-4">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                pushEnabled ? 'bg-teal-500/20' : 'bg-white/[0.06]'
              }`}>
                <Bell className={`w-5 h-5 ${pushEnabled ? 'text-teal-400' : 'text-white/40'}`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-3 mb-1">
                  <p className="text-white text-sm font-semibold">Notificações push</p>
                  <button
                    onClick={pushEnabled
                      ? () => { unregister(); setPushEnabled(false); toast.success('Notificações desativadas'); }
                      : enablePush
                    }
                    className={`flex-shrink-0 px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      pushEnabled
                        ? 'bg-teal-500/10 text-teal-400 border border-teal-500/30 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/30'
                        : 'bg-teal-500 hover:bg-teal-400 text-white'
                    }`}
                    style={!pushEnabled ? { boxShadow: '0 0 12px rgba(20,184,166,0.25)' } : {}}
                  >
                    {pushEnabled ? '✓ Ativo — clique para desativar' : 'Ativar notificações'}
                  </button>
                </div>
                <p className="text-white/40 text-xs">
                  {pushEnabled
                    ? 'Você será notificado em tempo real sobre matches, scans e mensagens.'
                    : 'Receba alertas instantâneos mesmo com o app em segundo plano.'}
                </p>
                {!pushEnabled && typeof window !== 'undefined' && !('PushManager' in window) && (
                  <div className="mt-3 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                    <p className="text-yellow-400 text-xs font-medium mb-1">📱 No iPhone/iPad</p>
                    <p className="text-yellow-400/70 text-xs">
                      Para receber notificações no iOS, adicione o Backfindr à tela inicial:
                      toque em <strong>Compartilhar</strong> → <strong>Adicionar à Tela de Início</strong>.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Eventos configuráveis */}
          <div className="space-y-2">
            <p className="text-white/30 text-xs font-semibold uppercase tracking-wider px-1 mb-3">Quando notificar</p>
            {[
              { label: 'Match encontrado pela IA', desc: 'Quando a IA encontrar um possível par para seu objeto', icon: '🔍', on: true },
              { label: 'QR Code escaneado', desc: 'Quando alguém escanear o QR Code do seu objeto', icon: '📱', on: true },
              { label: 'Nova mensagem no chat', desc: 'Novas mensagens de quem encontrou seu objeto', icon: '💬', on: true },
              { label: 'Objeto recuperado', desc: 'Confirmação de recuperação bem-sucedida', icon: '✅', on: true },
            ].map(item => (
              <div key={item.label} className="flex items-center justify-between p-4 bg-white/[0.02] border border-white/[0.07] rounded-xl">
                <div className="flex items-center gap-3">
                  <span className="text-lg">{item.icon}</span>
                  <div>
                    <p className="text-white text-sm">{item.label}</p>
                    <p className="text-white/30 text-xs mt-0.5">{item.desc}</p>
                  </div>
                </div>
                <div
                  className={`w-10 h-5 rounded-full relative cursor-pointer transition-all ${
                    item.on && pushEnabled ? 'bg-teal-500' : 'bg-white/[0.08]'
                  }`}
                  onClick={() => !pushEnabled && toast.info('Ative as notificações push primeiro')}
                >
                  <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${
                    item.on && pushEnabled ? 'left-5' : 'left-0.5'
                  }`} />
                </div>
              </div>
            ))}
          </div>

          {/* Dica de instalação PWA */}
          <div className="p-4 bg-white/[0.02] border border-white/[0.06] rounded-xl">
            <p className="text-white/40 text-xs font-semibold uppercase tracking-wider mb-2">Dica</p>
            <p className="text-white/30 text-xs leading-relaxed">
              Para a melhor experiência, adicione o Backfindr à tela inicial do seu celular.
              Isso permite receber notificações push nativas e acessar o app sem abrir o navegador.
            </p>
          </div>
        </div>
      )}

      {/* Danger zone */}
      {activeTab === 'danger' && (
        <div className="space-y-4">
          <div className="p-5 bg-white/[0.02] border border-white/[0.07] rounded-xl">
            <h3 className="text-white font-medium text-sm mb-2">Exportar dados</h3>
            <p className="text-white/40 text-sm mb-4">Baixe todos os seus dados em formato JSON.</p>
            <button onClick={() => toast.info('Em breve disponível')} className="flex items-center gap-2 border border-white/[0.08] text-white/60 hover:text-white text-sm px-4 py-2 rounded-lg transition-all">
              Exportar dados
            </button>
          </div>

          <div className="p-5 bg-red-500/[0.04] border border-red-500/20 rounded-xl">
            <h3 className="text-red-400 font-medium text-sm mb-2">Zona de perigo</h3>
            <p className="text-white/40 text-sm mb-4">
              Ao excluir sua conta, todos os objetos registrados e histórico serão permanentemente removidos. Esta ação não pode ser desfeita.
            </p>
            <button
              onClick={() => {
                if (confirm('Tem certeza? Esta ação é IRREVERSÍVEL.')) {
                  toast.error('Em breve disponível. Entre em contato pelo suporte.');
                }
              }}
              className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 text-sm px-4 py-2 rounded-lg transition-all"
            >
              <Trash2 className="w-4 h-4" /> Excluir minha conta
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
