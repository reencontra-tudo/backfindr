export const Colors = {
  brand: {
    50:  '#f0fdf9',
    300: '#5eead4',
    400: '#2dd4bf',
    500: '#14b8a6',
    600: '#0d9488',
    700: '#0f766e',
  },
  surface: {
    DEFAULT: '#0f172a',
    card:    '#1e293b',
    border:  '#334155',
    muted:   '#475569',
  },
  text: {
    primary:   '#f1f5f9',
    secondary: '#94a3b8',
    muted:     '#64748b',
  },
  status: {
    lost:     '#ef4444',
    found:    '#14b8a6',
    returned: '#22c55e',
    stolen:   '#f97316',
  },
  accent: {
    orange: '#f97316',
    yellow: '#eab308',
  },
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const Radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  full: 9999,
};

export const Typography = {
  display: {
    xl:  { fontSize: 32, fontWeight: '800' as const, letterSpacing: -0.5 },
    lg:  { fontSize: 24, fontWeight: '700' as const, letterSpacing: -0.3 },
    md:  { fontSize: 20, fontWeight: '700' as const },
    sm:  { fontSize: 16, fontWeight: '600' as const },
  },
  body: {
    lg:  { fontSize: 16, fontWeight: '400' as const, lineHeight: 24 },
    md:  { fontSize: 14, fontWeight: '400' as const, lineHeight: 21 },
    sm:  { fontSize: 12, fontWeight: '400' as const, lineHeight: 18 },
  },
};
