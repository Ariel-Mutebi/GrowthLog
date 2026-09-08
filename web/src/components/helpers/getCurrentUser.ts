import { navigate } from 'astro:transitions/client';
import { client } from '../../api/client.ts';

export async function getCurrentUser() {
  const { data, response } = await client.GET('/v1/users');

  if (!data || response.status === 404) {
    navigate('/login');
    return null;
  }

  return data;
}
