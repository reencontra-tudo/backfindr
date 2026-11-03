import type { Channel } from './types';

// SMS não existe e não é usado por ora: fica registrado como DESLIGADO para uso futuro. Ligar exige mudar
// esta configuração e escrever um adaptador real; enquanto isso, qualquer tentativa é recusada sem custo.
export const CHANNEL_ENABLED: Readonly<Record<Channel, boolean>> = {
  app: true,
  push: true,
  email: true,
  sms: false,
};
