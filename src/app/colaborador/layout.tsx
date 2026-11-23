import ClarityMask from '@/components/ClarityMask';

// Conteúdo desta área (páginas de colaborador, URL pública `/@nome`) é mascarado no Clarity (ver src/lib/clarity.ts).
export default function Layout({ children }: { children: React.ReactNode }) {
  return <ClarityMask>{children}</ClarityMask>;
}
