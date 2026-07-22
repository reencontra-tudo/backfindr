'use client';

import { lazy, Suspense, useEffect, useRef, useState } from 'react';

const HomeLiveMap = lazy(() => import('@/components/HomeLiveMap'));

export default function DeferredHomeLiveMap() {
  const ref = useRef<HTMLDivElement>(null);
  const [shouldLoad, setShouldLoad] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShouldLoad(true);
          observer.disconnect();
        }
      },
      { rootMargin: '300px' }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} className="min-h-[360px]">
      {shouldLoad ? (
        <Suspense
          fallback={
            <div className="flex min-h-[360px] items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.03] text-sm text-white/40">
              Carregando mapa...
            </div>
          }
        >
          <HomeLiveMap />
        </Suspense>
      ) : (
        <div className="min-h-[360px] rounded-2xl border border-white/[0.08] bg-white/[0.03]" />
      )}
    </div>
  );
}
