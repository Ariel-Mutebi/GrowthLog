<script lang="ts">
  import { onDestroy } from 'svelte';
  import debounce from 'debounce';
  import { apiClient } from '../clients.ts';
	import { TagsInput } from '$lib/components/ui/tags-input';
  import type { TagSuggestions } from '../../types/backend.ts';

  import FieldWrapper from '../FieldWrapper.svelte';
  import Label from '../Label.svelte';
  import InlineError from '../Error.svelte';

  interface Props {
    value: string[];
    errors: string[] | null;
  }

  let { value = $bindable([]), errors }: Props = $props();
  let suggestions = $state<TagSuggestions>([]);
  let controller: AbortController | undefined;

  const searchTags = debounce(async (query: string) => {
    const term = query.trim();

    if (term.length < 2) {
      suggestions = [];
      return;
    }

    const requestController = new AbortController();
    controller = requestController;

    try {
      const { data } = await apiClient.GET('/api/tags', {
        params: {
          query: {
            search: term,
          },
        },
        signal: requestController.signal,
      });

      if (!data) return;
      suggestions = data;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return;
      }
    } finally {
      if (controller === requestController) {
        controller = undefined;
      }
    }
  }, 300);

  function handleInput(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    const query = input.value;

    controller?.abort();
    controller = undefined;

    if (query.trim().length < 2) {
      searchTags.clear();
      suggestions = [];
      return;
    }

    void searchTags(query);
  }

  onDestroy(() => {
    searchTags.clear();
    controller?.abort();
  });
</script>


<FieldWrapper>
  <Label label="Tags" id="tags-label" variant="light" />
  <TagsInput
    bind:value
    {suggestions}
    oninput={handleInput}
    placeholder="Add a topic"
    aria-labelledby="tags-label"
  />
  {#if errors}
    <InlineError {errors} />
  {/if}
</FieldWrapper>
