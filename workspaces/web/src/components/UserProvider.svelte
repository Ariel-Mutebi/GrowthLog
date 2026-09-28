<script lang="ts">
  import { onMount, type Snippet } from 'svelte';
  import { navigate } from 'astro:transitions/client';
  import { apiClient } from './clients.ts';
  import { setUserContext, type User } from './userContext.ts';

  interface Props {
    children: Snippet;
  }

  let { children }: Props = $props();

  let state = $state<{ user: User | undefined }>({
    user: undefined,
  });

  setUserContext(state);

  onMount(async () => {
    const { data } = await apiClient.GET('/api/users');

    if (!data) {
      return await navigate('/login');
    }

    state.user = data;
  });
</script>

{@render children()}
