<script>
  import { Tween } from 'svelte/motion';
  import { cubicOut } from 'svelte/easing';

  const pos = new Tween(
    { x: 90, y: 50 },
    { duration: 300, easing: cubicOut }
  );

  function updatePosition(e) {
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
  class="p-2 rounded-lg text-white text-xl"
  style="background-image: radial-gradient(circle at {pos.current.x}% {pos.current.y}%, #484848, #e3d2ef80);"
  onpointermove={updatePosition}
  onpointerleave={resetPosition}
>
  Sign up
</button>