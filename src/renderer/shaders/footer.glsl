// Tetrahedral normals — 4 SDE samples instead of 6
vec3 calcNormal(vec3 p) {
  float e = 0.0012;
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

// Smooth 5-stop RGB paths — Hermite between neighbouring stops only.
// No HSV wrap, no fract(), no step-count noise. Jumping came from discontinuous `t`
// and complementary stops landing on adjacent pixels (violet|lime → bronze mud).
float hermite(float x) {
  x = clamp(x, 0.0, 1.0);
  return x * x * (3.0 - 2.0 * x);
}

vec3 blendStops(vec3 s0, vec3 s1, vec3 s2, vec3 s3, vec3 s4, float t) {
  // Map [0,1] onto 4 segments without hitting a phantom 5th at t=1
  float x = clamp(t, 0.0, 1.0) * 3.9999;
  float seg = floor(x);
  float u = hermite(x - seg);
  if (seg < 1.0) return mix(s0, s1, u);
  if (seg < 2.0) return mix(s1, s2, u);
  if (seg < 3.0) return mix(s2, s3, u);
  return mix(s3, s4, u);
}

vec3 paletteAt(int idx, float t) {
  // Stops match PALETTES swatches in types.ts (+ vivid mid bridges so RGB lerp stays neon)
  if (idx == 0) {
    // Hyper Cyan — cyan → indigo → violet → magenta → hot pink
    return blendStops(
      vec3(0.00, 0.83, 1.00), vec3(0.25, 0.45, 1.00), vec3(0.63, 0.47, 1.00),
      vec3(1.00, 0.25, 0.82), vec3(1.00, 0.55, 0.85), t);
  } else if (idx == 1) {
    // Alien Acid — violet → pink → orange → gold → lime (path through warm, not complement leap)
    return blendStops(
      vec3(0.77, 0.30, 1.00), vec3(1.00, 0.35, 0.78), vec3(1.00, 0.60, 0.25),
      vec3(1.00, 0.90, 0.18), vec3(0.66, 1.00, 0.18), t);
  } else if (idx == 2) {
    // Solar Flare — deep red → ember → amber → gold → pale gold
    return blendStops(
      vec3(1.00, 0.10, 0.00), vec3(1.00, 0.35, 0.05), vec3(1.00, 0.60, 0.10),
      vec3(1.00, 0.85, 0.25), vec3(1.00, 0.95, 0.70), t);
  } else if (idx == 3) {
    // Nebula Bleed — indigo → purple → magenta → coral → peach
    return blendStops(
      vec3(0.42, 0.19, 1.00), vec3(0.70, 0.20, 1.00), vec3(1.00, 0.24, 0.60),
      vec3(1.00, 0.45, 0.30), vec3(1.00, 0.69, 0.25), t);
  } else if (idx == 4) {
    // Aurora Drift — green → teal → cyan → blue → violet
    return blendStops(
      vec3(0.18, 1.00, 0.55), vec3(0.15, 0.95, 0.85), vec3(0.19, 0.88, 1.00),
      vec3(0.35, 0.45, 1.00), vec3(0.69, 0.25, 1.00), t);
  } else if (idx == 5) {
    // Prism Slash — cyan → green → yellow → orange → red
    return blendStops(
      vec3(0.00, 0.91, 1.00), vec3(0.25, 1.00, 0.40), vec3(1.00, 0.88, 0.13),
      vec3(1.00, 0.45, 0.15), vec3(1.00, 0.13, 0.25), t);
  } else if (idx == 6) {
    // Void Orchid — purple → rose → pink → peach → amber
    return blendStops(
      vec3(0.82, 0.25, 1.00), vec3(1.00, 0.30, 0.70), vec3(1.00, 0.38, 0.56),
      vec3(1.00, 0.65, 0.40), vec3(1.00, 0.75, 0.19), t);
  } else {
    // Ice Phantom — deep blue → sky → pale cyan → soft lilac → white-lilac
    return blendStops(
      vec3(0.19, 0.38, 1.00), vec3(0.40, 0.70, 1.00), vec3(0.56, 0.82, 1.00),
      vec3(0.78, 0.75, 1.00), vec3(0.92, 0.88, 1.00), t);
  }
}

vec3 palette(float t) {
  return paletteAt(u_palette, clamp(t, 0.0, 1.0));
}

// Triangle-wave phase (asin(sin)) — equal time in every palette stop.
// Plain sin() dwells at peaks → big flat colour blocks with abrupt mid jumps.
vec3 surfaceTint(vec3 p, vec3 nor, float ct, float tHit) {
  float dist = max(tHit, 0.25);
  // Aggressive enough that a close-up still walks most of the profile
  float freq = clamp(4.2 / dist, 1.6, 8.0);
  float shift = u_colorShift * 6.2831853;
  float wave = dot(p, vec3(1.15, 0.78, 0.98)) * freq
             + dot(p, vec3(-0.72, 1.05, 0.52)) * freq * 0.7
             + nor.y * 1.1
             + shift;
  float t = asin(clamp(sin(wave), -1.0, 1.0)) / 3.14159265 + 0.5;
  return paletteAt(u_palette, clamp(t, 0.0, 1.0));
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
    vec3 nor = calcNormal(p);
    float ao = calcAO(p, nor);
    // Warm key + cool cyan fill — neon sci-fi split
    vec3 lig1 = normalize(vec3(0.75, 0.55, 0.4));
    vec3 lig2 = normalize(vec3(-0.55, 0.35, 0.75));
    float dif1 = clamp(dot(nor, lig1), 0.0, 1.0);
    float dif2 = clamp(dot(nor, lig2), 0.0, 1.0);
    float sha = u_softShadow > 0.5 ? softShadow(p, lig1, 0.02, 4.0, 12.0) : 1.0;
    float fres = pow(1.0 - abs(dot(nor, -rd)), 2.8);
    float stepNorm = max(u_maxSteps, 1.0);
    float ct = pow(float(steps) / stepNorm, 0.5);
    vec3 baseCol = surfaceTint(p, nor, ct, t);
    vec3 rimCol = surfaceTint(p + nor * 0.25, nor, ct + 0.18, t);
    float edge = pow(1.0 - abs(dot(nor, normalize(-p + vec3(0.001)))), 2.8);
    float key = dif1 * sha;
    float fill = dif2 * 0.42;
    float amb = 0.10;
    float lum = amb + 0.9 * key + fill;
    // Multiply albedo by light — never lerp toward grey (that killed chroma / made bronze mud)
    col = baseCol * lum;
    col += fill * baseCol * 0.2;
    col += fres * rimCol * (0.5 + 0.85 * u_bright);
    col += edge * rimCol * 0.14;
    col *= mix(0.68, 1.0, ao);
    vec3 halfV = normalize(lig1 - rd);
    float spec = pow(max(dot(nor, halfV), 0.0), 36.0);
    col += spec * (0.75 + 0.5 * u_bright) * mix(vec3(1.0), rimCol, 0.55) * sha;
    // Deep void fog — eased so mid-distance stays coloured
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
