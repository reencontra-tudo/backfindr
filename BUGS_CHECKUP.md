# Bugs encontrados no checkup

## 1. Cadastro - confirmPassword não registrado no RHF (CRÍTICO)
- **Arquivo:** `src/app/auth/register/page.tsx`
- **Problema:** Campo `confirmPassword` usava estado local `confirmValue` separado do RHF, então o Zod nunca recebia o valor → validação sempre falha → formulário nunca submete
- **Correção:** Removidos `confirmValue` e `confirmTouched`, campo usa apenas `{...register('confirmPassword')}`
- **Status:** CORRIGIDO

## 2. Matches - frontend chama /matches/[id]/confirm mas backend espera POST /matches/[id] com body {action}
- **Arquivo:** `src/lib/api.ts` (matchesApi.confirm e matchesApi.reject)
- **Problema:** `matchesApi.confirm(id)` chama `POST /matches/${id}/confirm` mas o backend só tem `POST /matches/${id}` com `{ action: 'confirm' }`
- **Correção:** Alterar matchesApi para enviar body correto

## 3. Matches - frontend usa data?.items mas backend retorna data?.matches
- **Arquivos:** `src/app/dashboard/matches/page.tsx`, `src/app/dashboard/page.tsx`, `src/app/dashboard/chat/[matchId]/page.tsx`
- **Problema:** Backend retorna `{ matches: [...] }` mas frontend lê `data?.items`
- **Correção:** Alterar frontend para usar `data?.matches`

## 4. Notificações - frontend usa data?.items mas backend retorna data?.notifications
- **Arquivo:** `src/app/dashboard/notifications/page.tsx`
- **Problema:** Backend retorna `{ notifications: [...] }` mas frontend lê `data?.items`
- **Correção:** Alterar frontend para usar `data?.notifications`

## 5. Notificações - frontend usa notif.body mas backend retorna notif.message
- **Arquivo:** `src/app/dashboard/notifications/page.tsx`
- **Problema:** Backend retorna campo `message`, frontend renderiza `notif.body`
- **Correção:** Alterar frontend para usar `notif.message`

## 6. Notificações - frontend chama PATCH /notifications/[id]/read mas backend é PATCH /notifications/[id]
- **Arquivo:** `src/app/dashboard/notifications/page.tsx`
- **Problema:** `api.patch('/notifications/${id}/read')` → 404 porque a rota é `/notifications/${id}`
- **Correção:** Remover o `/read` do path

## 7. Chat - frontend usa data?.items mas backend retorna data?.messages
- **Arquivo:** `src/app/dashboard/chat/[matchId]/page.tsx`
- **Problema:** Backend retorna `{ messages: [...] }` mas frontend lê `data?.items`
- **Correção:** Alterar frontend para usar `data?.messages`

## 8. Chat - frontend de matches usa data?.items mas backend retorna data?.matches
- **Arquivo:** `src/app/dashboard/chat/[matchId]/page.tsx`
- **Problema:** `matchesApi.list()` → `data?.items` mas backend retorna `data?.matches`
- **Correção:** Alterar para `data?.matches`
