// Som curto com o app ABERTO (versão web), gerado por Web Audio API (sem arquivo de áudio).
// O som comum é o já existente (notificationSound.ts); o urgente tem um toque próprio, mais longo.
// Preferência por aparelho, em localStorage: ligada por padrão; qualquer falha de storage conta como ligada.
// Não vale com o app fechado: nesse caso o som é o padrão do sistema.
import { playNotificationSound } from '@/lib/notificationSound';

export const PUSH_SOUND_KEY = 'backfindr_push_sound';

let lastPushSoundAt = 0;
/** true se um som de push tocou há pouco (evita repetir o som quando a lista de notificações atualizar). */
export function pushSoundPlayedRecently(now: number = Date.now()): boolean {
  return now - lastPushSoundAt < 60_000;
}

export function isPushSoundEnabled(): boolean {
  try {
    return window.localStorage.getItem(PUSH_SOUND_KEY) !== 'off';
  } catch {
    return true;
  }
}

export function setPushSoundEnabled(enabled: boolean): void {
  try {
    window.localStorage.setItem(PUSH_SOUND_KEY, enabled ? 'on' : 'off');
  } catch {
    /* sem storage: a escolha vale só até recarregar */
  }
}

/** Toca o som do aviso: o comum de sempre, ou três toques se urgente. Falha em silêncio (autoplay bloqueado, sem suporte). */
export function playPushSound(urgent = false): void {
  if (!urgent) { playNotificationSound(); return; }
  try {
    const Ctx = (window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext });
    const AC = Ctx.AudioContext ?? Ctx.webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    if (ctx.state === 'suspended') {
      // Reprodução automática bloqueada: tenta retomar; se não deixar, fica em silêncio.
      ctx.resume().catch(() => { try { ctx.close(); } catch { /* ignora */ } });
    }
    const freqs = [880, 660, 880];
    const t0 = ctx.currentTime;
    freqs.forEach((f, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = f;
      const start = t0 + i * 0.16;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.15, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.14);
      osc.connect(gain).connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.15);
    });
    setTimeout(() => { try { ctx.close(); } catch { /* ignora */ } }, freqs.length * 160 + 300);
  } catch {
    /* silêncio */
  }
}

/** Trata uma mensagem vinda do service worker. Só toca com a página visível e a preferência ligada. */
export function handlePushMessage(data: unknown, visible: boolean = typeof document !== 'undefined' && document.visibilityState === 'visible'): boolean {
  const d = data as { type?: unknown; urgent?: unknown } | null;
  if (!d || d.type !== 'push-received' || !visible) return false;
  if (!isPushSoundEnabled()) return false;
  lastPushSoundAt = Date.now();
  playPushSound(d.urgent === true);
  return true;
}
