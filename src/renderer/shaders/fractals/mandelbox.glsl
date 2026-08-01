// Classic open Mandelbox — params swing hard so Auto Evolve visibly remoulds the sponge.
float sdeMandelbox(vec3 pos, float scale, float minR2, float fold, int iters) {
  vec3 z = pos;
  float dr = 1.0;
  // Smooth/fractional escape-iteration count — continuous even where the box/sphere
  // folds make p and normals jump between neighbouring pixels.
  float smoothI = float(iters);

  for (int i = 0; i < 28; i++) {
    if (i >= iters) break;

    z = clamp(z, -fold, fold) * 2.0 - z;

    float r2 = dot(z, z);
    if (r2 < minR2) {
      float t = 1.0 / minR2;
      z *= t;
      dr *= t;
    } else if (r2 < 1.0) {
      float t = 1.0 / r2;
      z *= t;
      dr *= t;
    }

    z = scale * z + pos;
    dr = abs(scale) * dr + 1.0;
    float r2b = dot(z, z);
    if (r2b > 100.0) {
      smoothI = float(i) - log2(max(log2(max(sqrt(r2b), 1.0001)), 0.0001));
      break;
    }
  }
  gOrbit = clamp(smoothI / max(float(iters), 1.0), 0.0, 1.0);

  return 0.5 * (length(z) - abs(scale - 1.0)) / max(abs(dr), 0.0001);
}

float sceneSDE(vec3 p) {
  int it = int(u_iter);
  if (it > 22) it = 22;
  if (it < 8) it = 8;

  // Wide scale band — morphing power opens/closes the whole sponge
  float sc = mix(1.65, 2.85, clamp((u_power - 2.5) / 12.0, 0.0, 1.0));
  // Sphere-fold cavities breathe with bailout
  float minR2 = clamp(0.38 - u_bailout * 0.055, 0.06, 0.38);
  // Fold width from warp — corridors stretch and squeeze
  float fold = clamp(1.0 + abs(u_jc.x) * 0.35 + abs(u_jc.y) * 0.2, 0.85, 1.55);

  // Strong Julia offset — structure drifts, not a fixed monument
  vec3 q = p + vec3(u_jc.x, u_jc.y, -u_jc.x * 0.35 + u_jc.y * 0.2) * 0.55;

  float k = 2.6;
  return sdeMandelbox(q * k, sc, minR2, fold, it) / k;
}
