<script lang="ts">
  interface Props {
    title: string;
  }

  const { title }: Props = $props();
</script>

<div
  class="tab relative bg-stone-50 dark:bg-stone-500 flex gap-1
    items-center py-2 pl-3 pr-6 rounded-t-3xl w-max max-w-44"
>
  <img
    src="/logo-32.png"
    alt="The GrowthLog logo"
    class="h-4 w-4 dark:hidden"
  />
  <img
    src="/logo-dark-32.png"
    alt="The GrowthLog logo"
    class="h-4 w-4 hidden dark:block"
  />
  <p class="text-xs md:text-sm text-stone-500 dark:text-stone-200 truncate">{title}</p>
</div>

<style>
  .tab {
    --r: 16px;
    margin-left: var(--r);
  }

  .tab::before,
  .tab::after {
    content: "";
    position: absolute;
    bottom: 0;
    width: var(--r);
    height: var(--r);
    background: inherit;
  }

  .tab::before {
    left: calc(-1 * var(--r));
    mask: radial-gradient(circle at 0 0, transparent var(--r), #000 var(--r));
  }

  .tab::after {
    right: calc(-1 * var(--r));
    mask: radial-gradient(circle at 100% 0, transparent var(--r), #000 var(--r));
  }
</style>
