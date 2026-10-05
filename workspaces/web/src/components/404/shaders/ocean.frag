precision highp float;

uniform vec2 uRes;
uniform float uTime;
uniform sampler2D uNoise; // 256x256 random noise, made in Ocean.svelte

// --- tweak these -------------------------------------------------------
// Tailwind blue-800 / 600 / 400 / 300 / 100, written as RGB values
const vec3 DEEP    = vec3( 30.,  64., 175.) / 255.;
const vec3 MID     = vec3( 37.,  99., 235.) / 255.;
const vec3 SHALLOW = vec3( 96., 165., 250.) / 255.;
const vec3 LIT     = vec3(147., 197., 253.) / 255.;
const vec3 SPRAY   = vec3(219., 234., 254.) / 255.;
const vec3 FOAM    = vec3(1.0);

// main swell: short, steep waves
const float SPEED  = 0.25;   // waves per second
const float FREQ   = 6.0;    // waves across the screen height
const float SLANT  = 0.12;   // tilt of the wave fronts

// second swell: long, slow, gentle, crossing at an angle
const float SPEED2 = 0.12;
const float FREQ2  = 2.2;
const float SLANT2 = -0.45;
const float SWELL2 = 0.6;    // strength relative to the main swell

const float WAVE_H = 0.03;   // height of the swells, for lighting
const float CHOP_H = 0.004;  // height of the small ripples, for lighting
const float CLOUDS = 0.15;   // how dark cloud shadows are
const float GRAIN  = 0.03;   // per-pixel grit
// -----------------------------------------------------------------------

// Smooth value noise: one texture read instead of four hashes.
float noise(vec2 x) {
  vec2 i = floor(x), f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return texture2D(uNoise, (i + f + 0.5) / 256.0).r;
}

float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 3; i++) { v += a * noise(p); p = p * 2.0 + 7.0; a *= 0.5; }
  return v;
}

// steep leading face at f = steep, then a long gentle back
float profile(float f, float steep) {
  return smoothstep(0.0, steep, f) * pow(1.0 - smoothstep(steep, 1.0, f), 1.5);
}

// every wave gets its own strength, varying along its length
float strength(float x, float id) {
  return 0.3 + 0.7 * noise(vec2(x * 3.0 + id * 17.0, id * 3.1));
}

// Wave phase: whole numbers are wave crests. Adding time makes waves roll
// down the screen. Two bends keep the fronts from being ruler-straight:
// a big slow one, and a small ragged one.
float phaseAt(vec2 p, float freq, float speed, float slant, float seed) {
  float bend = fbm(vec2(p.x * 1.2 + seed, p.y * 1.5 + uTime * 0.05)) - 0.5;
  float ragged = noise(p * 7.0 + seed + uTime * 0.15) - 0.5;
  return (p.y + p.x * slant + bend * 0.4 + ragged * 0.03) * freq + uTime * speed;
}

// One set of waves. Returns (height, body, foam, phase).
vec4 swell(vec2 p, float freq, float speed, float slant, float seed, float steep) {
  float phase = phaseAt(p, freq, speed, slant, seed);
  float id = floor(phase);
  float f = fract(phase);
  float amp = strength(p.x + seed, id + seed);

  float body = profile(f, steep) * amp;
  float chop = noise(vec2(p.x * 45.0, phase * 10.0));

  // foam sits on the crest and trails off behind it; weak waves barely foam
  float foam = clamp((amp - 0.3) * 1.8, 0.0, 1.0)
             * smoothstep(0.0, steep * 0.67, f)
             * pow(1.0 - smoothstep(steep * 0.67, 0.7, f), 1.5);

  return vec4(body * WAVE_H + chop * CHOP_H, body, foam, phase);
}

vec4 swell1(vec2 p) { return swell(p, FREQ,  SPEED,  SLANT,  0.0,  0.15); }
vec4 swell2(vec2 p) { return swell(p, FREQ2, SPEED2, SLANT2, 41.0, 0.4);  }

float height(vec2 p) { return swell1(p).x + SWELL2 * swell2(p).x; }

// Thin foam breaks up into lace.
float froth(vec2 p, float phase, float foam, float freq) {
  float k = 6.0 / freq; // keeps the lace the same size for both swells
  float lace = 0.6 * noise(vec2(p.x * 60.0 + uTime * 0.3, phase * 14.0 * k))
             + 0.4 * noise(vec2(p.x * 160.0, phase * 38.0 * k));
  float thr = mix(0.78, 0.2, foam);
  return smoothstep(thr, thr + 0.1, lace) * smoothstep(0.0, 0.05, foam);
}

void main() {
  vec2 p = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y;
  float e = 1.5 / uRes.y;

  vec4 a = swell1(p);
  vec4 b = swell2(p);
  float h = a.x + SWELL2 * b.x;
  vec2 g = vec2(height(p + vec2(e, 0.0)) - h, height(p + vec2(0.0, e)) - h) / e;

  // lighter at the bottom of the screen, deeper toward the top
  float t = p.y + 0.5;
  vec3 col = mix(SHALLOW, MID, smoothstep(0.0, 0.5, t));
  col = mix(col, DEEP, smoothstep(0.4, 1.0, t));
  col = mix(col, LIT, clamp(a.y + SWELL2 * b.y, 0.0, 1.0) * 0.45);

  // light the swells and ripples from the top-left
  vec3 n = normalize(vec3(-g, 1.0));
  vec3 L = normalize(vec3(-0.4, 0.5, 0.75));
  col *= 1.0 + (dot(n, L) - L.z) * 0.5;

  // white froth from both swells (the long swell only breaks occasionally)
  float z2 = b.z * 0.45;
  float foam = max(froth(p, a.w, a.z, FREQ), froth(p, b.w, z2, FREQ2));
  col = mix(col, mix(SPRAY, FOAM, smoothstep(0.3, 0.9, max(a.z, z2))), foam * 0.95);

  // slow cloud shadows drifting across the water
  float cloud = fbm(p * 0.9 + uTime * vec2(0.012, -0.006));
  col *= 1.0 - CLOUDS * smoothstep(0.5, 0.75, cloud);

  // per-pixel grit (the noise texture lines up 1:1 with pixels)
  float grit = texture2D(uNoise, gl_FragCoord.xy / 256.0).g - 0.5;
  col *= 1.0 + grit * GRAIN;

  gl_FragColor = vec4(col, 1.0);
}
