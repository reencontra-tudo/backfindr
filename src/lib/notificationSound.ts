/**
 * notificationSound.ts
 * Toca um som curto e discreto quando uma notificação nova chega enquanto o
 * dono está com o dashboard aberto (item 6 do fechamento do ciclo de
 * "encontrei", 22/08/2026). Sintetizado via Web Audio API — sem depender de
 * um arquivo de áudio externo, então não precisa de asset novo nem de rota
 * de estáticos pra manter.
 */
export function playNotificationSound() {
  if (typeof window === 'undefined') return;
  try {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();

    // Dois tons curtos ascendentes — reconhecível como notificação positiva,
    // sem ser agressivo o suficiente pra assustar quem está numa reunião.
    const playTone = (freq: number, startOffset: number, duration: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      osc.connect(gain);
      gain.connect(ctx.destination);

      const startTime = ctx.currentTime + startOffset;
      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(0.18, startTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

      osc.start(startTime);
      osc.stop(startTime + duration + 0.02);
    };

    playTone(880, 0, 0.14);
    playTone(1318.5, 0.12, 0.18);

    // Fecha o contexto depois que os tons terminam, pra não deixar handles
    // de áudio abertos acumulando a cada notificação.
    setTimeout(() => ctx.close().catch(() => {}), 500);
  } catch {
    // Autoplay bloqueado ou API indisponível — falha silenciosa, o toast e
    // o badge continuam funcionando normalmente sem o som.
  }
}
