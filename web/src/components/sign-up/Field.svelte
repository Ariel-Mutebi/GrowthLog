<script lang="ts">
  import type { Snippet } from "svelte";
  import { getValidationErrors } from "./context.ts";
  import type { SignUpField } from "./schema.ts";

  interface Props {
    label: string;
    name: SignUpField;
    type?: "text" | "email" | "password";
    rightIcon?: Snippet;
    underInput?: Snippet;
  }

  let {
    label,
    name,
    type = "text",
    rightIcon,
    underInput,
  }: Props = $props();

  const errors = getValidationErrors();
</script>

<div class="flex flex-col gap-1 w-full">
  <label for={name} class="text-white text-xl block">{label}</label>
  <div class="relative">
    <input
      required
      type={type}
      name={name}
      id={name}
      class="bg-[#E3D2EF99] px-2 py-1 rounded-sm backdrop-blur-xs w-full text-sm"
    >
    {#if rightIcon}
      <span class="absolute inset-y-0 right-0 flex items-center pr-2 text-neutral-800 hover:text-neutral-950">
        {@render rightIcon()}
      </span>
    {/if}
  </div>

  {#if $errors[name]?.length}
    <p class="text-red-200 bg-neutral-800 text-xs px-2 py-1 font-mono">{$errors[name]![0]}</p>
  {/if}

  {#if underInput}
    {@render underInput()}
  {/if}
</div>
