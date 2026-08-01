// Tetrahedral normals — 4 SDE samples instead of 6.
// Epsilon scales with hit distance t so it never resolves finer than a pixel's
// projected footprint — a fixed epsilon picks up sub-pixel fold detail as hard
// normal flips, which then jitters AO and every lighting term.
vec3 calcNormal(vec3 p, float t) {
  float e = max(0.0012, t * 0.0009);
  vec2 k = vec2(1.0, -1.0);
  return normalize(
    k.xyy * sceneSDE(p + k.xyy * e) +
    k.yyx * sceneSDE(p + k.yyx * e) +
    k.yxy * sceneSDE(p + k.yxy * e) +
    k.xxx * sceneSDE(p + k.xxx * e)
  );
}

float calcAO(vec3 pos, vec3 nor) {
  float occ = 0.0, sca = 1.0;
  for (int i = 0; i < 3; i++) {
    float h = 0.02 + 0.15 * float(i) / 2.0;
    float d = sceneSDE(pos + h * nor);
    occ += (h - d) * sca;
    sca *= 0.85;
  }
  return clamp(1.0 - 2.5 * occ, 0.0, 1.0);
}

float softShadow(vec3 ro, vec3 rd, float mint, float maxt, float k) {
  float res = 1.0, t = mint;
  for (int i = 0; i < 12; i++) {
    float h = sceneSDE(ro + rd * t);
    if (h < 0.001) return 0.0;
    res = min(res, k * h / t);
    t += clamp(h, 0.02, 0.25);
    if (t > maxt) break;
  }
  return clamp(res, 0.0, 1.0);
}

vec3 iqPalette(vec3 a, vec3 b, vec3 c, vec3 d, float t) {
  return clamp(a + b * cos(6.2831853 * (c * t + d)), 0.0, 1.35);
}

