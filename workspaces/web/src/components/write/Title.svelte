<script lang="ts">
  import debounce from 'debounce';
  import { toast } from 'svelte-sonner';
  import { apiClient } from '../clients.ts';
  import { autoResize } from '../Textarea.svelte';
  interface Props {
    id: string;
    title: string;
  }

  let { id, title = $bindable() }: Props = $props();

  const saveTitle = debounce(async (value: string) => {
    if (value.length === 0) return;

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

<textarea
  rows={1}
  placeholder="Title"
  bind:value={title}
  use:autoResize
  oninput={(event) => {
    saveTitle(event.currentTarget.value);
  }}
  class="resize-none font-serif soft text-6xl mb-4 focus:outline-none text-stone-800
    dark:text-stone-50 placeholder:text-stone-400 w-full font-semibold"
></textarea>
