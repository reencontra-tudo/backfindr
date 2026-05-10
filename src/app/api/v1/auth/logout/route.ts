export const dynamic = 'force-dynamic';
import { NextRequest } from 'next/server';
import { successResponse, internalErrorResponse } from '@/lib/response';

export async function POST(request: NextRequest) {
  try {
    // Logout é apenas no frontend (remover tokens dos cookies)
    // Backend apenas confirma a operação
    return successResponse({ message: 'Logged out successfully' });
  } catch (error) {
    return internalErrorResponse(error);
  }
}
