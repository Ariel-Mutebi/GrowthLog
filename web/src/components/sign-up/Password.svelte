<script lang="ts">
  import zxcvbn from "zxcvbn-ts";
  import { Spring } from 'svelte/motion';
  import { EyeClosed, Eye } from "@lucide/svelte";
  import type { Readable } from "svelte/store";
  import Field from "./Field.svelte";
  import type { SignUpData } from "./schema.ts";

  interface Props {
    data: Readable<SignUpData>;
  }

  let visible = $state(false);
  let { data }: Props = $props();

  let score = $derived(
    $data.password ?
      zxcvbn($data.password, [$data.forename, $data.surname, $data.email].filter(Boolean)).score : 0
  );
  
  const fills = Array.from({ length: 4 }, () =>
    new Spring(0, { stiffness: 0.04, damping: 0.6 })
  );

  $effect(() => {
    fills.forEach((fill, i) => {
      fill.target = i < score ? 1 : 0;
    });
  });
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
      {#each fills as fill}
        <li class="relative border border-neutral-600 grow rounded-sm bg-[#E3D2EF80] overflow-hidden">
          <div
            style="width: {fill.current * 100}%"
            class="absolute inset-y-0 left-0 bg-cyan-600 rounded-sm"
          >
            <svg
              viewBox="-10 0 20 20"
              preserveAspectRatio="none"
              style="opacity: {Math.min(fill.current * 10, 1)}"
              class="absolute inset-y-0 left-full w-4 translate-x-[-55%] text-cyan-600"
            >
              <path d="M0,0 C8,2 8,8 0,10 C-8,12 -8,18 0,20 Z" fill="currentColor" />
            </svg>
          </div>
        </li>
      {/each}
    </ul>
  {/snippet}
</Field>
