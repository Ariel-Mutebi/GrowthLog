<script lang="ts">
  import { onMount } from 'svelte';

  let canvas: HTMLCanvasElement;

  const vert = `
    attribute vec2 a;
    void main() { gl_Position = vec4(a, 0.0, 1.0); }
  `;

  const frag = `
    precision highp float;
    uniform vec2 uRes;
    uniform vec2 uMouse;
    uniform float uTime;
    uniform float uStir;

    // --- tweak these -------------------------------------------------
    const vec3 DARK  = vec3(0.56, 0.42, 0.31);
    const vec3 MID   = vec3(0.72, 0.57, 0.43);
    const vec3 LIGHT = vec3(0.88, 0.78, 0.66);
    const float BUMP  = 0.5;   // how much relief the surface has
    const float GRAIN = 0.07;  // per-pixel grit
    // -----------------------------------------------------------------

    float hash(vec2 p) {
      vec3 p3 = fract(vec3(p.xyx) * 0.1031);
      p3 += dot(p3, p3.yzx + 33.33);
      return fract((p3.x + p3.y) * p3.z);
    }

    float noise(vec2 p) {
      vec2 i = floor(p), f = fract(p);
      f = f * f * (3.0 - 2.0 * f);
      return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x),
                 mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
    }

    float fbm(vec2 p) {
      float v = 0.0, a = 0.5;
      mat2 r = mat2(0.8, -0.6, 0.6, 0.8);
      for (int i = 0; i < 5; i++) { v += a * noise(p); p = r * p * 2.0; a *= 0.5; }
      return v;
    }

    // The "milk surface": a height field that drifts over time and
    // gets twisted around the cursor.
    float height(vec2 p) {
      vec2 d = p - uMouse;
      float angle = uStir * exp(-dot(d, d) * 6.0);
      float c = cos(angle), s = sin(angle);
      p = uMouse + mat2(c, -s, s, c) * d;

      float t = uTime * 0.04;
      vec2 q = vec2(fbm(p * 1.5 + t), fbm(p * 1.5 + vec2(5.2, 1.3) - t));
      float h = fbm(p * 1.5 + 2.5 * q + t);
      return h + 0.01 * noise(p * 140.0); // fine relief
    }

    void main() {
      vec2 p = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y;
      float e = 1.5 / uRes.y;

      float h = height(p);
      vec2 g = vec2(height(p + vec2(e, 0.0)) - h, height(p + vec2(0.0, e)) - h) / e;

      // colour from height
      vec3 col = mix(DARK, MID, smoothstep(0.2, 0.55, h));
      col = mix(col, LIGHT, smoothstep(0.5, 0.8, h));

      // light the bumps from the top-left
      vec3 n = normalize(vec3(-g * BUMP, 1.0));
      vec3 L = normalize(vec3(-0.5, 0.6, 0.6));
      col *= 1.0 + (dot(n, L) - L.z) * 0.9;

      // grit: coarse speckle + per-pixel grain
      col *= 1.0 + (noise(gl_FragCoord.xy * 0.35) - 0.5) * 0.06;
      col *= 1.0 + (hash(gl_FragCoord.xy) - 0.5) * GRAIN;

      gl_FragColor = vec4(col, 1.0);
    }
  `;

  onMount(() => {
    const gl = canvas.getContext('webgl');
    if (!gl) return; // canvas background in <style> acts as the fallback

    const compile = (type: number, src: string) => {
      const shader = gl.createShader(type)!;
      gl.shaderSource(shader, src);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error(gl.getShaderInfoLog(shader));
      }
      return shader;
    };

    const program = gl.createProgram()!;
    gl.attachShader(program, compile(gl.VERTEX_SHADER, vert));
    gl.attachShader(program, compile(gl.FRAGMENT_SHADER, frag));
    gl.linkProgram(program);
    gl.useProgram(program);

    // one oversized triangle covers the whole screen
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(program, 'a');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    const uRes = gl.getUniformLocation(program, 'uRes');
    const uMouse = gl.getUniformLocation(program, 'uMouse');
    const uTime = gl.getUniformLocation(program, 'uTime');
    const uStir = gl.getUniformLocation(program, 'uStir');

    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

    // target = real cursor, (x, y) = lagging cursor, stir = how stirred up things are
    let tx = 0, ty = 0, x = 0, y = 0, stir = 0;
    let last = performance.now();
    let frame = 0;

    const resize = () => {
      const dpr = Math.min(devicePixelRatio, 1.5);
      canvas.width = innerWidth * dpr;
      canvas.height = innerHeight * dpr;
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform2f(uRes, canvas.width, canvas.height);
      if (reduced) draw(0);
    };

    const draw = (time: number) => {
      gl.uniform1f(uTime, time / 1000);
      gl.uniform2f(uMouse, x, y);
      gl.uniform1f(uStir, stir);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };

    const loop = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.1);
      last = now;

      // the lagging cursor trails the real one; the gap is a proxy for speed
      x += (tx - x) * (1 - Math.exp(-dt * 4));
      y += (ty - y) * (1 - Math.exp(-dt * 4));
      const lag = Math.hypot(tx - x, ty - y);

      // moving the cursor stirs; the milk slowly settles again
      stir = Math.min(4, stir * Math.exp(-dt * 0.6) + lag * dt * 20);

      draw(now);
      frame = requestAnimationFrame(loop);
    };

    const move = (e: PointerEvent) => {
      tx = (e.clientX - innerWidth / 2) / innerHeight;
      ty = (innerHeight / 2 - e.clientY) / innerHeight;
    };

    resize();
    addEventListener('resize', resize);
    if (!reduced) {
      addEventListener('pointermove', move, { passive: true });
      frame = requestAnimationFrame(loop);
    }

    return () => {
      cancelAnimationFrame(frame);
      removeEventListener('resize', resize);
      removeEventListener('pointermove', move);
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    };
  });
</script>

<canvas bind:this={canvas} aria-hidden="true"></canvas>

<style>
  canvas {
    position: fixed;
    inset: 0;
    z-index: -1;
    width: 100%;
    height: 100%;
    background: #b79a7a; /* shown if WebGL is unavailable */
    pointer-events: none;
  }
</style>
