'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/hooks/useAuth';
import {
  Users, UserPlus, Shield, ShieldCheck, ShieldAlert,
  Mail, Trash2, Edit2, Check, X, Clock, Crown,
  Eye, BarChart2, Settings, Database, MessageSquare,
  DollarSign, FileText, Building2, ChevronDown, ChevronUp,
  RefreshCw, AlertTriangle
} from 'lucide-react';

// ── Tipos ─────────────────────────────────────────────────────────────────────
type Role = 'super_admin' | 'admin' | 'b2b_admin' | 'user';

interface Permission {
  key: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  group: string;
}

interface TeamMember {
  id: string;
  name: string;
  email: string;
  avatar_url?: string;
  role: Role;
  admin_permissions?: Record<string, boolean> | null;
  is_active: boolean;
  created_at: string;
  objects_count: number;
}

interface PendingInvite {
  id: string;
  email: string;
  role: Role;
  permissions?: Record<string, boolean> | null;
  expires_at: string;
  created_at: string;
  invited_by_name?: string;
}

// ── Permissões disponíveis ────────────────────────────────────────────────────
const ALL_PERMISSIONS: Permission[] = [
  // Dashboard
  { key: 'view_dashboard', label: 'Ver Dashboard', description: 'Acesso ao painel principal com KPIs e gráficos', icon: <BarChart2 size={14} />, group: 'Dashboard' },
  // Usuários
  { key: 'view_users', label: 'Ver Usuários', description: 'Listar e visualizar perfis de usuários', icon: <Users size={14} />, group: 'Usuários' },
  { key: 'edit_users', label: 'Editar Usuários', description: 'Alterar plano, status e dados de usuários', icon: <Edit2 size={14} />, group: 'Usuários' },
  { key: 'ban_users', label: 'Banir Usuários', description: 'Suspender ou banir contas de usuários', icon: <ShieldAlert size={14} />, group: 'Usuários' },
  // Objetos
  { key: 'view_objects', label: 'Ver Objetos', description: 'Listar e visualizar objetos cadastrados', icon: <Eye size={14} />, group: 'Objetos' },
  { key: 'edit_objects', label: 'Editar Objetos', description: 'Alterar status e dados de objetos', icon: <Edit2 size={14} />, group: 'Objetos' },
  { key: 'delete_objects', label: 'Excluir Objetos', description: 'Remover objetos da plataforma', icon: <Trash2 size={14} />, group: 'Objetos' },
  // Matches
  { key: 'view_matches', label: 'Ver Matches', description: 'Visualizar e gerenciar cruzamentos de objetos', icon: <Check size={14} />, group: 'Matches' },
  { key: 'manage_matches', label: 'Gerenciar Matches', description: 'Confirmar, rejeitar e rodar matching por IA', icon: <RefreshCw size={14} />, group: 'Matches' },
  // Moderação
  { key: 'view_reports', label: 'Ver Denúncias', description: 'Visualizar denúncias de conteúdo', icon: <AlertTriangle size={14} />, group: 'Moderação' },
  { key: 'resolve_reports', label: 'Resolver Denúncias', description: 'Tomar ações sobre denúncias (ignorar, remover, banir)', icon: <ShieldCheck size={14} />, group: 'Moderação' },
  // Financeiro
  { key: 'view_financeiro', label: 'Ver Financeiro', description: 'Acesso a MRR, ARR, assinantes e transações', icon: <DollarSign size={14} />, group: 'Financeiro' },
  // E-mails
  { key: 'view_emails', label: 'Ver Campanhas', description: 'Visualizar campanhas de e-mail', icon: <Mail size={14} />, group: 'E-mails' },
  { key: 'send_emails', label: 'Enviar E-mails', description: 'Criar e disparar campanhas de e-mail', icon: <MessageSquare size={14} />, group: 'E-mails' },
  // B2B
  { key: 'view_b2b', label: 'Ver B2B', description: 'Visualizar parceiros B2B', icon: <Building2 size={14} />, group: 'B2B' },
  { key: 'manage_b2b', label: 'Gerenciar B2B', description: 'Cadastrar e editar parceiros B2B', icon: <Building2 size={14} />, group: 'B2B' },
  // Sistema
  { key: 'view_sistema', label: 'Ver Sistema', description: 'Acesso ao painel de saúde do sistema', icon: <Database size={14} />, group: 'Sistema' },
  { key: 'manage_sistema', label: 'Gerenciar Sistema', description: 'Executar migrações, matching e manutenção', icon: <Settings size={14} />, group: 'Sistema' },
  // Equipe
  { key: 'view_equipe', label: 'Ver Equipe', description: 'Visualizar membros da equipe', icon: <Users size={14} />, group: 'Equipe' },
];

