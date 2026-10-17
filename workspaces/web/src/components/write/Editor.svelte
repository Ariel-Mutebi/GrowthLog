<script lang="ts">
  import * as Y from 'yjs';
  import { onMount, onDestroy } from 'svelte';
  import { fade } from 'svelte/transition';
  import { Editor, isTextSelection } from '@tiptap/core';
  import StarterKit from '@tiptap/starter-kit';
  import Image from '@tiptap/extension-image';
  import BubbleMenu from '@tiptap/extension-bubble-menu';
  import Collaboration from '@tiptap/extension-collaboration';
  import CollaborationCaret from '@tiptap/extension-collaboration-caret';
  import { PUBLIC_DOCS_URL } from 'astro:env/client';
  import { HocuspocusProvider } from '@hocuspocus/provider';

  import { apiClient } from '../clients.ts';
  import { assignCursorColor } from './cursor.ts';
  import type { User } from '../../types/backend.ts';
  import type { HistoryReport, ImageUploaded } from './events.ts';

  import Title from './Title.svelte';
  import Toaster from '../Toaster.svelte';
  import BubbleToolbar from './BubbleToolbar.svelte';

  interface Props {
    user: User;
    postId: string;
    initialTitle: string;
  }

  const { postId, user, initialTitle }: Props = $props();

  let ydoc: Y.Doc;
  let provider: HocuspocusProvider;
  let element: HTMLDivElement;

  // $state.raw (not $state) because a deep proxy would wrap the Editor instance and break it.
  let editor = $state.raw<Editor | null>(null);
  let menuElement = $state<HTMLDivElement>();

  // svelte-ignore state_referenced_locally
  let title = $state(initialTitle == 'Untitled' ? '' : initialTitle);
  let status = $state<'connecting' | 'connected' | 'error'>('connecting');

  onMount(async () => {
    try {
      const { data } = await apiClient.GET('/api/me/jwt');
      if (!data) throw new Error('Unauthenticated');

      ydoc = new Y.Doc();

      provider = new HocuspocusProvider({
        url: PUBLIC_DOCS_URL,
        name: postId,
        document: ydoc,
        token: data.token,
        onSynced() {
          status = 'connected';
        },
        onAuthenticationFailed() {
          status = 'error';
        }
      });

      const proseClasses = [
        'prose prose-xl prose-stone dark:prose-invert focus:outline-none',
        'prose-headings:mb-2 prose-p:my-2 prose-blockquote:my-4',
        'prose-ol:my-4 prose-ul:my-4 prose-li:my-1 [&_li_p]:my-1',
      ].join(' ');

      editor = new Editor({
        element,
        editorProps: {
          attributes: {
            class: proseClasses,
          }
        },
        extensions: [
          StarterKit.configure({
            undoRedo: false,
            link: { openOnClick: false },
            heading: { levels: [2, 3] },
            dropcursor: { color: false, width: 4, class: 'drop-cursor' }
          }),
          Image,
          BubbleMenu.configure({
            element: menuElement!,
            options: { placement: 'top', offset: 8 },
            shouldShow: ({ state }) => isTextSelection(state.selection) && !state.selection.empty,
          }),
          Collaboration.configure({ document: ydoc }),
          CollaborationCaret.configure({
            provider,
            user: {
              name: `${user.forename} ${user.surname}`,
              color: assignCursorColor(user.id)
            }
          })
        ]
      });
    } catch (error) {
      console.error(error);
      status = 'error';
    }
  });

  $effect(() => {
    const undo = () => {
      editor?.commands.focus();
      editor?.commands.undo();
    };
    const redo = () => {
      editor?.commands.focus();
      editor?.commands.redo();
    };

    window.addEventListener('editor:undo', undo);
    window.addEventListener('editor:redo', redo);
    return () => {
      window.removeEventListener('editor:undo', undo);
      window.removeEventListener('editor:redo', redo);
    };
  });

  $effect(() => {
    if (!editor) return;
    const current = editor;

    const report = () => {
      window.dispatchEvent(
        new CustomEvent('editor:history', {
          detail: {
            canUndo: current.can().undo(),
            canRedo: current.can().redo(),
          } satisfies HistoryReport,
        })
      );
    };

    report();
    current.on('transaction', report);
    return () => current.off('transaction', report);
  });

  $effect(() => {
    const onImageUploaded = (event: Event) => {
      const { detail } = event as CustomEvent<ImageUploaded>;
      editor?.chain().focus('end').setImage(detail).run();
    };

    window.addEventListener('editor:image-uploaded', onImageUploaded);
    return () => window.removeEventListener('editor:image-uploaded', onImageUploaded);
  });

  onDestroy(() => {
    editor?.destroy();
    provider?.destroy();
    ydoc?.destroy();
  });
</script>

{#if status === 'error'}
  <p>Couldn't connect to the editor. Try refreshing.</p>
{/if}

<main>
  <Title id={postId} bind:title />
  <div
    bind:this={element}
    in:fade={{ duration: 1000 }}
  ></div>
  <BubbleToolbar {editor} bind:element={menuElement} />
</main>

<style>
  main {
    width: min(100%, 800px);
  }
</style>

<Toaster />
