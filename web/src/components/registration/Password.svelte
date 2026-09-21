<script lang="ts">
  import Label from './Label.svelte';
  import Input from './Input.svelte';
  import Error from './Error.svelte';
  import { Eye, EyeClosed } from '@lucide/svelte';

  interface Props {
    showStrength?: boolean;
  }

  let isVisible = $state(false);
  const { showStrength = false }: Props = $props();
</script>

<div class="flex flex-col gap-3 w-full">
  <Label label="Password" name="password" />
  <div class="relative">
    <Input name="password" type={isVisible ? "text" : "password"} />
    <button
      type="button"
      onclick={() => {
        isVisible != isVisible;
      }}
      aria-label={isVisible ? "Hide password" : "Show password"}
      class="absolute inset-y-0 right-0 pr-3 flex items-center text-stone-600 dark:text-stone-300"
    >
      {#if isVisible}
        <EyeClosed />
      {:else}
        <Eye />
      {/if}
    </button>
  </div>
</div>
