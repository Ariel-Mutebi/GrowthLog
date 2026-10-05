<script lang="ts">
  import { PUBLIC_MINIO_ENDPOINT, PUBLIC_AVATAR_BUCKET } from 'astro:env/client';

  interface Props {
    avatarKey: string | null | undefined;
  }

  const { avatarKey }: Props = $props();
  // svelte-ignore state_referenced_locally
  const src = avatarKey ?
      `${PUBLIC_MINIO_ENDPOINT}/${PUBLIC_AVATAR_BUCKET}/${avatarKey}` :
      'default-avatar.jpg';
</script>

<!-- Don't show an avatar for a user who is not logged in. -->
{#if avatarKey !== undefined}
  <img
    {src}
    alt="avatar"
    class="h-8 w-8 sm:h-16 sm:w-16 rounded-full object-cover"
  />
{/if}
