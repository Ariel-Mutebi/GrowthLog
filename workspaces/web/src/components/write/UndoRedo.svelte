<script lang="ts">
  import Undo2 from '@lucide/svelte/icons/undo-2';
  import Redo2 from '@lucide/svelte/icons/redo-2';
  import type { HistoryReport } from './events.ts';

  let canUndo = $state(false);
  let canRedo = $state(false);

  interface Item {
    icon: typeof Undo2;
    title: string;
    event: string;
    enabled: boolean;
  }

  const items: Item[] = $derived([
    { icon: Undo2, title: 'Undo', event: 'editor:undo', enabled: canUndo },
    { icon: Redo2, title: 'Redo', event: 'editor:redo', enabled: canRedo },
  ]);

  // Editor.svelte reports history state after every transaction
  $effect(() => {
    const onHistory = (event: Event) => {
      const { detail } = event as CustomEvent<HistoryReport>;
      canUndo = detail.canUndo;
      canRedo = detail.canRedo;
    };

    window.addEventListener('editor:history', onHistory);
    return () => window.removeEventListener('editor:history', onHistory);
  });
</script>

<div class="flex gap-4">
  {#each items as item}
    <button
      type="button"
      title={item.title}
      aria-label={item.title}
      disabled={!item.enabled}
      data-editor-event={item.event}
      onclick={() => window.dispatchEvent(new CustomEvent(item.event))}
      class="cursor-pointer text-stone-700 disabled:text-stone-500 hover:text-stone-950
        active:text-stone-950 dark:text-stone-200 dark:disabled:text-stone-400
        dark:hover:text-stone-50 dark:active:text-stone-950"
    >
      <item.icon size={16} />
    </button>
  {/each}
</div>
