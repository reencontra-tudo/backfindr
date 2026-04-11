'use client';

import { useEffect, useCallback } from 'react';
import { notificationsApi } from '@/lib/api';
import { useAuthStore } from './useAuth';

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? '';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const bytes = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) {
    bytes[i] = rawData.charCodeAt(i);
  }
  return bytes;
}

export function usePushNotifications() {
  const { isAuthenticated } = useAuthStore();

  const register = useCallback(async () => {
    if (!isAuthenticated) return;
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
    if (!VAPID_PUBLIC_KEY) return;

    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') return;

      const registration = await navigator.serviceWorker.ready;
      const existing = await registration.pushManager.getSubscription();
      if (existing) return;

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource,
      });

      await notificationsApi.subscribe(subscription.toJSON());
    } catch (err) {
      console.warn('Push registration failed:', err);
    }
  }, [isAuthenticated]);

  const unregister = useCallback(async () => {
    try {
      if (typeof window === 'undefined') return;
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await subscription.unsubscribe();
        await notificationsApi.unsubscribe(subscription.endpoint);
      }
    } catch (err) {
      console.warn('Push unregister failed:', err);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) register();
  }, [isAuthenticated, register]);

  return { register, unregister };
}
