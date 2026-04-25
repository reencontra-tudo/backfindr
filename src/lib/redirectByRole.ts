/**
 * Retorna a rota de destino após login com base no role do usuário.
 *
 * Hierarquia:
 *   super_admin → /admin/dashboard
 *   admin       → /admin/dashboard
 *   b2b_admin   → /admin/b2b-portal
 *   user        → /dashboard
 */
export function getPostLoginRedirect(role?: string | null): string {
  switch (role) {
    case 'super_admin':
    case 'admin':
      return '/admin/dashboard';
    case 'b2b_admin':
      return '/admin/b2b-portal';
    default:
      return '/dashboard';
  }
}
