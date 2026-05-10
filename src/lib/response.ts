import { NextResponse } from 'next/server';

export function successResponse(data: any, status = 200) {
  return NextResponse.json(data, { status });
}

export function errorResponse(detail: string, status = 400) {
  return NextResponse.json({ detail }, { status });
}

export function unauthorizedResponse() {
  return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 });
}

export function notFoundResponse() {
  return NextResponse.json({ detail: 'Not found' }, { status: 404 });
}

export function conflictResponse(detail: string) {
  return NextResponse.json({ detail }, { status: 409 });
}

export function internalErrorResponse(error: any) {
  console.error('Internal error:', error);
  return NextResponse.json(
    { detail: error?.message || 'Internal server error' },
    { status: 500 }
  );
}
