<script lang="ts">
  import { onMount } from 'svelte';
  import { client } from '../api/client.ts';

  let data: { forename: string; surname: string } | undefined;

  onMount(async () => {
    const response = await client.GET('/v1/users');
    data = response.data;
  });
</script>

{#if data}
  <p>Hello, {data.forename} {data.surname}!</p>
{:else}
  <p>Hello, world</p>
{/if}
