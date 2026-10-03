<script lang="ts">
  import { PUBLIC_MINIO_ENDPOINT, PUBLIC_AVATAR_BUCKET } from 'astro:env/client';

  interface Props {
    avatarKey: string | null;
  }

  const { avatarKey }: Props = $props();
</script>

<img
  alt="avatar"
  class="h-8 w-8 sm:h-16 sm:w-16 rounded-full object-cover"
  src={avatarKey ?  `${PUBLIC_MINIO_ENDPOINT}/${PUBLIC_AVATAR_BUCKET}/${avatarKey}` : 'default-avatar.jpg'}
/>
