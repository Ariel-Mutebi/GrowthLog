<script lang="ts">
  import { onMount } from 'svelte';
  import { Tween } from 'svelte/motion';
  import { cubicOut } from 'svelte/easing';
  import { fade } from 'svelte/transition';
  import { Sun, Moon } from '@lucide/svelte';

  let isDark = $state(false);
  let hasMounted = $state(false);
  let dotEl: HTMLDivElement | undefined = $state();
  let fieldsetEl: HTMLFieldSetElement | undefined = $state();

  const dotX = new Tween(0, { duration: 250, easing: cubicOut });

  function moveDot() {
    if (dotEl && fieldsetEl) {
      const darkTarget = fieldsetEl.clientWidth - dotEl.offsetWidth - dotEl.offsetLeft;
      dotX.set(isDark ? darkTarget : 0);
    }
  }

  $effect(moveDot);

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
    window.addEventListener('resize', moveDot);

    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('resize', moveDot);
    };
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
    <fieldset
      bind:this={fieldsetEl}
      class="relative flex p-1 gap-2 border-2 border-zinc-200 dark:border-zinc-500 rounded-2xl"
      aria-label="Color scheme"
    >
      <div
        bind:this={dotEl}
        style:transform="translateX({dotX.current}px)"
        class="absolute top-0 left-0 bg-zinc-200 dark:bg-zinc-500 h-6 w-6 rounded-2xl"
      ></div>

      <label class="z-10">
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

      <label class="z-10">
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
