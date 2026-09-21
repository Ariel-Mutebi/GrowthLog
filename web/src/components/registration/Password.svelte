<script lang="ts">
  import Label from './Label.svelte';
  import Input from './Input.svelte';
  import Errors from './Error.svelte';
  import FieldWrapper from './FieldWrapper.svelte';
  import { Eye, EyeClosed } from '@lucide/svelte';

  interface Props {
    errors?: string[] | null;
  }

  const { errors }: Props = $props();
  let isVisible = $state(false);
</script>

<FieldWrapper>
  <Label label="Password" name="password" />

  <div class="relative">
    <Input name="password" type={isVisible ? "text" : "password"} />
    <button
      type="button"
      onclick={() => {
        isVisible = !isVisible;
      }}
      aria-label={isVisible ? "Hide password" : "Show password"}
      class="absolute inset-y-0 right-0 pr-3 flex items-center text-stone-600 dark:text-stone-300
        hover:text-stone-900 hover:dark:text-stone-100 focus:text-stone-900 focus:dark:text-stone-100
        focus:outline-stone-200 focus:dark:outline-stone-600"
    >
      {#if isVisible}
        <EyeClosed />
      {:else}
        <Eye />
      {/if}
    </button>
  </div>

  {#if errors}
    <Errors {errors} />    
  {/if}
</FieldWrapper>
