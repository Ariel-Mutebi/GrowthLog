<script lang="ts">
  import type { Editor } from '@tiptap/core';
  import Bold from '@lucide/svelte/icons/bold';
  import Italic from '@lucide/svelte/icons/italic';
  import Underline from '@lucide/svelte/icons/underline';
  import Link from '@lucide/svelte/icons/link';
  import Heading2 from '@lucide/svelte/icons/heading-2';
  import Heading3 from '@lucide/svelte/icons/heading-3';
  import Quote from '@lucide/svelte/icons/quote';

  interface Props {
    editor: Editor | null;
    element?: HTMLDivElement;
  }

  let { editor, element = $bindable() }: Props = $props();

  // Explicit reactive state: one boolean per button.
  type ActiveKey =
    | 'bold'
    | 'italic'
    | 'underline'
    | 'link'
    | 'h2'
    | 'h3'
    | 'blockquote';

  let active = $state<Record<ActiveKey, boolean>>({
    bold: false,
    italic: false,
    underline: false,
    link: false,
    h2: false,
    h3: false,
    blockquote: false
  });

  let linkMode = $state(false);
  let linkValue = $state('');
  let linkInput = $state<HTMLInputElement>();

  // Copy TipTap's current answers into Svelte state.
  function sync() {
    if (!editor) return;
    active = {
      bold: editor.isActive('bold'),
      italic: editor.isActive('italic'),
      underline: editor.isActive('underline'),
      link: editor.isActive('link'),
      h2: editor.isActive('heading', { level: 2 }),
      h3: editor.isActive('heading', { level: 3 }),
      blockquote: editor.isActive('blockquote')
    };
  }

  $effect(() => {
    if (!editor) return;

    // The toolbar hides on empty selections, so make sure the link input
    // isn't still open the next time it appears.
    const onSelection = () => {
      if (editor.state.selection.empty) linkMode = false;
    };

    sync();
    editor.on('transaction', sync);
    editor.on('selectionUpdate', onSelection);
    return () => {
      editor.off('transaction', sync);
      editor.off('selectionUpdate', onSelection);
    };
  });

  const chain = () => editor!.chain().focus();

  interface ToolbarItem {
    key: ActiveKey;
    title: string;
    icon: typeof Bold;
    run: () => void;
  }

  const formatItems: ToolbarItem[] = [
    { key: 'bold', title: 'Bold', icon: Bold, run: () => chain().toggleBold().run() },
    { key: 'italic', title: 'Italic', icon: Italic, run: () => chain().toggleItalic().run() },
    { key: 'underline', title: 'Underline', icon: Underline, run: () => chain().toggleUnderline().run() },
    { key: 'link', title: 'Link', icon: Link, run: startLink }
  ];

  const blockItems: ToolbarItem[] = [
    { key: 'h2', title: 'Large heading', icon: Heading2, run: () => chain().toggleHeading({ level: 2 }).run() },
    { key: 'h3', title: 'Small heading', icon: Heading3, run: () => chain().toggleHeading({ level: 3 }).run() },
    { key: 'blockquote', title: 'Quote', icon: Quote, run: () => chain().toggleBlockquote().run() }
  ];

  function startLink() {
    if (!editor) return;

    // Already a link: clicking again removes it
    if (active.link) {
      chain().extendMarkRange('link').unsetLink().run();
      return;
    }

    linkValue = '';
    linkMode = true;
    // focus after re-render
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
  {#each items as item (item.key)}
    <!-- mousedown preventDefault stops the click from stealing focus,
         which would collapse the selection and hide the menu -->
    <button
      type="button"
      title={item.title}
      aria-label={item.title}
      aria-pressed={active[item.key]}
      onmousedown={(e) => e.preventDefault()}
      onclick={item.run}
      class={[
        `flex size-8 cursor-pointer items-center justify-center rounded-md transition-colors
       text-stone-800 dark:text-stone-50 hover:bg-stone-100 dark:hover:bg-stone-800`,
        { 'text-emerald-800': active[item.key] }
      ]}
    >
      <item.icon size={18} />
    </button>
  {/each}
{/snippet}

<div
  bind:this={element}
  class="invisible absolute z-50 flex w-max items-center gap-0.5 rounded-lg p-1
    bg-stone-50 dark:bg-stone-900 shadow shadow-stone-600/25 dark:shadow-stone-200/25"
>
  {#if linkMode}
    <input
      bind:this={linkInput}
      bind:value={linkValue}
      type="url"
      placeholder="Paste a link and press Enter"
      class="w-64 bg-transparent px-2 py-1.5 text-sm outline-none
        text-stone-800 dark:text-stone-50 placeholder:text-stone-400"
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
    <span class="mx-1 h-4 w-px bg-stone-400 dark:bg-stone-600"></span>
    {@render group(blockItems)}
  {/if}
</div>
