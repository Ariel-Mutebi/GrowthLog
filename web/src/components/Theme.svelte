<script lang="ts">
  import { onMount } from 'svelte';

  let isDark = false;

  onMount(() => {
    isDark = document.documentElement.classList.contains('dark');

    const onStorage = ({ key, newValue }: StorageEvent) => {
      if (key === 'theme') {
        isDark = newValue === 'dark';
        document.documentElement.classList.toggle('dark', isDark);
      }
    };

    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  });

  function toggle() {
    isDark = !isDark;
    document.documentElement.classList.toggle('dark', isDark);
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
  }
</script>

<button
  on:click={toggle}
  aria-label="Toggle dark mode"
  aria-pressed={isDark}
>
  {isDark ? 'Light mode' : 'Dark mode'}
</button>