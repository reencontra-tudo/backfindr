export const dynamic = 'force-dynamic';
import { NextRequest } from 'next/server';
import { verifyToken, extractTokenFromHeader } from '@/lib/jwt';
import { successResponse, errorResponse, unauthorizedResponse, internalErrorResponse } from '@/lib/response';
import { ENFORCED_CHANNELS, getPreferences, isEnforcedChannel, isPreferenceEvent, setPreference } from '@/lib/notificationPreferences';

function userIdFrom(request: NextRequest): string | null {
  const token = extractTokenFromHeader(request.headers.get('authorization'));
  if (!token) return null;
  const payload = verifyToken(token);
  return payload ? (payload.sub as string) : null;
}

export async function GET(request: NextRequest) {
  try {
    const userId = userIdFrom(request);
    if (!userId) return unauthorizedResponse();
    return successResponse({ preferences: await getPreferences(userId), editable_channels: ENFORCED_CHANNELS });
  } catch (error) {
    return internalErrorResponse(error);
  }
}

// Corpo: { event, channel, enabled }. Só eventos configuráveis e canais já respeitados; e-mail de
// segurança não é um evento daqui e portanto não pode ser desligado por esta rota.
export async function PUT(request: NextRequest) {
  try {
    const userId = userIdFrom(request);
    if (!userId) return unauthorizedResponse();

    const body = await request.json().catch(() => ({}));
    const { event, channel, enabled } = body as { event?: unknown; channel?: unknown; enabled?: unknown };
    if (!isPreferenceEvent(event) || !isEnforcedChannel(channel) || typeof enabled !== 'boolean') {
      return errorResponse('Preferência inválida', 400);
    }

    try {
      await setPreference(userId, event, channel, enabled);
    } catch (err) {
      console.error('[preferences] gravação falhou:', err);
      return errorResponse('Preferências indisponíveis no momento', 503);
    }
    return successResponse({ event, channel, enabled });
  } catch (error) {
    return internalErrorResponse(error);
  }
}
