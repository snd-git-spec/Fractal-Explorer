// Kleinian Group — box-fold + sphere inversion × scale.
// Plane-led DE = corridors/webs (Mandelbox stays the cubic sponge).
// S = ⋃_k sc^k · K — same corridor web at every size (inward + outward).

float sdeKleinian(vec3 p, float scale, float cs, float minR, float maxR, int iters) {
  float DEf = 1.0;
  vec3 off = vec3(scale - 1.0, (scale - 1.0) * 0.9, (scale - 1.0) * 0.5);
  float orbit = 0.0;
  float ow = 1.0;

  for (int i = 0; i < 14; i++) {
    if (i >= iters) break;

    p = clamp(p, -cs, cs) * 2.0 - p;

    float r2 = dot(p, p);
    float mn2 = minR * minR;
    float mx2 = maxR * maxR;
    if (r2 < mn2) {
      float k = mx2 / mn2;
      p *= k;
      DEf *= k;
    } else if (r2 < mx2) {
      float k = mx2 / r2;
      p *= k;
      DEf *= k;
    }

    p = p * scale - off;
    DEf *= abs(scale);

    if (DEf > 600.0) {
      p *= 600.0 / DEf;
      DEf = 600.0;
      break;
    }

    float r = length(p);
    float face = max(abs(p.x), max(abs(p.y), abs(p.z)));
    orbit += ow * (0.55 * exp(-r * 1.05) + 0.45 * exp(-face * 1.3));
    ow *= 0.72;
  }

  gOrbit = clamp(orbit * 0.55, 0.0, 1.0);

  float dPln = abs(p.z) / max(DEf, 1e-4);
  float dSph = abs(length(p) - abs(scale - 1.0)) / max(DEf, 1e-4);
  return 0.7 * mix(dSph, dPln, 0.78);
}

float sceneSDE(vec3 p) {
  int it = int(u_iter);
  if (it > 11) it = 11;
  if (it < 5) it = 5;

  // Architectural band (avoids foam collapse above ~2.2)
  float sc = mix(1.55, 2.0, clamp((u_power - 2.5) / 12.0, 0.0, 1.0));
  float cs = mix(0.85, 1.15, clamp((u_bailout - 1.0) / 5.0, 0.0, 1.0));
  vec2 j = abs(clamp(u_jc, vec2(-1.0), vec2(1.0)));
  float minR = mix(0.22, 0.38, j.x);
  float maxR = mix(0.55, 0.88, j.y);

  float k = 0.9;
  p *= k;

  // Full self-similarity: fold any point into shell [R, R·sc)
  // so measuring K once = every scaled copy of K to ∞ (zoom out and in).
  float R = 1.35;
  float scale = 1.0;
  for (int i = 0; i < 16; i++) {
    float r = length(p);
    if (r >= R * sc) {
      p /= sc;
      scale *= sc;
    } else if (r < R) {
      p *= sc;
      scale /= sc;
    } else {
      break;
    }
  }

  float deep = clamp(log(1.0 / max(scale, 1e-4)) / log(sc), 0.0, 4.0);
  it = int(min(float(it) + deep, 14.0));

  return sdeKleinian(p, sc, cs, minR, maxR, it) * scale / k;
}
