<script lang="ts">
  interface Props {
    name: string;
    type: string;
  }

  const { name, type }: Props = $props();
</script>

<input
  required
  type={type}
  name={name}
  id={name}
  class="font-sans px-3 py-1.5 text-base md:text-xl text-stone-900 dark:text-stone-100
    border border-stone-200 dark:border-stone-600 focus:outline-hidden
    focus:border-stone-300 focus:dark:border-stone-500 w-full"
>