const PERMISSION_GROUPS = [...new Set(ALL_PERMISSIONS.map(p => p.group))];

const DEFAULT_ADMIN_PERMISSIONS: Record<string, boolean> = {
  view_dashboard: true,
  view_users: true,
  edit_users: true,
  ban_users: false,
  view_objects: true,
  edit_objects: true,
  delete_objects: false,
  view_matches: true,
  manage_matches: true,
  view_reports: true,
  resolve_reports: true,
  view_financeiro: true,
  view_emails: true,
  send_emails: false,
  view_b2b: true,
  manage_b2b: false,
  view_sistema: false,
  manage_sistema: false,
  view_equipe: true,
};

// ── Helpers ───────────────────────────────────────────────────────────────────
const ROLE_LABELS: Record<Role, string> = {
  super_admin: 'Super Admin',
  admin: 'Colaborador',
  b2b_admin: 'Admin B2B',
  user: 'Usuário',
};

const ROLE_COLORS: Record<Role, string> = {
  super_admin: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
  admin: 'bg-teal-500/20 text-teal-300 border-teal-500/30',
  b2b_admin: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  user: 'bg-white/10 text-white/50 border-white/10',
};

const ROLE_ICONS: Record<Role, React.ReactNode> = {
  super_admin: <Crown size={12} />,
  admin: <Shield size={12} />,
  b2b_admin: <Building2 size={12} />,
  user: <Users size={12} />,
};

