<script lang="ts">
  import { navigate } from 'astro:transitions/client';

  interface Props {
    postId: string;
    hasPublished: boolean;
  }

  const { postId, hasPublished }: Props = $props();
</script>

<button
  type="button"
  onclick={() => navigate(`/${postId}/publish`)}
  class="cursor-pointer font-mono text-sm px-2 py-1 text-stone-900 dark:text-yellow-200
    bg-yellow-200 dark:bg-orange-950 inset-shadow-[2px_2px_0px] inset-shadow-stone-900/25
    dark:inset-shadow-stone-100/25 hover:inset-shadow-none focus:outline-none focus:inset-shadow-none
    active:bg-yellow-300 dark:active:bg-orange-900"
>
  {hasPublished ? 'Republish' : 'Publish'}
</button>
