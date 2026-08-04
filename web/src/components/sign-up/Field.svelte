<script lang="ts">
  import type { Field } from "./schema.ts";

  interface Props {
    label: string;
    name: Field;
    type?: "text" | "email" | "password";
  }

  let { label, name, type = "text" }: Props = $props();
</script>

<div class="gap-1 w-full">
  <label for={name} class="text-white text-xl block">{label}</label>
  <input
    required
    type={type}
    name={name}
    id={name}
    class="bg-[#E3D2EF99] px-2 py-1 rounded-sm backdrop-blur-xs w-full"
  >
</div>
