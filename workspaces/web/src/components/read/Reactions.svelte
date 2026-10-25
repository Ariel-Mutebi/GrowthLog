<script lang="ts">
  import { apiClient } from '../clients.ts';
  import { HTTPError, toastError } from '../errorHandling.ts';
  import Clover from '@lucide/svelte/icons/clover';

  interface Props {
    postId: string;
    likes: number;
    hasLiked: boolean;
  }

  const { postId, likes, hasLiked }: Props = $props();

  let liked = $derived(hasLiked);
  let count = $derived(likes);

  let pending = false;

  async function toggleLike() {
    if (pending) return;
    pending = true;

    const wasLiked = liked;
    const previousCount = count;

    // Optimistic update
    liked = !wasLiked;
    count = previousCount + (wasLiked ? -1 : 1);

    try {
      const options = { params: { path: { postId } } };
      const { error } = wasLiked
        ? await apiClient.DELETE('/api/posts/{postId}/likes', options)
        : await apiClient.PUT('/api/posts/{postId}/likes', options);

      if (error) throw new HTTPError(error);
    } catch (error) {
      liked = wasLiked;
      count = previousCount;
      toastError(error);
    } finally {
      pending = false;
    }
  }
</script>

<div class="text-stone-600 dark:text-stone-400">
  <button
    onclick={toggleLike}
    aria-pressed={liked}
    aria-label={liked ? 'Unlike' : 'Like'}
    class="flex gap-1 items-center aria-pressed:text-emerald-600"
  >
    <Clover />
    {count}
  </button>
</div>
