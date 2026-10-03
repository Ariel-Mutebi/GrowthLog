<script lang="ts">
  import * as Y from 'yjs';
  import { onMount } from 'svelte';
  import { Editor } from '@tiptap/core';
  import StarterKit from '@tiptap/starter-kit';
  import Collaboration from '@tiptap/extension-collaboration';
  import CollaborationCaret from '@tiptap/extension-collaboration-caret';
  import { PUBLIC_DOCS_URL } from 'astro:env/client';
  import { HocuspocusProvider } from '@hocuspocus/provider';

  import { apiClient } from '../clients.ts';
  import { assignCursorColor } from './assignCursorColor.ts';
  import type { User } from '../../types/user.ts';

  interface Props {
    postId: string;
    user: User;
  }

  const { postId, user }: Props = $props();

  let ydoc: Y.Doc;
  let editor: Editor;
  let element: HTMLDivElement;
  let provider: HocuspocusProvider;

  type states = 'connecting' | 'connected' | 'error';
  let status = $state<states>('connecting');

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

      status = 'connected';
    } catch (error) {
      console.error(error);
      status = 'error';
    }
  });
</script>

<div bind:this={element}></div>
