<script lang="ts">
  import { onMount } from 'svelte';
  import { Tween } from 'svelte/motion';
  import { fade } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';
  import Sun from '@lucide/svelte/icons/sun';
  import Moon from '@lucide/svelte/icons/moon';

  let isDark = $state(false);
  let hasMounted = $state(false);
  let dot = $state<HTMLDivElement>();
  let fieldset = $state<HTMLFieldSetElement>();

  const DURATION = 300;

  const dotX = new Tween(0, {
    duration: DURATION,
    easing: cubicOut,
  });

  $effect(() => {
    if (!dot || !fieldset) return;
    dotX.set(isDark ? fieldset.clientWidth - dot.offsetWidth : 0);
  });

  function applyTheme(dark: boolean, persist = false) {
    isDark = dark;
    document.documentElement.classList.toggle('dark', dark);
    if (persist) localStorage.setItem('isDark', String(dark));
  }

  onMount(() => {
    applyTheme(document.documentElement.classList.contains('dark'));
    hasMounted = true;

    // enables cross-tab syncing of changes to the preferred theme
    function onStorage({ key, newValue }: StorageEvent) {
      if (key == 'isDark') applyTheme(newValue === 'true');
    };

    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  });

  function handleChange(event: Event) {
    applyTheme((event.currentTarget as HTMLInputElement).value === 'dark', true);
  }
</script>

{#snippet option(value: 'light' | 'dark', checked: boolean, ariaLabel: string, Icon: typeof Sun)}
  <label class="z-10">
    <input
      type="radio"
      name="theme"
      class="sr-only"
      {value}
      {checked}
      aria-label={ariaLabel}
      onchange={handleChange}
    >
    <Icon size={16} aria-hidden="true" />
  </label>
{/snippet}

{#if hasMounted}
  <div
    transition:fade={{ duration: DURATION }}
    class="flex items-center gap-2 p-1 md:pr-4 rounded-4xl bg-neutral-100 dark:bg-neutral-800
      text-neutral-800 dark:text-neutral-100 inset-shadow-[2px_2px_0] inset-shadow-neutral-300
      dark:inset-shadow-neutral-600"
  >
    <fieldset
      bind:this={fieldset}
      aria-label="Theme"
      class="relative p-1 flex gap-3 border-2 border-neutral-200 dark:border-neutral-500 rounded-4xl"
    >
      <div
        bind:this={dot}
        style:transform="translateX({dotX.current}px)"
        class="absolute top-0 left-0 h-6 w-6 bg-neutral-200 dark:bg-neutral-500 rounded-xl
          shadow-[1px_1px_1px] shadow-neutral-300 dark:shadow-neutral-600"
      ></div>
      {@render option('light', !isDark, 'Light mode', Sun)}
      {@render option('dark', isDark, 'Dark mode', Moon)}
    </fieldset>

    <p class="hidden md:block text-xl text-shadow-[1px_2px_1px] text-shadow-neutral-300 dark:text-shadow-neutral-600">
      {isDark ? 'Dark mode' : 'Light mode'}
    </p>
  </div>
{/if}