function RoleBadge({ role }: { role: Role }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${ROLE_COLORS[role]}`}>
      {ROLE_ICONS[role]}
      {ROLE_LABELS[role]}
    </span>
  );
}

function Avatar({ name, avatar_url }: { name: string; avatar_url?: string }) {
  if (avatar_url) return <img src={avatar_url} alt={name} className="w-9 h-9 rounded-full object-cover" />;
  const initials = name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
  return (
    <div className="w-9 h-9 rounded-full bg-teal-500/20 border border-teal-500/30 flex items-center justify-center text-teal-300 text-xs font-bold">
      {initials}
    </div>
  );
}

// ── Componente de permissões ──────────────────────────────────────────────────
function PermissionsEditor({
  permissions,
  onChange,
  readOnly = false,
}: {
  permissions: Record<string, boolean>;
  onChange?: (p: Record<string, boolean>) => void;
  readOnly?: boolean;
}) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const toggle = (key: string) => {
    if (readOnly || !onChange) return;
    onChange({ ...permissions, [key]: !permissions[key] });
  };

  const toggleGroup = (group: string, value: boolean) => {
    if (readOnly || !onChange) return;
    const keys = ALL_PERMISSIONS.filter(p => p.group === group).map(p => p.key);
    const updated = { ...permissions };
    keys.forEach(k => { updated[k] = value; });
    onChange(updated);
  };

  return (
    <div className="space-y-2">
      {PERMISSION_GROUPS.map(group => {
        const groupPerms = ALL_PERMISSIONS.filter(p => p.group === group);
        const allOn = groupPerms.every(p => permissions[p.key]);
        const someOn = groupPerms.some(p => permissions[p.key]);
        const isOpen = expanded[group];

        return (
          <div key={group} className="border border-white/10 rounded-lg overflow-hidden">
            <button
              onClick={() => setExpanded(prev => ({ ...prev, [group]: !prev[group] }))}
              className="w-full flex items-center justify-between px-3 py-2 bg-white/5 hover:bg-white/8 transition-colors"
            >
              <div className="flex items-center gap-2">
                {!readOnly && (
                  <input
                    type="checkbox"
                    checked={allOn}
                    ref={el => { if (el) el.indeterminate = someOn && !allOn; }}
                    onChange={e => { e.stopPropagation(); toggleGroup(group, e.target.checked); }}
                    onClick={e => e.stopPropagation()}
                    className="accent-teal-400 w-3.5 h-3.5"
                  />
                )}
                <span className="text-white/70 text-xs font-medium">{group}</span>
                <span className="text-white/30 text-xs">
                  {groupPerms.filter(p => permissions[p.key]).length}/{groupPerms.length}
                </span>
              </div>
              {isOpen ? <ChevronUp size={12} className="text-white/30" /> : <ChevronDown size={12} className="text-white/30" />}
            </button>

            {isOpen && (
              <div className="divide-y divide-white/5">
                {groupPerms.map(perm => (
                  <label
                    key={perm.key}
                    className={`flex items-start gap-3 px-3 py-2 ${readOnly ? '' : 'cursor-pointer hover:bg-white/5'} transition-colors`}
                  >
                    {!readOnly && (
                      <input
                        type="checkbox"
                        checked={!!permissions[perm.key]}
                        onChange={() => toggle(perm.key)}
                        className="accent-teal-400 w-3.5 h-3.5 mt-0.5 flex-shrink-0"
                      />
                    )}
                    {readOnly && (
                      <div className={`w-3.5 h-3.5 mt-0.5 flex-shrink-0 rounded-sm flex items-center justify-center ${permissions[perm.key] ? 'bg-teal-500/30 text-teal-400' : 'bg-white/5 text-white/20'}`}>
                        {permissions[perm.key] ? <Check size={9} /> : <X size={9} />}
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-white/50">{perm.icon}</span>
                        <span className={`text-xs font-medium ${permissions[perm.key] ? 'text-white/80' : 'text-white/40'}`}>{perm.label}</span>
                      </div>
                      <p className="text-white/30 text-xs mt-0.5">{perm.description}</p>
                    </div>
                  </label>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Página principal ──────────────────────────────────────────────────────────
export default function EquipePage() {
  const { user } = useAuthStore();
  const authLoading = false;
  const router = useRouter();

  const [members, setMembers] = useState<TeamMember[]>([]);
  const [invites, setInvites] = useState<PendingInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Modal de convite
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<Role>('admin');
  const [invitePerms, setInvitePerms] = useState<Record<string, boolean>>(DEFAULT_ADMIN_PERMISSIONS);
  const [inviting, setInviting] = useState(false);
  const [inviteSuccess, setInviteSuccess] = useState('');

  // Edição de membro
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null);
  const [editRole, setEditRole] = useState<Role>('admin');
  const [editPerms, setEditPerms] = useState<Record<string, boolean>>(DEFAULT_ADMIN_PERMISSIONS);
  const [saving, setSaving] = useState(false);

  // Proteção de rota
  useEffect(() => {
    if (!authLoading && user && user.role !== 'super_admin') {
      router.replace('/admin/dashboard');
    }
  }, [user, authLoading, router]);

  const fetchTeam = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/v1/admin/team', { credentials: 'include' });
      if (!res.ok) throw new Error('Sem permissão');
      const data = await res.json() as { members: TeamMember[]; pending_invites: PendingInvite[] };
      setMembers(data.members ?? []);
      setInvites(data.pending_invites ?? []);
    } catch {
      setError('Não foi possível carregar a equipe.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchTeam(); }, [fetchTeam]);

  const handleInvite = async () => {
    if (!inviteEmail.trim()) return;
    setInviting(true);
    setInviteSuccess('');
    try {
      const res = await fetch('/api/v1/admin/team', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'invite',
          email: inviteEmail.trim(),
          role: inviteRole,
          permissions: inviteRole === 'admin' ? invitePerms : undefined,
        }),
      });
      const data = await res.json() as { ok?: boolean; action?: string };
      if (data.ok) {
        setInviteSuccess(data.action === 'role_updated' ? 'Role atualizado com sucesso!' : 'Convite enviado com sucesso!');
        setInviteEmail('');
        fetchTeam();
        setTimeout(() => { setShowInvite(false); setInviteSuccess(''); }, 2000);
      }
    } catch {
      setError('Erro ao enviar convite.');
    } finally {
      setInviting(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!editingMember) return;
    setSaving(true);
    try {
      await fetch('/api/v1/admin/team', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update_role', user_id: editingMember.id, role: editRole }),
      });
      await fetch('/api/v1/admin/team', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update_permissions', user_id: editingMember.id, permissions: editRole === 'admin' ? editPerms : null }),
      });
      setEditingMember(null);
      fetchTeam();
    } catch {
      setError('Erro ao salvar alterações.');
    } finally {
      setSaving(false);
    }
  };

  const handleRevoke = async (memberId: string, memberName: string) => {
    if (!confirm(`Remover acesso admin de ${memberName}? O usuário continuará com conta normal.`)) return;
    try {
      await fetch('/api/v1/admin/team', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'revoke', user_id: memberId }),
      });
      fetchTeam();
    } catch {
      setError('Erro ao revogar acesso.');
    }
  };

  const handleCancelInvite = async (inviteId: string) => {
    try {
      await fetch('/api/v1/admin/team', {
        method: 'DELETE',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invite_id: inviteId }),
      });
      fetchTeam();
    } catch {
      setError('Erro ao cancelar convite.');
    }
  };

  const openEdit = (member: TeamMember) => {
    setEditingMember(member);
    setEditRole(member.role);
    setEditPerms(member.admin_permissions ?? DEFAULT_ADMIN_PERMISSIONS);
  };

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-2 border-teal-500/30 border-t-teal-400 rounded-full animate-spin" />
      </div>
    );
  }

  if (user?.role !== 'super_admin') return null;

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-10">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Users size={20} className="text-teal-400" />
            Gestão de Equipe
          </h1>
          <p className="text-white/40 text-sm mt-0.5">
            Gerencie colaboradores, roles e permissões de acesso ao painel
          </p>
        </div>
        <button
          onClick={() => { setShowInvite(true); setInviteEmail(''); setInviteRole('admin'); setInvitePerms(DEFAULT_ADMIN_PERMISSIONS); }}
          className="flex items-center gap-2 bg-teal-500 hover:bg-teal-400 text-black font-semibold px-4 py-2 rounded-lg text-sm transition-colors"
        >
          <UserPlus size={15} />
          Adicionar Membro
        </button>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm px-4 py-3 rounded-lg flex items-center gap-2">
          <AlertTriangle size={14} />
          {error}
          <button onClick={() => setError('')} className="ml-auto"><X size={14} /></button>
        </div>
      )}

      {/* Hierarquia de roles */}
      <div className="bg-white/3 border border-white/8 rounded-xl p-4">
        <h2 className="text-white/60 text-xs font-semibold uppercase tracking-wider mb-3">Hierarquia de Acesso</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { role: 'super_admin' as Role, desc: 'Acesso total irrestrito. Pode gerenciar equipe, roles e configurações críticas.' },
            { role: 'admin' as Role, desc: 'Colaborador interno com permissões configuráveis por módulo.' },
            { role: 'b2b_admin' as Role, desc: 'Gestor de parceiro B2B. Acesso restrito ao portal do próprio parceiro.' },
          ].map(({ role, desc }) => (
            <div key={role} className="bg-white/5 border border-white/8 rounded-lg p-3">
              <RoleBadge role={role} />
              <p className="text-white/40 text-xs mt-2">{desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Membros ativos */}
      <div className="bg-white/3 border border-white/8 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-white/8 flex items-center justify-between">
          <h2 className="text-white/80 text-sm font-semibold">
            Membros da Equipe
            <span className="ml-2 text-white/30 font-normal">({members.length})</span>
          </h2>
          <button onClick={fetchTeam} className="text-white/30 hover:text-white/60 transition-colors">
            <RefreshCw size={14} />
          </button>
        </div>

        {members.length === 0 ? (
          <div className="px-4 py-8 text-center text-white/30 text-sm">Nenhum membro encontrado.</div>
        ) : (
          <div className="divide-y divide-white/5">
            {members.map(member => (
              <div key={member.id} className="px-4 py-3 flex items-center gap-3">
                <Avatar name={member.name} avatar_url={member.avatar_url} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-white/90 text-sm font-medium truncate">{member.name}</span>
                    <RoleBadge role={member.role} />
                    {!member.is_active && (
                      <span className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 px-1.5 py-0.5 rounded-full">Inativo</span>
                    )}
                  </div>
                  <p className="text-white/40 text-xs truncate">{member.email}</p>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  {member.role !== 'super_admin' && (
                    <>
                      <button
                        onClick={() => openEdit(member)}
                        className="p-1.5 text-white/30 hover:text-teal-400 hover:bg-teal-500/10 rounded-lg transition-colors"
                        title="Editar permissões"
                      >
                        <Edit2 size={14} />
                      </button>
                      <button
                        onClick={() => handleRevoke(member.id, member.name)}
                        className="p-1.5 text-white/30 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                        title="Revogar acesso"
                      >
                        <Trash2 size={14} />
                      </button>
                    </>
                  )}
                  {member.role === 'super_admin' && (
                    <span className="text-yellow-400/50 text-xs px-2">Você</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Convites pendentes */}
      {invites.length > 0 && (
        <div className="bg-white/3 border border-white/8 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-white/8">
            <h2 className="text-white/80 text-sm font-semibold flex items-center gap-2">
              <Clock size={14} className="text-yellow-400" />
              Convites Pendentes
              <span className="text-white/30 font-normal">({invites.length})</span>
            </h2>
          </div>
          <div className="divide-y divide-white/5">
            {invites.map(invite => (
              <div key={invite.id} className="px-4 py-3 flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center">
                  <Mail size={14} className="text-yellow-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-white/70 text-sm truncate">{invite.email}</span>
                    <RoleBadge role={invite.role} />
                  </div>
                  <p className="text-white/30 text-xs">
                    Expira {new Date(invite.expires_at).toLocaleDateString('pt-BR')}
                    {invite.invited_by_name && ` · Convidado por ${invite.invited_by_name}`}
                  </p>
                </div>
                <button
                  onClick={() => handleCancelInvite(invite.id)}
                  className="p-1.5 text-white/30 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                  title="Cancelar convite"
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal: Adicionar membro */}
      {showInvite && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-[#0d1117] border border-white/10 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-[#0d1117] border-b border-white/8 px-5 py-4 flex items-center justify-between">
              <h3 className="text-white font-semibold flex items-center gap-2">
                <UserPlus size={16} className="text-teal-400" />
                Adicionar Membro
              </h3>
              <button onClick={() => setShowInvite(false)} className="text-white/40 hover:text-white/70">
                <X size={18} />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {inviteSuccess && (
                <div className="bg-teal-500/10 border border-teal-500/30 text-teal-400 text-sm px-4 py-3 rounded-lg flex items-center gap-2">
                  <Check size={14} />
                  {inviteSuccess}
                </div>
              )}

              <div>
                <label className="text-white/60 text-xs font-medium block mb-1.5">E-mail</label>
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={e => setInviteEmail(e.target.value)}
                  placeholder="colaborador@email.com"
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm placeholder-white/20 focus:outline-none focus:border-teal-500/50"
                />
                <p className="text-white/30 text-xs mt-1">
                  Se o usuário já tiver conta, o role será atualizado diretamente. Caso contrário, um convite será enviado.
                </p>
              </div>

              <div>
                <label className="text-white/60 text-xs font-medium block mb-1.5">Role</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['admin', 'b2b_admin'] as Role[]).map(r => (
                    <button
                      key={r}
                      onClick={() => setInviteRole(r)}
                      className={`flex flex-col items-center gap-1.5 p-3 rounded-lg border text-xs font-medium transition-colors ${inviteRole === r ? 'border-teal-500/50 bg-teal-500/10 text-teal-300' : 'border-white/10 bg-white/5 text-white/50 hover:border-white/20'}`}
                    >
                      {ROLE_ICONS[r]}
                      {ROLE_LABELS[r]}
                    </button>
                  ))}
                </div>
              </div>

              {inviteRole === 'admin' && (
                <div>
                  <label className="text-white/60 text-xs font-medium block mb-2">Permissões</label>
                  <PermissionsEditor permissions={invitePerms} onChange={setInvitePerms} />
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowInvite(false)}
                  className="flex-1 py-2.5 rounded-lg border border-white/10 text-white/60 text-sm hover:bg-white/5 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleInvite}
                  disabled={inviting || !inviteEmail.trim()}
                  className="flex-1 py-2.5 rounded-lg bg-teal-500 hover:bg-teal-400 disabled:opacity-40 text-black font-semibold text-sm transition-colors flex items-center justify-center gap-2"
                >
                  {inviting ? <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" /> : <UserPlus size={14} />}
                  {inviting ? 'Enviando...' : 'Adicionar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Editar membro */}
      {editingMember && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-[#0d1117] border border-white/10 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-[#0d1117] border-b border-white/8 px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Avatar name={editingMember.name} avatar_url={editingMember.avatar_url} />
                <div>
                  <h3 className="text-white font-semibold text-sm">{editingMember.name}</h3>
                  <p className="text-white/40 text-xs">{editingMember.email}</p>
                </div>
              </div>
              <button onClick={() => setEditingMember(null)} className="text-white/40 hover:text-white/70">
                <X size={18} />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <label className="text-white/60 text-xs font-medium block mb-1.5">Role</label>
                <div className="grid grid-cols-2 gap-2">
                  {(['admin', 'b2b_admin'] as Role[]).map(r => (
                    <button
                      key={r}
                      onClick={() => setEditRole(r)}
                      className={`flex items-center gap-2 p-3 rounded-lg border text-xs font-medium transition-colors ${editRole === r ? 'border-teal-500/50 bg-teal-500/10 text-teal-300' : 'border-white/10 bg-white/5 text-white/50 hover:border-white/20'}`}
                    >
                      {ROLE_ICONS[r]}
                      {ROLE_LABELS[r]}
                    </button>
                  ))}
                </div>
              </div>

              {editRole === 'admin' && (
                <div>
                  <label className="text-white/60 text-xs font-medium block mb-2">Permissões</label>
                  <PermissionsEditor permissions={editPerms} onChange={setEditPerms} />
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setEditingMember(null)}
                  className="flex-1 py-2.5 rounded-lg border border-white/10 text-white/60 text-sm hover:bg-white/5 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSaveEdit}
                  disabled={saving}
                  className="flex-1 py-2.5 rounded-lg bg-teal-500 hover:bg-teal-400 disabled:opacity-40 text-black font-semibold text-sm transition-colors flex items-center justify-center gap-2"
                >
                  {saving ? <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" /> : <Check size={14} />}
                  {saving ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
