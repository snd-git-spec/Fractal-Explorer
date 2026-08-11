// Jerusalem Cube — Angramme IFS temple.
// Smooth orbit colour that flows with the form (no stepped / sparkle traps).

float sdBoxJC(vec3 p, vec3 b) {
  vec3 q = abs(p) - b;
  return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0);
}

float sdeJerusalem(vec3 p, float vB, float arm, float warp, int iters) {
  float vA = max(1.0 - 2.0 * vB, 0.06);
  float S = 1.0;
  float orbit = 0.0;
  float ow = 1.0;
  p *= 0.5;

  for (int i = 0; i < 28; i++) {
    if (i >= iters) break;

    p = abs(p);
    p.xy += vec2(warp, -warp) * 0.004;
    if (p.x < p.z) p.xz = p.zx;
    if (p.y < p.z) p.zy = p.yz;
    if (p.x < p.y) p.xy = p.yx;

    float crossCut = 0.5 * vA * mix(0.92, 1.06, arm);
    if (p.z > crossCut || p.z > p.y + 1.5 * vA - 0.5) {
      p -= vec3(0.5 - 0.5 * vB);
      p *= 1.0 / max(vB, 0.04);
      S *= vB;
    } else {
      p -= vec3(0.5 - 0.5 * vA, 0.5 - 0.5 * vA, 0.0);
      p *= 1.0 / max(vA, 0.04);
      S *= vA;
    }

    // Soft running orbit — continuous in space and as morph moves folds
    float r = length(p);
    float face = max(p.x, max(p.y, p.z));
    orbit += ow * (0.55 * exp(-r * 1.1) + 0.45 * exp(-face * 1.4));
    ow *= 0.7;

    if (dot(p, p) > 64.0) break;
  }

  // Single smooth field → palette t flows instead of jumping bands
  gOrbit = clamp(orbit * 0.55, 0.0, 1.0);

  return sdBoxJC(p, vec3(0.5)) * abs(S);
}

float sceneSDE(vec3 p) {
  int it = int(u_iter);
  if (it > 20) it = 20;
  if (it < 12) it = 12;

  float vB = clamp(0.385 + (u_power - 8.0) * 0.01 + u_jc.x * 0.03, 0.34, 0.44);
  float arm = clamp((u_bailout - 1.0) / 5.0, 0.0, 1.0);
  float warp = u_jc.y;

  float k = 0.62;
  return sdeJerusalem(p * k, vB, arm, warp, it) / k;
}
