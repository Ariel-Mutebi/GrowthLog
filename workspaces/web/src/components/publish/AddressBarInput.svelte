<script lang="ts">
  interface Props {
    mockUrlBase: string;
  }

  const { mockUrlBase }: Props = $props();
</script>

<div
  class="bg-stone-50 dark:bg-stone-500 px-6 py-3 text-xs
    md:text-sm text-stone-900 dark:text-stone-200"
>
  <div class="rounded-3xl bg-stone-100 dark:bg-stone-600  px-4 py-2 flex items-center">
    <span>{mockUrlBase}</span>
    <input
      required
      type="text"
      name="publishedSlug"
      class="border border-stone-300 dark:border-stone-500 focus:outline-none
        focus:border-stone-400 field-sizing-content"
    >
  </div>
</div>
