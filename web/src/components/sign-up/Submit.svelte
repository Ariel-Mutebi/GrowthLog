<script lang="ts">
  import { Tween } from 'svelte/motion';
  import { cubicOut } from 'svelte/easing';

  const pos = new Tween({ x: 90, y: 50 }, { duration: 300, easing: cubicOut });

  function updatePosition(e: PointerEvent & { currentTarget: HTMLButtonElement }) {
    const rect = e.currentTarget.getBoundingClientRect();
    pos.set({
      x: ((e.clientX - rect.left) / rect.width) * 100,
      y: ((e.clientY - rect.top) / rect.height) * 100
    });
  }

  function resetPosition() {
    pos.set({ x: 90, y: 50 });
  }
</script>

<button
  type="submit"
  class="
    p-2 rounded-lg text-white text-xl font-semibold
    [--gradient-start:#72BEB199] [--gradient-end:#C9D0C1CC]
    dark:[--gradient-start:#484848] dark:[--gradient-end:#e3d2ef80]"
  style="background-image: radial-gradient(
    circle at {pos.current.x}% {pos.current.y}%,
    var(--gradient-start), var(--gradient-end));"
  onpointermove={updatePosition}
  onpointerleave={resetPosition}
>
  Sign up
</button>