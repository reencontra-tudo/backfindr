'use client';

import posthog from 'posthog-js';
import { PostHogProvider as PHProvider } from 'posthog-js/react';
import { useEffect, Suspense } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

// ─── Init ─────────────────────────────────────────────────────────────────────
if (typeof window !== 'undefined' && process.env.NEXT_PUBLIC_POSTHOG_KEY) {
  posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
    api_host:          process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://app.posthog.com',
    capture_pageview:  false, // manual via usePageView
    capture_pageleave: true,
    persistence:       'localStorage',
    autocapture:       true,
    session_recording: { maskAllInputs: true },
  });
}

// ─── Page view tracker ────────────────────────────────────────────────────────
function PageViewTrackerInner() {
  const pathname     = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!pathname) return;
    const url = searchParams.toString() ? `${pathname}?${searchParams}` : pathname;
    posthog.capture('$pageview', { $current_url: window.location.origin + url });
  }, [pathname, searchParams]);

  return null;
}

function PageViewTracker() {
  return (
    <Suspense fallback={null}>
      <PageViewTrackerInner />
    </Suspense>
  );
}

// ─── Provider ─────────────────────────────────────────────────────────────────
export function PostHogProvider({ children }: { children: React.ReactNode }) {
  return (
    <PHProvider client={posthog}>
      <PageViewTracker />
      {children}
    </PHProvider>
  );
}

// ─── Event helpers ────────────────────────────────────────────────────────────
export const analytics = {
  // Auth
  signUp:        (method: string) => posthog.capture('sign_up', { method }),
  login:         (method: string) => posthog.capture('login', { method }),
  logout:        ()               => posthog.capture('logout'),

  // Objetos
  objectCreated: (category: string, status: string) =>
    posthog.capture('object_created', { category, status }),
  objectViewed:  (code: string, category: string) =>
    posthog.capture('object_viewed', { code, category }),
  qrScanned:     (code: string, location?: string) =>
    posthog.capture('qr_scanned', { code, location }),

  // Matches
  matchViewed:   (matchId: string, score: number) =>
    posthog.capture('match_viewed', { match_id: matchId, confidence_score: score }),
  matchConfirmed:(matchId: string) =>
    posthog.capture('match_confirmed', { match_id: matchId }),
  matchRejected: (matchId: string) =>
    posthog.capture('match_rejected', { match_id: matchId }),

  // Chat
  chatOpened:    (matchId: string) => posthog.capture('chat_opened', { match_id: matchId }),
  messageSent:   (matchId: string) => posthog.capture('message_sent', { match_id: matchId }),

  // Conversão
  upgradeClicked:(plan: string, from: string) =>
    posthog.capture('upgrade_clicked', { plan, from_page: from }),
  upgradeSuccess:(plan: string) =>
    posthog.capture('upgrade_success', { plan }),

  // Findr
  findrOpened:   ()               => posthog.capture('findr_opened'),
  findrQuery:    (query: string)  => posthog.capture('findr_query', { query: query.slice(0, 100) }),

  // Fluxos de conversão (/flow/*)
  flowStarted:   (flow: string)              => posthog.capture('flow_started',   { flow }),
  flowStep:      (flow: string, step: number, total: number) =>
    posthog.capture('flow_step',     { flow, step, total }),
  flowCompleted: (flow: string, hasMatches: boolean) =>
    posthog.capture('flow_completed', { flow, has_matches: hasMatches }),
  flowAbandoned: (flow: string, step: number) =>
    posthog.capture('flow_abandoned', { flow, at_step: step }),
  flowMatchClicked: (flow: string, objectCode: string) =>
    posthog.capture('flow_match_clicked', { flow, object_code: objectCode }),

  // Identify
  identify:      (userId: string, props?: Record<string, unknown>) => {
    posthog.identify(userId, props);
  },
  reset:         ()               => posthog.reset(),
};
