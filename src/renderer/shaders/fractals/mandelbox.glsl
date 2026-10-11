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

  return 0.5 * (length(z) - (abs(scale) - 1.0)) / max(abs(dr), 0.0001);
}

float sceneSDE(vec3 p) {
  int it = int(u_iter);
  if (it > 16) it = 16;
  if (it < 10) it = 10;

  // Higher scale hollows the interior into lattice halls; below ~2.3 the core packs solid,
  // above ~3 the detail turns to noise.
  float sc = mix(2.3, 3.0, clamp((u_power - 2.5) / 12.0, 0.0, 1.0));
  float minR2 = clamp(0.4 - u_bailout * 0.05, 0.1, 0.4);
  float fold = clamp(1.0 + u_jc.x * 0.12 - abs(u_jc.y) * 0.08, 0.86, 1.14);

  float k = 1.0;
  vec3 q = p * k;

  // The set lives in |z|∞ ≤ 2·fold·(s+1)/(s-1). Fold space into the shell [R, R·g) so
  // that generation repeats inward and outward forever — there is no edge to fly off.
  // Shell size must not follow the morphing scale/fold: any change compounds per
  // generation and the whole world appears to rush toward or away from the camera.
  const float g = 2.65;
  const float outer = 3.98;
  float R = outer / g;
  float gen = 1.0;
  for (int i = 0; i < 16; i++) {
    float m = max(abs(q.x), max(abs(q.y), abs(q.z)));
    if (m >= outer) {
      q /= g;
      gen *= g;
    } else if (m < R) {
      q *= g;
      gen /= g;
    } else {
      break;
    }
  }

  // Julia drift inside each generation — corridors slide without breaking the nesting
  vec3 qj = q + vec3(u_jc.x, u_jc.y, -u_jc.x * 0.35 + u_jc.y * 0.2) * 0.12;

  return sdeMandelbox(qj, sc, minR2, fold, it) * gen / k;
}
