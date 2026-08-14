// Kleinian-style IFS — recursive box-fold × sphere inversion (Mandelbox family).
// Sparse + grand: high scale opens monumental voids; L∞ shells tile forever.

float sdeKleinian(vec3 p, float scale, float fold, float minR, float fixedR, int iters) {
  float DEf = 1.0;
  vec3 offset = p;
  float orbit = 0.0;
  float faceAcc = 0.0;
  float ow = 1.0;
  float mn2 = minR * minR;
  float fx2 = fixedR * fixedR;

  for (int i = 0; i < 18; i++) {
    if (i >= iters) break;

    p = clamp(p, -fold, fold) * 2.0 - p;

    float r2 = dot(p, p);
    if (r2 < mn2) {
      float k = fx2 / mn2;
      p *= k;
      DEf *= k;
    } else if (r2 < fx2) {
      float k = fx2 / r2;
      p *= k;
      DEf *= k;
    }

    p = p * scale + offset;
    DEf = DEf * abs(scale) + 1.0;

    float rEnd = length(p);
    if (DEf > 1e5 || rEnd > 100.0) break;

    float face = max(abs(p.x), max(abs(p.y), abs(p.z)));
    orbit += ow * (0.5 * exp(-rEnd * 0.75) + 0.5 * exp(-face * 0.9));
    faceAcc += ow * (0.2 + 0.8 * smoothstep(0.0, 3.0, face));
    ow *= 0.7;
  }

  gOrbit = clamp(orbit * 0.55, 0.0, 1.0);
  gFace = clamp(faceAcc * 0.85, 0.0, 1.0);

  // Slightly thick DE — sparse beams still read as solid architecture
  return 0.62 * (length(p) - abs(scale - 1.0)) / max(abs(DEf), 1e-4);
}

float sceneSDE(vec3 p) {
  int it = int(u_iter);
  if (it > 14) it = 14;
  if (it < 6) it = 6;

  // Sparse grand band — high scale = vast voids between recursive ribs
  float tPow = clamp((u_power - 2.5) / 12.0, 0.0, 1.0);
  float tBail = clamp((u_bailout - 1.0) / 5.0, 0.0, 1.0);
  float sc = mix(2.15, 2.95, tPow);
  float fold = mix(1.15, 1.55, tBail);

  vec2 j = clamp(u_jc, vec2(-0.9), vec2(0.9));
  // Larger sphere-fold cavity → emptier halls
  float minR = mix(0.22, 0.48, 0.5 + 0.5 * j.x);
  float fixedR = mix(1.05, 1.45, 0.5 + 0.5 * j.y);
  fixedR = max(fixedR, minR + 0.45);

  vec3 q = p + vec3(j.x, j.y, -j.x * 0.25 + j.y * 0.15) * 0.16;

  // Smaller world shrink → bigger, more monumental solid in frame
  float k = 1.55;
  q *= k;

  // Wide shells — generations feel like vast nested chambers
  float Rfill = mix(2.2, 3.1, tPow);
  float R = Rfill / sc;
  float gen = 1.0;
  for (int i = 0; i < 16; i++) {
    float m = max(abs(q.x), max(abs(q.y), abs(q.z)));
    if (m >= R * sc) {
      q /= sc;
      gen *= sc;
    } else if (m < R) {
      q *= sc;
      gen /= sc;
    } else {
      break;
    }
  }

  float deep = clamp(log(1.0 / max(gen, 1e-4)) / log(sc), 0.0, 4.0);
  it = int(min(float(it) + deep, 16.0));

  return sdeKleinian(q, sc, fold, minR, fixedR, it) * gen / k;
}
