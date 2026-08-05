<script lang="ts">
  import Field from "./Field.svelte";
  import { EyeClosed, Eye } from "@lucide/svelte";
  import type { Readable } from "svelte/store";
  import type { SignUpData } from "./schema.ts";

  interface Props {
    data: Readable<SignUpData>;
  }

  let visible = $state(false);
  let { data }: Props = $props();
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
    <ul class="flex gap-3 h-2">
      <li class="border border-neutral-600 grow rounded-sm bg-[#E3D2EF80]"></li>
      <li class="border border-neutral-600 grow rounded-sm bg-[#E3D2EF80]"></li>
      <li class="border border-neutral-600 grow rounded-sm bg-[#E3D2EF80]"></li>
      <li class="border border-neutral-600 grow rounded-sm bg-[#E3D2EF80]"></li>
    </ul>
  {/snippet}
</Field>
