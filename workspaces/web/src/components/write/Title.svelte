<script lang="ts">
  import debounce from 'debounce';
  import { toast } from 'svelte-sonner';
  import Toaster from '../Toaster.svelte';
  import { apiClient } from '../clients.ts';

  interface Props {
    id: string;
    title: string;
  }

  let { id, title = $bindable() }: Props = $props();

  const saveTitle = debounce(async (value: string) => {
    const { data: updated, error } = await apiClient.PATCH('/api/posts/{id}', {
      params: { path: { id } },
      body: { title: value },
    });

    if (!updated && error) {
      return toast.error(error.error, { description: error.message });
    }

    document.title = `Editing ${updated.title} | GrowthLog`;
    window.history.replaceState(null, '', '/edit/' + updated.slug);
  }, 10000);
</script>

<input
  type="text"
  placeholder="Title"
  bind:value={title}
  oninput={(event) => {
    saveTitle(event.currentTarget.value);
  }}
>

<Toaster />
