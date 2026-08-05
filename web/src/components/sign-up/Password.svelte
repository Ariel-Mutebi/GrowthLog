<script lang="ts">
  import zxcvbn from "zxcvbn-ts";
  import Field from "./Field.svelte";
  import { EyeClosed, Eye } from "@lucide/svelte";
  import type { Readable } from "svelte/store";
  import type { SignUpData } from "./schema.ts";

  interface Props {
    data: Readable<SignUpData>;
  }

  let visible = $state(false);
  let { data }: Props = $props();
  let { score } = $derived(
    $data.password ?
      zxcvbn($data.password, [$data.firstName, $data.lastName, $data.email].filter(Boolean)) :
      { score: 0 }
  );
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
    <ul class="flex gap-3 h-2" aria-label={`Password strength (0 - 4): ${score}`}>
      {#each Array(4) as _, i}
        <li
          class="border border-neutral-600 grow rounded-sm transition-colors duration-300"
          class:bg-[#E3D2EF80]={i >= score}
          class:bg-emerald-500={i < score}
        ></li>
      {/each}
    </ul>
  {/snippet}
</Field>
