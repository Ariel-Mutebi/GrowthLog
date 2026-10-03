<script lang="ts">
  import * as Y from 'yjs';
  import { onMount, onDestroy } from 'svelte';
  import debounce from 'debounce';
  import { Editor } from '@tiptap/core';
  import StarterKit from '@tiptap/starter-kit';
  import Collaboration from '@tiptap/extension-collaboration';
  import CollaborationCaret from '@tiptap/extension-collaboration-caret';
  import { PUBLIC_DOCS_URL } from 'astro:env/client';
  import { HocuspocusProvider } from '@hocuspocus/provider';

  import { apiClient } from '../clients.ts';
  import { assignCursorColor } from './cursor.ts';
  import type { User } from '../../types/user.ts';

  interface Props {
    user: User;
    postId: string;
    initialTitle: string;
  }

  const { postId, user, initialTitle }: Props = $props();

  let ydoc: Y.Doc;
  let editor: Editor;
  let element: HTMLDivElement;
  let provider: HocuspocusProvider;

  // svelte-ignore state_referenced_locally
  let title = $state(initialTitle);
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
        extensions: [
          StarterKit.configure({ undoRedo: false }),
          Collaboration.configure({ document: ydoc }),
          CollaborationCaret.configure({
            provider,
            user: {
              name: `${user.forename} ${user.surname}`,
              color: assignCursorColor(user.id),
            }
          }),
        ],
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

  const saveTitle = debounce(async (value: string) => {
    await apiClient.PATCH('/api/posts/{id}', {
      params: { path: { id: postId } },
      body: { title: value },
    });
  }, 1000);
</script>

{#if status === 'error'}
  <p>Couldn't connect to the editor. Try refreshing.</p>
{/if}

<input
  type="text"
  placeholder="Title"
  value={title != 'Untitled' ? title : ''}
  oninput={(event) => {
    saveTitle(event.currentTarget.value);
  }}
>

<div bind:this={element}></div>
