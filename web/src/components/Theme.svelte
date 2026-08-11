<script lang="ts">
  import { onMount } from 'svelte';
  import { fade } from 'svelte/transition';
  import { Sun, Moon } from '@lucide/svelte';

  let isDark = $state(false);
  let hasMounted = $state(false);

  onMount(() => {
    isDark = document.documentElement.classList.contains('dark');
    hasMounted = true;

    const onStorage = ({ key, newValue }: StorageEvent) => {
      if (key === 'theme') {
        isDark = newValue === 'dark';
        document.documentElement.classList.toggle('dark', isDark);
      }
    };

    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  });

  function handleChange(event: Event) {
    isDark = (event.currentTarget as HTMLInputElement).value === 'dark';
    document.documentElement.classList.toggle('dark', isDark);
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
  }
</script>

{#if hasMounted}
  <div
    transition:fade={{ duration: 300 }}
    class="p-1 flex items-center gap-2 pr-3 rounded-2xl bg-zinc-100 dark:bg-zinc-800
    text-zinc-800 dark:text-zinc-100 inset-shadow-[inset_0_0_4px_var(--color-zinc-200)]"
  >
    <fieldset class="flex p-1 gap-2 border-2 border-zinc-200 dark:border-zinc-500 rounded-2xl" aria-label="Color scheme">
      <label>
        <input
          type="radio"
          name="color-scheme"
          value="light"
          checked={!isDark}
          aria-label="Light mode"
          onchange={handleChange}
          class="sr-only"
        />
        <Sun aria-hidden="true" size={16} />
      </label>

      <label>
        <input
          type="radio"
          name="color-scheme"
          value="dark"
          checked={isDark}
          aria-label="Dark mode"
          onchange={handleChange}
          class="sr-only"
        />
        <Moon aria-hidden="true" size={16} />
      </label>
    </fieldset>

    <span>{isDark ? 'Dark mode' : 'Light mode'}</span>
  </div>
{/if}
