<script lang="ts">
  import Label from './Label.svelte';
  import Input from './Input.svelte';
  import Error from './Error.svelte';

  interface Props {
    label: string;
    name: string;
    type?: string;
    error?: string;
  }

  const { name, label, error, type = 'text' }: Props = $props();
</script>

<div class="flex flex-col gap-3 w-full">
  <Label {name} {label} />
  <Input {name} {type} />
  {#if error}
    <Error message={error} />
  {/if}
</div>
