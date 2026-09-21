<script lang="ts">
  interface Props {
    text: string;
  }

  const { text }: Props = $props();
</script>

<button
  type="submit"
  class="flex justify-center p-4 w-full bg-lime-100 dark:bg-emerald-900 
  text-3xl text-stone-800 dark:text-lime-100 inset-shadow-[2px_2px_0px]
  inset-shadow-stone-800/25 dark:inset-shadow-lime-100/25 text-shadow-[2px_2px_0]
  text-shadow-stone-800/25 dark:text-shadow-lime-100/25 hover:inset-shadow-none
  hover:text-shadow-none focus:inset-shadow-none focus:text-shadow-none focus:outline-none
  active:bg-lime-200 dark:active:bg-emerald-800">
  {text}
</button>
