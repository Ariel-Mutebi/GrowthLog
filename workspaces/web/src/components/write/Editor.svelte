<script lang="ts">
  import * as Y from 'yjs';
  import { onMount, onDestroy } from 'svelte';
  import { Editor } from '@tiptap/core';
  import StarterKit from '@tiptap/starter-kit';
  import BubbleMenu from '@tiptap/extension-bubble-menu';
  import Collaboration from '@tiptap/extension-collaboration';
  import CollaborationCaret from '@tiptap/extension-collaboration-caret';
  import { PUBLIC_DOCS_URL } from 'astro:env/client';
  import { HocuspocusProvider } from '@hocuspocus/provider';

  import { apiClient } from '../clients.ts';
  import { assignCursorColor } from './cursor.ts';
  import type { User } from '../../types/backend.ts';

  import Title from './Title.svelte';
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
      const { data } = await apiClient.GET('/api/jwt');
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

      editor = new Editor({
        element,
        editorProps: {
          attributes: {
            class: 'prose prose-lg max-w-none min-h-[60vh] focus:outline-none'
          }
        },
        extensions: [
          StarterKit.configure({
            undoRedo: false,
            link: { openOnClick: false },
            heading: { levels: [2, 3] } // reserve h1 for the title
          }),
          BubbleMenu.configure({
            element: menuElement!,
            options: { placement: 'top', offset: 8 }
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
  <div bind:this={element}></div>
  <BubbleToolbar {editor} bind:element={menuElement} />
</main>
