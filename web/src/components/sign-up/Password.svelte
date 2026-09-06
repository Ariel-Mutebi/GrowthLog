<script lang="ts">
  import Field from "./Field.svelte";
  import { EyeClosed, Eye } from "@lucide/svelte";
  import PasswordStrengthMeter from "./PasswordStrengthMeter.svelte";

  interface Props {
    showStrength: boolean;
  }

  let visible = $state(false);
  let { showStrength = false }: Props = $props();
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

  {#snippet underInput()}
    {#if showStrength}
      <PasswordStrengthMeter />
    {/if}
  {/snippet}
</Field>
