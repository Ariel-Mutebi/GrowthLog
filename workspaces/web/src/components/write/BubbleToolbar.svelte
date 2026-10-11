<script lang="ts">
  import type { Editor } from '@tiptap/core';

  interface Props {
    editor: Editor | null;
    element?: HTMLDivElement;
  }

  let { editor, element = $bindable() }: Props = $props();

  let linkMode = $state(false);
  let linkValue = $state('');
  let linkInput = $state<HTMLInputElement>();

  /*
   * TipTap isn't reactive on its own. Bumping this on every transaction makes
   * any template expression that reads it (via isActive) re-evaluate.
  */
  let tick = $state(0);

  $effect(() => {
    if (!editor) return;

    const onTransaction = () => tick++;
    // The toolbar hides on empty selections, so make sure the link input
    // isn't still open the next time it appears.
    const onSelection = () => {
      if (editor.state.selection.empty) linkMode = false;
    };

    editor.on('transaction', onTransaction);
    editor.on('selectionUpdate', onSelection);
    return () => {
      editor.off('transaction', onTransaction);
      editor.off('selectionUpdate', onSelection);
    };
  });

  function isActive(name: string, attrs?: Record<string, unknown>) {
    tick; // subscribe
    return editor?.isActive(name, attrs) ?? false;
  }

  interface ToolbarItem {
    label: string;
    title: string;
    class?: string; // extra Tailwind classes for the label (font style etc.)
    active: () => boolean;
    run: () => void;
  }

  const chain = () => editor!.chain().focus();

  const formatItems: ToolbarItem[] = [
    {
      label: 'B',
      title: 'Bold',
      class: 'font-bold',
      active: () => isActive('bold'),
      run: () => chain().toggleBold().run()
    },
    {
      label: 'i',
      title: 'Italic',
      class: 'italic font-serif',
      active: () => isActive('italic'),
      run: () => chain().toggleItalic().run()
    },
    {
      label: 'U',
      title: 'Underline',
      class: 'underline',
      active: () => isActive('underline'),
      run: () => chain().toggleUnderline().run()
    },
    {
      label: 'Link',
      title: 'Link',
      active: () => isActive('link'),
      run: startLink
    }
  ];

  const blockItems: ToolbarItem[] = [
    {
      label: 'H',
      title: 'Large heading',
      class: 'font-bold text-base',
      active: () => isActive('heading', { level: 2 }),
      run: () => chain().toggleHeading({ level: 2 }).run()
    },
    {
      label: 'H',
      title: 'Small heading',
      class: 'font-bold text-xs',
      active: () => isActive('heading', { level: 3 }),
      run: () => chain().toggleHeading({ level: 3 }).run()
    },
    {
      label: '❝',
      title: 'Quote',
      active: () => isActive('blockquote'),
      run: () => chain().toggleBlockquote().run()
    }
  ];

  function startLink() {
    if (!editor) return;

    // Already a link: clicking again removes it
    if (editor.isActive('link')) {
      chain().extendMarkRange('link').unsetLink().run();
      return;
    }

    linkValue = '';
    linkMode = true;
    queueMicrotask(() => linkInput?.focus());
  }

  function applyLink() {
    const href = linkValue.trim();
    if (href) {
      chain().extendMarkRange('link').setLink({ href }).run();
    }
    linkMode = false;
  }

  function cancelLink() {
    linkMode = false;
    editor?.commands.focus();
  }
</script>

{#snippet group(items: ToolbarItem[])}
  {#each items as item (item.title)}
    <!-- mousedown preventDefault stops the click from stealing focus,
         which would collapse the selection and hide the menu -->
    <button
      type="button"
      title={item.title}
      onmousedown={(e) => e.preventDefault()}
      onclick={item.run}
      class="h-8 min-w-8 cursor-pointer rounded-md px-2 text-sm transition-colors hover:bg-white/15 {item.active()
        ? 'text-emerald-300'
        : 'text-white'}"
    >
      <span class={item.class}>{item.label}</span>
    </button>
  {/each}
{/snippet}

<!-- TipTap moves this element into place and toggles its visibility -->
<div
  bind:this={element}
  class="z-50 flex items-center gap-0.5 rounded-lg bg-neutral-900 p-1 shadow-lg"
>
  {#if linkMode}
    <input
      bind:this={linkInput}
      bind:value={linkValue}
      type="url"
      placeholder="Paste a link and press Enter"
      class="w-64 bg-transparent px-2 py-1.5 text-sm text-white outline-none placeholder:text-neutral-400"
      onkeydown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          applyLink();
        } else if (e.key === 'Escape') {
          cancelLink();
        }
      }}
    />
  {:else}
    {@render group(formatItems)}
    <span class="mx-1 h-4 w-px bg-white/25"></span>
    {@render group(blockItems)}
  {/if}
</div>
