<script lang="ts">
  import { onMount } from 'svelte';
  import { getCurrentUser } from './helpers/getCurrentUser.ts';

  let data: { forename: string; surname: string } | null;

  onMount(async () => {
    data = await getCurrentUser();
  });
</script>

{#if data}
  <p>Hello, {data.forename} {data.surname}!</p>
{:else}
  <p>Hello, world</p>
{/if}
