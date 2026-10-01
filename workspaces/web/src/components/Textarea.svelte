<script lang="ts">
  interface Props {
    name: string;
  }

  const { name }: Props = $props();
</script>

<textarea
  rows={4}
  id={name}
  name={name}
  class="text-stone-900 dark:text-stone-100 border border-stone-200 dark:border-stone-600
    focus:outline-hidden focus:border-stone-500 focus:dark:border-stone-300 w-full"
></textarea>
