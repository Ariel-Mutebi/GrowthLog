import type { paths } from '@growthlog/api';
import { apiClient } from './clients.ts';
import { navigate } from 'astro:transitions/client';

export type User = paths['/api/users']['get']['responses']['200']['content']['application/json'];

let pending: Promise<User> | undefined;

async function fetchUser(): Promise<User> {
  try {
    const { data } = await apiClient.GET('/api/users');
    if (data) return data;
  } catch {
    // network error: treat as not logged in
  }
  await navigate('/login');
  throw new Error('Not logged in');
}

export function getCurrentUser(): Promise<User> {
  if (!pending) {
    pending = fetchUser();
    // If it fails, forget it so the next call can retry
    pending.catch(() => {
      pending = undefined;
    });
  }
  return pending;
}
