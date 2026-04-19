'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Bell, Zap, MessageCircle, CheckCircle2,
  QrCode, Check, Trash2
} from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { api, parseApiError } from '@/lib/api';
import { usePushNotifications } from '@/hooks/usePushNotifications';

type NotifType = 'match' | 'scan' | 'message' | 'returned' | 'system';

interface Notification {
  id: string;
  type: NotifType;
  title: string;
  message: string;
  read: boolean;
  url?: string;
  created_at: string;
}

const NOTIF_ICON: Record<NotifType, React.ReactNode> = {
  match:    <Zap className="w-4 h-4 text-brand-400" />,
  scan:     <QrCode className="w-4 h-4 text-green-400" />,
  message:  <MessageCircle className="w-4 h-4 text-blue-400" />,
  returned: <CheckCircle2 className="w-4 h-4 text-green-400" />,
  system:   <Bell className="w-4 h-4 text-slate-400" />,
};

const NOTIF_BG: Record<NotifType, string> = {
  match:    'bg-brand-500/10',
  scan:     'bg-green-500/10',
  message:  'bg-blue-500/10',
  returned: 'bg-green-500/10',
  system:   'bg-surface-border',
};

export default function NotificationsPage() {
  const router = useRouter();
  const { register } = usePushNotifications();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [pushEnabled, setPushEnabled] = useState(false);

  useEffect(() => {
    // Check push permission
    if ('Notification' in window) {
      setPushEnabled(Notification.permission === 'granted');
    }

    api.get('/notifications')
      .then(({ data }) => setNotifications(data?.notifications ?? []))
      .catch((err) => toast.error(parseApiError(err)))
      .finally(() => setLoading(false));
  }, []);

  const markRead = async (id: string) => {
    try {
      await api.patch(`/notifications/${id}`);
      setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, read: true } : n));
    } catch {}
  };

  const markAllRead = async () => {
    try {
      await api.post('/notifications/read-all');
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      toast.success('Todas marcadas como lidas');
    } catch (err) {
      toast.error(parseApiError(err));
    }
  };

  const deleteNotif = async (id: string) => {
    try {
      await api.delete(`/notifications/${id}`);
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    } catch {}
  };

  const handleClick = (notif: Notification) => {
    if (!notif.read) markRead(notif.id);
    if (notif.url) router.push(notif.url);
  };

  const enablePush = async () => {
    await register();
    setPushEnabled(Notification.permission === 'granted');
    if (Notification.permission === 'granted') {
      toast.success('Notificações push ativadas!');
    }
  };

  const unread = notifications.filter((n) => !n.read).length;

  return (
    <div className="p-8 max-w-2xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-2xl font-bold text-white flex items-center gap-2">
            Notificações
            {unread > 0 && (
              <span className="bg-brand-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                {unread}
              </span>
            )}
          </h1>
          <p className="text-slate-400 text-sm mt-0.5">Atualizações dos seus objetos registrados</p>
        </div>
        {unread > 0 && (
          <button
            onClick={markAllRead}
            className="flex items-center gap-1.5 text-xs text-brand-400 hover:text-brand-300 transition-colors"
          >
            <Check className="w-3.5 h-3.5" />
            Marcar todas como lidas
          </button>
        )}
      </div>

      {/* Push notification CTA */}
      {!pushEnabled && 'Notification' in window && Notification.permission !== 'denied' && (
        <div className="glass rounded-xl p-4 mb-6 flex items-center gap-4 border-brand-500/20">
          <div className="w-10 h-10 rounded-xl bg-brand-500/10 flex items-center justify-center flex-shrink-0">
            <Bell className="w-5 h-5 text-brand-400" />
          </div>
          <div className="flex-1">
            <p className="text-white text-sm font-medium">Ativar notificações push</p>
            <p className="text-slate-400 text-xs">Seja notificado imediatamente quando seu objeto for encontrado.</p>
          </div>
          <button
            onClick={enablePush}
            className="bg-brand-500 hover:bg-brand-400 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-all flex-shrink-0"
          >
            Ativar
          </button>
        </div>
      )}

      {/* List */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-20 bg-surface-card rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : notifications.length === 0 ? (
        <div className="text-center py-20">
          <Bell className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <p className="font-display font-semibold text-white mb-1">Nenhuma notificação</p>
          <p className="text-slate-500 text-sm">Você será notificado quando seus objetos tiverem atualizações.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {notifications.map((notif) => (
            <div
              key={notif.id}
              onClick={() => handleClick(notif)}
              className={`flex items-start gap-4 p-4 rounded-2xl border transition-all cursor-pointer group ${
                notif.read
                  ? 'glass border-transparent hover:border-surface-border'
                  : 'bg-brand-500/5 border-brand-500/20 hover:border-brand-500/40'
              }`}
            >
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${NOTIF_BG[notif.type]}`}>
                {NOTIF_ICON[notif.type]}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <p className={`text-sm font-medium ${notif.read ? 'text-slate-300' : 'text-white'}`}>
                    {notif.title}
                  </p>
                  {!notif.read && (
                    <div className="w-2 h-2 bg-brand-500 rounded-full flex-shrink-0 mt-1" />
                  )}
                </div>
                <p className="text-slate-400 text-xs mt-0.5 leading-relaxed">{notif.message}</p>
                <p className="text-slate-600 text-xs mt-1">
                  {formatDistanceToNow(new Date(notif.created_at), { addSuffix: true, locale: ptBR })}
                </p>
              </div>

              <button
                onClick={(e) => { e.stopPropagation(); deleteNotif(notif.id); }}
                className="opacity-0 group-hover:opacity-100 text-slate-600 hover:text-red-400 transition-all flex-shrink-0"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
