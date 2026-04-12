import jwt from 'jsonwebtoken';

const SECRET_KEY = process.env.SECRET_KEY || 'backfindr-super-secret-key-2026-production-xyz';
const ALGORITHM = process.env.ALGORITHM || 'HS256';
const ACCESS_TOKEN_EXPIRE_MINUTES = 30;
const REFRESH_TOKEN_EXPIRE_DAYS = 30;

export interface TokenPayload {
  sub: string; // user id
  email: string;
  iat?: number;
  exp?: number;
}

export function createAccessToken(userId: string, email: string): string {
  const payload: TokenPayload = {
    sub: userId,
    email,
  };

  return jwt.sign(payload, SECRET_KEY, {
    algorithm: ALGORITHM as any,
    expiresIn: `${ACCESS_TOKEN_EXPIRE_MINUTES}m`,
  });
}

export function createRefreshToken(userId: string, email: string): string {
  const payload: TokenPayload = {
    sub: userId,
    email,
  };

  return jwt.sign(payload, SECRET_KEY, {
    algorithm: ALGORITHM as any,
    expiresIn: `${REFRESH_TOKEN_EXPIRE_DAYS}d`,
  });
}

export function verifyToken(token: string): TokenPayload | null {
  try {
    const decoded = jwt.verify(token, SECRET_KEY, {
      algorithms: [ALGORITHM as any],
    }) as TokenPayload;
    return decoded;
  } catch (error) {
    console.error('Token verification failed:', error);
    return null;
  }
}

export function extractTokenFromHeader(authHeader: string | null): string | null {
  if (!authHeader) return null;
  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') return null;
  return parts[1];
}
