<script lang="ts">
  import Trash from '@lucide/svelte/icons/trash';
  import { toast } from 'svelte-sonner';
  import { apiClient } from '../clients.ts';
  import { navigate } from 'astro:transitions/client';

  interface Props {
    postId: string;
  }

  const { postId }: Props = $props();

  async function handleDelete() {
    const { error } = await apiClient.DELETE('/api/me/drafts/{id}', {
      params: {
        path: {
          id: postId,
        },
      },
    });

    if (error) {
      toast.error(error.error, { description: error.message });
    }

    navigate('/my-drafts');
  }
</script>

<button
  type="button"
  onclick={handleDelete}
  title="Delete draft"
  aria-label="Delete draft"
  class="cursor-pointer text-stone-700 hover:text-red-700 active:text-red-900
    dark:text-stone-200 dark:hover:text-red-200 dark:active:text-red-100"
>
  <Trash size={18} />
</button>
