<script lang="ts">
  interface Props {
    href: string;
    text: string;
  }

  const { href, text }: Props = $props();
</script>

<a {href} class="underline text-zinc-600 dark:text-zinc-400">{text}</a>
