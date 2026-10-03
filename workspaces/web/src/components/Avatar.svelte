<script lang="ts">
  import { onMount } from 'svelte';
  import { apiClient } from './clients.ts';
  import { PUBLIC_MINIO_ENDPOINT, PUBLIC_AVATAR_BUCKET } from 'astro:env/client';

  let src = $state('default-avatar.jpg');

  onMount(async () => {
    const { data } = await apiClient.GET('/api/users');

    if (data?.avatarKey) {
      src = `${PUBLIC_MINIO_ENDPOINT}/${PUBLIC_AVATAR_BUCKET}/${data.avatarKey}`;
    }
  });
</script>

<img {src} class="h-8 w-8 sm:h-16 sm:w-16 rounded-full object-cover" alt="avatar" />
