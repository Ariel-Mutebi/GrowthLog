<script lang="ts">
  import SquarePlus from '@lucide/svelte/icons/square-plus';
  import { navigate } from 'astro:transitions/client';
  import { apiClient } from '../clients.ts';
  import { toast } from 'svelte-sonner';
  import Toaster from '../Toaster.svelte';

  let creating = $state(false);

  async function create() {
    if (creating) return;
    creating = true;

    try {
      const { data, error } = await apiClient.POST('/api/posts');

      if (error || !data) {
        return toast.error(error.error, { description: error.message });
      }

      return navigate(`/edit/${data.id}`);
    } catch (networkError) {
      return toast.error(String(networkError));
    } finally {
      creating = false;
    }
  }
</script>

<button
  type="button"
  onclick={create}
  disabled={creating}
  class="text-stone-800 font-mono text-2xl p-4 pr-8 w-max flex gap-3 items-center bg-yellow-300
   hover:bg-yellow-400 dark:hover:bg-yellow-200 shadow-[0px_4px_0px] shadow-stone-800
   active:shadow-none active:translate-y-1 disabled:cursor-not-allowed disabled:pointer-events-none
   disabled:shadow-none disabled:translate-y-1 disabled:bg-stone-200 disabled:text-stone-600
   disabled:dark:bg-stone-600 disabled:dark:text-stone-200"
>
  <SquarePlus />
  <span>Create new</span>
</button>

<Toaster />
