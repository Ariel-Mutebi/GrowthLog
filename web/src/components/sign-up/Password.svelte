<script lang="ts">
  import Field from "./Field.svelte";
  import { EyeClosed, Eye } from "@lucide/svelte";

  let visible = $state(false);
</script>

<Field label="Password" name="password" type={visible ? 'text' : 'password'}>
  {#snippet rightIcon()}
    <button
      type="button"
      onclick={() => {
        visible = !visible;
      }}
      aria-label={visible ? 'Hide password' : 'Show password'}
    >
      {#if visible}
        <EyeClosed />
      {:else}
        <Eye />
      {/if}
    </button>
  {/snippet}
</Field>
