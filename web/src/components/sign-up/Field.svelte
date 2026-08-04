<script lang="ts">
  import { getValidationErrors } from "./context.ts";
  import type { SignUpField } from "./schema.ts";

  interface Props {
    label: string;
    name: SignUpField;
    type?: "text" | "email" | "password";
  }

  let { label, name, type = "text" }: Props = $props();
  const errors = getValidationErrors();
</script>

<div class="flex flex-col gap-1 w-full">
  <label for={name} class="text-white text-xl block">{label}</label>
  <input
    required
    type={type}
    name={name}
    id={name}
    class="bg-[#E3D2EF99] px-2 py-1 rounded-sm backdrop-blur-xs w-full text-sm"
  >
  {#if $errors[name]?.length}
    <p class="text-red-200 bg-neutral-900 text-xs px-2 py-1 font-mono">{$errors[name]?.[0]}</p>
  {/if}
</div>
