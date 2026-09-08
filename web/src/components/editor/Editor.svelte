<script lang="ts">
  import * as Y from 'yjs';
  import { onMount, onDestroy } from 'svelte';
  import { Editor } from '@tiptap/core';
  import { StarterKit } from '@tiptap/starter-kit';
  import { HocuspocusProvider } from '@hocuspocus/provider';
  import { Collaboration } from '@tiptap/extension-collaboration';
  import { CollaborationCaret } from '@tiptap/extension-collaboration-caret';

  import { client } from '../../api/client.ts';
  import { getCurrentUser } from '../helpers/getCurrentUser.ts';
  import { assignCursorColor } from './assignCursorColor.ts';

  interface Props {
    postId: string;
  }

  const { postId }: Props = $props();

  let ydoc: Y.Doc;
  let editor: Editor;
  let element: HTMLDivElement;
  let provider: HocuspocusProvider;

  type states = 'connecting' | 'connected' | 'error';
  let status = $state<states>('connecting');

  onMount(async () => {
    try {
      const currentUser = await getCurrentUser();
      const { data: token } = await client.GET('/v1/collab');
      if (!currentUser || !token) throw new Error('Unauthenticated');

      ydoc = new Y.Doc();

      provider = new HocuspocusProvider({
        url: String(import.meta.env.PUBLIC_COLLAB_WS_URL),
        name: postId,
        document: ydoc,
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
              name: `${currentUser.forename} ${currentUser.surname}`,
              color: assignCursorColor(currentUser.id),
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
