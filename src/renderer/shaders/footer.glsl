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
    // Never hard-black — foam fractals (Kali etc.) speckled when shadow rays nick neighbours
    if (h < 0.001) return 0.22;
    res = min(res, k * h / t);
    t += clamp(h, 0.02, 0.25);
    if (t > maxt) break;
  }
  return clamp(res, 0.22, 1.0);
}

vec3 iqPalette(vec3 a, vec3 b, vec3 c, vec3 d, float t) {
  return clamp(a + b * cos(6.2831853 * (c * t + d)), 0.0, 1.35);
}

vec3 hsv2rgb(vec3 c) {
  vec3 rgb = clamp(abs(mod(c.x * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
  return c.z * mix(vec3(1.0), rgb, c.y);
}

// Colour model — form-locked with wide hue dynamics (smooth, no grain).
vec3 hueWalk(float t, float h0, float span, float sat, float val, float hueSpin) {
  t = clamp(t, 0.0, 1.0);
  float h = fract(h0 + span * t + hueSpin);
  float s = sat * (0.78 + 0.22 * sin(t * 3.14159265));
  float v = val * (0.82 + 0.22 * t);
  return hsv2rgb(vec3(h, clamp(s, 0.0, 1.0), clamp(v, 0.0, 1.25)));
}

vec3 paletteAt(int idx, float t, float hueSpin) {
  t = clamp(t, 0.0, 1.0);
  // Wide spans so surfaces actually tour distinct hues (not one-tint washes)
  if (idx == 0) return hueWalk(t, 0.52, 0.62, 0.98, 1.08, hueSpin * 0.72);
  if (idx == 1) return hueWalk(t, 0.78, -0.78, 1.0, 1.08, hueSpin * 0.78);
  if (idx == 2) return hueWalk(t, 0.96, 0.48, 0.98, 1.1, hueSpin * 0.65);
  if (idx == 3) return hueWalk(t, 0.62, 0.55, 0.98, 1.08, hueSpin * 0.7);
  if (idx == 4) return hueWalk(t, 0.32, 0.68, 0.95, 1.08, hueSpin * 0.75);
  if (idx == 5) return hueWalk(t, 0.48, -0.72, 1.0, 1.1, hueSpin * 0.8);
  if (idx == 6) return hueWalk(t, 0.68, 0.52, 0.98, 1.08, hueSpin * 0.7);
  if (idx == 7) return hueWalk(t, 0.52, 0.28, mix(0.75, 0.35, t), mix(0.7, 1.15, t), hueSpin * 0.45);
  // Full Spectrum — entire wheel + strong spin
  return iqPalette(vec3(0.55), vec3(0.55), vec3(1.0), vec3(0.0, 0.33, 0.67), t + hueSpin);
}

vec3 paletteAt(int idx, float t) {
  return paletteAt(idx, t, 0.0);
}

vec3 palette(float t) {
  return paletteAt(u_palette, clamp(t, 0.0, 1.0));
}

// Face id + low-freq wash — smooth, but enough separation for hue bands
float faceFromNormal(vec3 p, vec3 nor) {
  vec3 an = abs(nor);
  vec2 uv;
  float faceSel;
  if (an.x >= an.y && an.x >= an.z) {
    uv = p.yz;
    faceSel = 0.08 + 0.14 * step(0.0, nor.x);
  } else if (an.y >= an.z) {
    uv = p.xz;
    faceSel = 0.36 + 0.14 * step(0.0, nor.y);
  } else {
    uv = p.xy;
    faceSel = 0.68 + 0.14 * step(0.0, nor.z);
  }
  float s = mix(0.7, 2.2, clamp((2.5 - u_zoom) / 2.5, 0.0, 1.0));
  float u = 0.5 + 0.5 * sin(uv.x * s);
  float v = 0.5 + 0.5 * sin(uv.y * s * 0.85 + uv.x * s * 0.25);
  float dom = max(an.x, max(an.y, an.z));
  float crease = 1.0 - clamp((dom - 0.55) / 0.45, 0.0, 1.0);
  return fract(faceSel + u * 0.35 + v * 0.28 + crease * 0.18);
}

float formPhase(vec3 p, float ao, float tHit, float trapRaw, float faceRaw, vec3 nor) {
  float hasTrap = step(trapRaw, 1000.0);
  float hasFace = step(faceRaw, 1000.0);
  float trap = clamp(trapRaw, 0.0, 1.0);
  float faceFld = clamp(faceRaw, 0.0, 1.0);
  float faceN = faceFromNormal(p, nor);

  // Expand soft traps so they use the full palette, not a mid-grey band
  trap = pow(trap, 0.62);
  faceFld = pow(faceFld, 0.7);

  // Two smooth bands: depth trap + face field → wide hue separation across form
  float depthBand = mix(faceN, trap, hasTrap);
  float faceBand = mix(faceN, faceFld, hasFace);
  float surf = fract(depthBand * 0.72 + faceBand * 0.95 + (1.0 - ao) * 0.12);

  // Remap into a lively mid-to-full range (still continuous — no stipple)
  surf = clamp(surf * 1.15, 0.0, 1.0);

  float fallback = clamp(
    fract(
      faceN * 0.85 +
        0.35 * smoothstep(u_zoom * 0.15, u_zoom * 1.6, tHit) +
        0.25 * smoothstep(-2.0, 2.0, p.y)
    ),
    0.0,
    1.0
  );

  return mix(fallback, surf, max(hasTrap, hasFace));
}

vec3 surfaceTint(vec3 p, vec3 nor, float ao, float tHit, float trapRaw, float faceRaw, out float phaseOut, out float hueSpinOut) {
  float t = formPhase(p, ao, tHit, trapRaw, faceRaw, nor);
  phaseOut = t;
  float hasTrap = step(trapRaw, 1000.0);
  float hasFace = step(faceRaw, 1000.0);
  float trap = pow(clamp(trapRaw, 0.0, 1.0), 0.62);
  float faceFld = pow(clamp(faceRaw, 0.0, 1.0), 0.7);
  float faceN = faceFromNormal(p, nor);

  // Strong form-driven spin — different faces/depths land in different palette regions
  float spinSrc = mix(faceN, mix(trap, faceFld, hasFace * 0.55), max(hasTrap, hasFace));
  float hueSpin = fract(spinSrc * 2.6 + u_colorShift * 0.95 + t * 0.45);
  hueSpinOut = hueSpin;

  // Wide chord across the palette for living surface colour
  vec3 a = paletteAt(u_palette, t, hueSpin);
  vec3 b = paletteAt(u_palette, fract(t + 0.22), hueSpin);
  vec3 c = paletteAt(u_palette, fract(t + 0.48), hueSpin * 0.85);
  return mix(mix(a, b, 0.4), c, 0.22);
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
    // Safer step — thin Kali/IFS sheets were overshot into black miss holes
    t += d * 0.72;
  }
  return t;
}

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * u_res) / u_res.y;
  mat3 camRot = mRotY(u_rotY) * mRotX(u_rotX) * mRotZ(u_rotZ);
  vec3 ro = camRot * vec3(0, 0, u_zoom) + vec3(u_pan, 0);
  vec3 rd = camRot * normalize(vec3(uv, -u_fov));
  int steps;
  float t = rayMarch(ro, rd, steps);
  vec3 col = vec3(0);
  if (t < MAX_DIST) {
    vec3 p = ro + rd * t;
    vec3 nor = calcNormal(p, t);
    float ao = calcAO(p, nor);

    // calcNormal/calcAO's probe samples overwrite gOrbit/gFace — re-evaluate once
    // at the exact hit point so colour matches this pixel's surface.
    gOrbit = 1e5;
    gFace = 1e5;
    sceneSDE(p);
    float trapRaw = gOrbit;
    float faceRaw = gFace;

    vec3 lig1 = normalize(vec3(0.75, 0.55, 0.4));
    vec3 lig2 = normalize(vec3(-0.55, 0.35, 0.75));
    float dif1 = clamp(dot(nor, lig1), 0.0, 1.0);
    float dif2 = clamp(dot(nor, lig2), 0.0, 1.0);
    float sha = u_softShadow > 0.5 ? softShadow(p, lig1, 0.02, 4.0, 12.0) : 1.0;
    float fres = pow(1.0 - abs(dot(nor, -rd)), 2.8);

    float phase;
    float hueSpin;
    vec3 baseCol = surfaceTint(p, nor, ao, t, trapRaw, faceRaw, phase, hueSpin);
    vec3 rimCol = paletteAt(u_palette, clamp(phase + 0.12, 0.0, 1.0), hueSpin);

    float key = dif1 * sha;
    float fill = dif2 * 0.42;
    float amb = 0.16;
    float lum = amb + 0.85 * key + fill;

    if (gIsoShade > 0.5) {
      // Isolines: thin contour bands of orbit depth + radius (topo on the solid)
      float trap = clamp(trapRaw, 0.0, 1.0);
      float rad = length(p);
      float field = trap * 0.72 + fract(rad * 0.35 + phase * 0.15) * 0.28;
      float bands = 18.0;
      float saw = abs(fract(field * bands) * 2.0 - 1.0);
      float line = 1.0 - smoothstep(0.0, 0.22, saw);
      line = pow(line, 1.35);

      vec3 lineCol = mix(rimCol, vec3(1.1, 1.08, 1.02), 0.3) * (0.8 + 0.65 * u_bright);
      vec3 body = mix(vec3(0.012, 0.014, 0.02), baseCol * 0.14, 0.4) * (0.25 + 0.4 * ao);
      col = body * (0.4 + 0.45 * lum);
      col = mix(col, lineCol, line);
      col += fres * rimCol * 0.12;
      col = mix(col, vec3(0.0, 0.002, 0.01), clamp(t / MAX_DIST * 1.15 * u_fog, 0.0, 1.0));
    } else {
      float edge = pow(1.0 - abs(dot(nor, normalize(-p + vec3(0.001)))), 2.8);
      col = baseCol * lum;
      col += fill * baseCol * 0.22;
      col += fres * rimCol * (0.5 + 0.85 * u_bright);
      col += edge * rimCol * 0.16;
      col *= mix(0.82, 1.0, ao);
      vec3 halfV = normalize(lig1 - rd);
      float spec = pow(max(dot(nor, halfV), 0.0), 36.0);
      col += spec * (0.85 + 0.55 * u_bright) * mix(vec3(1.0), rimCol, 0.55) * sha;
      col = mix(col, vec3(0.0, 0.002, 0.01), clamp(t / MAX_DIST * 1.15 * u_fog, 0.0, 1.0));
    }
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
