// Tidefold — clean Surf→Menger hybrid, infinite across scales.
// Complexity from deeper Surf folds + more Menger depth — not map-lerping
// (that reads as grainy foam). Soft narrow handoff keeps morph continuous.

vec3 rotY3(vec3 z, float a) {
  float c = cos(a), s = sin(a);
  return vec3(c * z.x + s * z.z, z.y, -s * z.x + c * z.z);
}

vec3 asurfStep(vec3 z, float surfSc, float add, float twist, vec3 c, inout float Dd) {
  z.x = clamp(z.x, -1.0, 1.0) * 2.0 - z.x;
  z.y = clamp(z.y, -1.0, 1.0) * 2.0 - z.y;
  z.z = clamp(z.z, -1.45, 1.45) * 2.0 - z.z;

  z = rotY3(z, twist);

  float rr = dot(z, z);
  if (rr < 0.001) {
    float k = 1.0 / 0.001;
    z *= k;
    Dd *= k;
  } else if (rr < 1.0) {
    float k = 1.0 / rr;
    z *= k;
    Dd *= k;
  }

  z = z * surfSc - vec3(add, add, 1.0) * (surfSc - 1.0);
  z += c;
  Dd = Dd * abs(surfSc) + 1.0;
  return z;
}

vec3 mengerStep(vec3 z, float mengerSc, inout float Dd) {
  z = abs(z);
  if (z.x < z.y) z.xy = z.yx;
  if (z.x < z.z) z.xz = z.zx;
  if (z.y < z.z) z.yz = z.zy;
  z = z * mengerSc - vec3(mengerSc - 1.0);
  if (z.z < -0.5 * (mengerSc - 1.0)) z.z += (mengerSc - 1.0);
  Dd *= mengerSc;
  return z;
}

float sdeAsurfMenger(
  vec3 pos,
  float surfSc,
  float add,
  float twist,
  float mengerSc,
  float juliaAmp,
  vec2 jc,
  float handoff,
  int iters
) {
  vec3 z = pos;
  float Dd = 1.0;
  float orbit = 0.0;
  float faceAcc = 0.0;
  float ow = 1.0;
  vec3 c = vec3(jc.x, jc.y, -jc.x * 0.25 - jc.y * 0.15) * juliaAmp;

  for (int i = 0; i < 24; i++) {
    if (i >= iters) break;

    // Narrow soft handoff — one transform per step (no dual-map foam)
    float wM = smoothstep(handoff - 0.5, handoff + 0.5, float(i));

    if (wM < 0.02) {
      z = asurfStep(z, surfSc, add, twist, c, Dd);
    } else if (wM > 0.98) {
      z = mengerStep(z, mengerSc, Dd);
    } else {
      // Only the single boundary iter blends — keeps morph continuous, not grainy
      float DdS = Dd;
      float DdM = Dd;
      vec3 zS = asurfStep(z, surfSc, add, twist, c, DdS);
      vec3 zM = mengerStep(z, mengerSc, DdM);
      z = mix(zS, zM, wM);
      Dd = mix(DdS, DdM, wM);
    }

    vec3 a = abs(z);
    float face = max(a.x, max(a.y, a.z));
    float faceSel = a.x >= a.y && a.x >= a.z ? 0.12 : (a.y >= a.z ? 0.48 : 0.8);
    vec2 fuv = a.x >= a.y && a.x >= a.z ? a.yz : (a.y >= a.z ? a.xz : a.xy);
    float crease =
      exp(-abs(a.x - a.y) * 3.0) +
      exp(-abs(a.y - a.z) * 3.0) +
      exp(-abs(a.x - a.z) * 3.0);
    float faceSamp =
      faceSel * 0.5 +
      (0.5 + 0.5 * sin(fuv.x * 1.15)) * 0.25 +
      (0.5 + 0.5 * sin(fuv.y * 1.05)) * 0.25;

    orbit += ow * (0.4 * exp(-face * 1.6) + 0.35 * faceSamp + 0.25 * (1.0 - exp(-crease)));
    faceAcc += ow * faceSamp;
    ow *= 0.7;

    if (length(z) > 28.0) break;
    if (Dd > 1e4) {
      z *= 1e4 / Dd;
      Dd = 1e4;
      break;
    }
  }

  gOrbit = clamp(orbit * 0.65, 0.0, 1.0);
  gFace = clamp(faceAcc * 0.8, 0.0, 1.0);
  return 0.5 * length(z) / max(Dd, 1e-4);
}

float sceneSDE(vec3 p) {
  int it = int(u_iter);
  if (it > 18) it = 18;
  if (it < 12) it = 12;

  float tPow = clamp((u_power - 2.5) / 12.0, 0.0, 1.0);
  float tBail = clamp((u_bailout - 1.0) / 5.0, 0.0, 1.0);
  vec2 j = clamp(u_jc, vec2(-1.15), vec2(1.15));

  // Clean architectural band — readable caverns + sponge (not foam)
  float surfSc = mix(1.06, 1.2, tPow);
  float add = mix(0.96, 1.08, tBail);
  float twist = 1.5707963 + j.y * 0.32;
  float mengerSc = mix(2.95, 3.2, tBail);
  float juliaAmp = mix(0.06, 0.16, 0.5 + j.x * 0.2 + tPow * 0.15);

  // Enough Surf layers, then deep Menger for complexity without noise
  float handoff = mix(3.5, 6.5, clamp(0.5 + j.x * 0.35, 0.0, 1.0));

  const float sc = 3.0;
  float k = 0.72;
  p *= k;

  float R = 1.0 / sc;
  float scale = 1.0;
  for (int i = 0; i < 14; i++) {
    float m = max(abs(p.x), max(abs(p.y), abs(p.z)));
    if (m >= R * sc) {
      p /= sc;
      scale *= sc;
    } else if (m < R) {
      p *= sc;
      scale /= sc;
    } else {
      break;
    }
  }

  return sdeAsurfMenger(
    p,
    surfSc,
    add,
    twist,
    mengerSc,
    juliaAmp,
    j,
    handoff,
    it
  ) * scale / k;
}