vec3 hsv2rgb(vec3 c) {
  vec3 rgb = clamp(abs(mod(c.x * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
  return c.z * mix(vec3(1.0), rgb, c.y);
}

// Colour model — locked. Hue continuous in t; t form-locked & low-freq only.
// Do NOT drive hue with orbit, normals, high-freq sin, or screen UV.
// hueSpin is an extra rotation added *inside* the wrapping fract() — a spin that
// completes a full 0→1 lap is invisible in hue-space (h and h+1 are identical
// colours), so it can never introduce a seam, only extra continuous variety.
vec3 hueWalk(float t, float h0, float span, float sat, float val, float hueSpin) {
  t = clamp(t, 0.0, 1.0);
  float h = fract(h0 + span * t + hueSpin);
  float s = sat * (0.86 + 0.14 * sin(t * 3.14159265));
  float v = val * (0.88 + 0.14 * t);
  return hsv2rgb(vec3(h, clamp(s, 0.0, 1.0), clamp(v, 0.0, 1.2)));
}

vec3 paletteAt(int idx, float t, float hueSpin) {
  t = clamp(t, 0.0, 1.0);
  // Spin amplitude is scaled per profile — themed palettes wobble within their own
  // family (stay "distinct"), Full Spectrum alone gets the full wheel of spin.
  if (idx == 0) return hueWalk(t, 0.55, 0.38, 0.95, 1.05, hueSpin * 0.30);
  if (idx == 1) return hueWalk(t, 0.82, -0.52, 0.98, 1.05, hueSpin * 0.38);
  if (idx == 2) return hueWalk(t, 0.98, 0.18, 0.95, 1.08, hueSpin * 0.26);
  if (idx == 3) return hueWalk(t, 0.68, 0.30, 0.95, 1.05, hueSpin * 0.30);
  if (idx == 4) return hueWalk(t, 0.35, 0.42, 0.92, 1.05, hueSpin * 0.34);
  if (idx == 5) return hueWalk(t, 0.52, -0.50, 0.98, 1.08, hueSpin * 0.38);
  if (idx == 6) return hueWalk(t, 0.70, 0.28, 0.95, 1.05, hueSpin * 0.30);
  if (idx == 7) return hueWalk(t, 0.55, 0.10, mix(0.85, 0.20, t), mix(0.75, 1.1, t), hueSpin * 0.14);
  // cos(2π·1·(t+hueSpin)) — hueSpin is periodic here too, same seam-free guarantee.
  // Full Spectrum keeps the full spin so it genuinely tours the whole wheel.
  return iqPalette(vec3(0.55), vec3(0.50), vec3(1.0), vec3(0.0, 0.33, 0.67), t + hueSpin);
}

vec3 paletteAt(int idx, float t) {
  return paletteAt(idx, t, 0.0);
}

vec3 palette(float t) {
  return paletteAt(u_palette, clamp(t, 0.0, 1.0));
}

// trapRaw is gOrbit — a smooth/fractional escape-iteration count in [0,1] on fractals
// that write it (mandelbulb, mandelbox), or the untouched sentinel (1e5) on ones that don't.
// hasTrap gates it out cleanly instead of polluting phase with the sentinel value.
float formPhase(vec3 p, float ao, float tHit, float trapRaw) {
  float r = length(p);
  float hasTrap = step(trapRaw, 1000.0);
  float trap = hasTrap * clamp(trapRaw, 0.0, 1.0);

  // Smooth escape trap dominates where available — it is continuous even where
  // p/normals jump at fold boundaries. Without it, fall back to the old form-locked mix.
  float wTrap  = 0.55 * hasTrap;
  float wAo    = mix(0.35, 0.20, hasTrap);
  float wDepth = mix(0.35, 0.15, hasTrap);
  float wY     = mix(0.30, 0.10, hasTrap);

  // Depth range scales with camera distance so the visible object's hit-distance
  // spread lands in the useful part of the ramp at any zoom level, instead of
  // clustering near one end (which read as "solid colour").
  float t = 0.0;
  t += wTrap * trap;
  t += wAo * (1.0 - ao);
  t += wDepth * smoothstep(u_zoom * 0.25, u_zoom * 1.35, tHit);
  t += wY * smoothstep(-1.6, 1.6, p.y);
  return clamp(t, 0.0, 1.0);
}

vec3 surfaceTint(vec3 p, vec3 nor, float ao, float tHit, float trapRaw, out float phaseOut, out float hueSpinOut) {
  float t = formPhase(p, ao, tHit, trapRaw);
  phaseOut = t;
  // Raymarched near-boundary points cluster the escape trap near 1.0 (that's
  // inherent to hitting an iso-surface, not a bug) — which flattened Full Spectrum
  // and starved themed palettes of variety. Spin hue through a few extra smooth
  // laps from local surface detail to restore strong gradients, fully seam-free
  // (see hueWalk). AO is available on every fractal, so this isn't limited to the
  // two that write a trap — it's universal.
  float hasTrap = step(trapRaw, 1000.0);
  float trapVal = clamp(trapRaw, 0.0, 1.0);
  float spinSrc = mix(1.0 - ao, trapVal, hasTrap);
  float hueSpin = fract(spinSrc * 6.0);
  hueSpinOut = hueSpin;
  vec3 a = paletteAt(u_palette, t, hueSpin);
  vec3 b = paletteAt(u_palette, clamp(t + 0.08, 0.0, 1.0), hueSpin);
  return mix(a, b, 0.30);
}


float rayMarch(vec3 ro, vec3 rd, out int steps) {
  float t = 0.001;
  steps = 0;
  int limit = int(u_maxSteps + 0.5);
  if (limit < 40) limit = 40;
  if (limit > MAX_STEPS) limit = MAX_STEPS;
  
  for (int i = 0; i < MAX_STEPS; i++) {
    if (i >= limit) break;
    steps = i;
    float d = sceneSDE(ro + rd * t);
    if (d < MIN_DIST * t) break;
    if (t > MAX_DIST) { t = MAX_DIST + 1.0; break; }
    t += d * 0.85;
  }
  return t;
}

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * u_res) / u_res.y;
  mat3 camRot = mRotY(u_rotY) * mRotX(u_rotX);
  vec3 ro = camRot * vec3(0, 0, u_zoom) + vec3(u_pan, 0);
  vec3 rd = camRot * normalize(vec3(uv, -u_fov));
  int steps;
  float t = rayMarch(ro, rd, steps);
  vec3 col = vec3(0);
  if (t < MAX_DIST) {
    vec3 p = ro + rd * t;
    vec3 nor = calcNormal(p, t);
    float ao = calcAO(p, nor);

    // calcNormal/calcAO's probe samples overwrite gOrbit — re-evaluate once more
    // at the exact hit point so the trap reading matches this pixel's surface.
    gOrbit = 1e5;
    sceneSDE(p);
    float trapRaw = gOrbit;

    vec3 lig1 = normalize(vec3(0.75, 0.55, 0.4));
    vec3 lig2 = normalize(vec3(-0.55, 0.35, 0.75));
    float dif1 = clamp(dot(nor, lig1), 0.0, 1.0);
    float dif2 = clamp(dot(nor, lig2), 0.0, 1.0);
    float sha = u_softShadow > 0.5 ? softShadow(p, lig1, 0.02, 4.0, 12.0) : 1.0;
    float fres = pow(1.0 - abs(dot(nor, -rd)), 2.8);

    float phase;
    float hueSpin;
    vec3 baseCol = surfaceTint(p, nor, ao, t, trapRaw, phase, hueSpin);
    vec3 rimCol = paletteAt(u_palette, clamp(phase + 0.12, 0.0, 1.0), hueSpin);

    float edge = pow(1.0 - abs(dot(nor, normalize(-p + vec3(0.001)))), 2.8);
    float key = dif1 * sha;
    float fill = dif2 * 0.42;
    float amb = 0.16;
    float lum = amb + 0.85 * key + fill;
    col = baseCol * lum;
    col += fill * baseCol * 0.22;
    col += fres * rimCol * (0.5 + 0.85 * u_bright);
    col += edge * rimCol * 0.16;
    col *= mix(0.72, 1.0, ao);
    vec3 halfV = normalize(lig1 - rd);
    float spec = pow(max(dot(nor, halfV), 0.0), 36.0);
    col += spec * (0.85 + 0.55 * u_bright) * mix(vec3(1.0), rimCol, 0.55) * sha;
    col = mix(col, vec3(0.0, 0.002, 0.01), clamp(t / MAX_DIST * 1.15 * u_fog, 0.0, 1.0));
  } else {
    float sn = fract(sin(dot(rd.xy * 400.0, vec2(127.1, 311.7))) * 43758.5);
    float sn2 = fract(sin(dot(rd.yz * 300.0, vec2(269.5, 183.3))) * 43758.5);
    float star = step(0.994, sn) * step(0.99, sn2);
    col = vec3(0.0, 0.002, 0.01) + star * 1.0 * palette(rd.x + rd.y + u_time * 0.02);
    col += palette(length(rd.xy) * 0.4 + u_time * 0.04) * 0.035 * (0.5 + 0.5 * sin(rd.x * 3.0 + u_time * 0.15));
  }
  vec2 vUV = gl_FragCoord.xy / u_res;
  float vig = pow(16.0 * vUV.x * vUV.y * (1.0 - vUV.x) * (1.0 - vUV.y), 0.15 * u_vignette);
  col *= vig;
  col = pow(max(col, 0.0), vec3(u_gamma));
  gl_FragColor = vec4(col, 1.0);
}
