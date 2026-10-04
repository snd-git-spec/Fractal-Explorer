// Knighty KIFS — octahedral IFS (kleinian-ifs core) + mild post-fold twist for morph.
// Proven DE: running length shell + DEf cap. No pre-fold rotation (breaks the estimator).

float sdeKIFS(vec3 p, float scale, float twist, int iters) {
  float DEf = 1.0;
  float orbit = 0.0;
  float faceAcc = 0.0;
  float ow = 1.0;
  float off = scale - 1.0;
  float ct = cos(twist), st = sin(twist);

  for (int i = 0; i < 16; i++) {
    if (i >= iters) break;

    p = abs(p);
    if (p.x < p.y) { float t = p.x; p.x = p.y; p.y = t; }
    if (p.x < p.z) { float t = p.x; p.x = p.z; p.z = t; }
    if (p.y < p.z) { float t = p.y; p.y = p.z; p.z = t; }

    // Post-fold twist only — pre-fold rotation empties / shreds the DE
    float y = p.y;
    p.y = ct * y - st * p.z;
    p.z = st * y + ct * p.z;

    p = p * scale - vec3(off, 0.0, 0.0);
    if (p.z < -0.5 * off) p.z += off;
    DEf *= scale;

    if (DEf > 850.0) {
      p *= 850.0 / DEf;
      DEf = 850.0;
      break;
    }

    float r = length(p);
    float face = max(p.x, max(p.y, p.z));
    orbit += ow * (0.55 * exp(-r * 1.1) + 0.45 * exp(-face * 1.4));
    faceAcc += ow * (p.x >= p.y && p.x >= p.z ? 0.14 : (p.y >= p.z ? 0.46 : 0.80));
    ow *= 0.70;
  }

  gOrbit = clamp(orbit * 0.55, 0.0, 1.0);
  gFace = clamp(faceAcc * 0.92, 0.0, 1.0);

  return 0.5 * (length(p) - 0.35) / max(DEf, 1e-4);
}

float sceneSDE(vec3 p) {
  gFormLock = 0.0;
  gIsoShade = 0.0;

  int it = int(u_iter);
  if (it > 14) it = 14;
  if (it < 7) it = 7;

  float sc = clamp(u_power * 0.06 + 1.8 + u_jc.x * 0.05, 1.72, 2.22);
  float twist = clamp(u_jc.y, -1.0, 1.0) * 0.22;

  vec3 q = mod(p * 0.5 + 0.5, 1.0) * 2.0 - 1.0;

  return sdeKIFS(q, sc, twist, it) * 0.5;
}
