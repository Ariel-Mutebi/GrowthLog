<script lang="ts">
  import debounce from 'debounce';
  import { toast } from 'svelte-sonner';
  import { apiClient } from '../clients.ts';
  import { autoResize } from '../Textarea.svelte';

  interface Props {
    id: string;
    title: string;
    onEnter?: () => void;
  }

  let { id, title = $bindable(), onEnter }: Props = $props();

  const saveTitle = debounce(async (value: string) => {
    if (value.length === 0) return;

    const { data: updated, error } = await apiClient.PATCH('/me/drafts/{id}', {
      params: { path: { id } },
      body: { title: value },
    });

    if (!updated && error) {
      return toast.error(error.error, { description: error.message });
    }

    document.title = `Editing ${updated.title} | GrowthLog`;
  }, 10000);

  function handleKeyDown(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      event.preventDefault();
      onEnter?.();
    }
  }
</script>

<textarea
  rows={1}
  placeholder="Title"
  bind:value={title}
  use:autoResize
  oninput={(event) => {
    saveTitle(event.currentTarget.value);
  }}
  onkeydown={handleKeyDown}
  class="resize-none font-serif soft text-6xl mb-4 focus:outline-none text-stone-800
    dark:text-stone-50 placeholder:text-stone-400 w-full font-semibold"
></textarea>
