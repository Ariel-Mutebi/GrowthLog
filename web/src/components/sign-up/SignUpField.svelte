<script lang="ts">
  interface Props {
    field: string;
    type?: "text" | "email" | "password";
  }

  let { field, type = "text" }: Props = $props();
  let kebab = $derived(field.toLocaleLowerCase().replace(" ", "-"));

</script>

<div class="gap-1 w-full">
  <label for={kebab} class="text-white text-xl block">{field}</label>
  <input
    type={type}
    name={kebab}
    id={kebab}
    class="bg-[#E3D2EF99] px-2 py-1 rounded-sm backdrop-blur-xs w-full"
  >
</div>