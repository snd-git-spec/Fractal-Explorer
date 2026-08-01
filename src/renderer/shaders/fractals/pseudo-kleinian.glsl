// Pseudo-Kleinian (Knighty / Theli-at) — scale-1 Julia box folds + plane trap.
// Plane DE gives the sharp lattice / cathedral look; spherical DE made soft blobs.
float sdePseudoKleinian(vec3 p, float size, vec3 cSize, vec3 c, int iters) {
  float def = 1.0;
  vec3 ap = p + 1.0;

  for (int i = 0; i < 20; i++) {
    if (i >= iters) break;
    // Bail if orbit stalled (matches Fragmentarium Thing2)
    if (dot(ap - p, ap - p) < 1e-12) break;
    ap = p;

    // Box fold
    p = 2.0 * clamp(p, -cSize, cSize) - p;

    // Sphere fold — k = max(Size/r², 1) (scale-1 Julia box)
    float r2 = dot(p, p);
    float k = max(size / max(r2, 1e-8), 1.0);
    p *= k;
    def *= k;

    p += c;
  }

  // Plane trap — flat cuts + folded ridges (not spherical blobs)
  return 0.5 * abs(p.z) / max(abs(def), 0.0001);
}

float sceneSDE(vec3 p) {
  int it = int(u_iter);
  if (it > 14) it = 14;
  if (it < 6) it = 6;

  // Size ≈ sphere-fold strength (classic default ~1)
  float size = clamp(u_power * 0.08 + 0.55, 0.7, 1.45);
  // Cubic fold half-extent
  float cs = clamp(u_bailout * 0.18 + 0.75, 0.7, 1.25);
  vec3 cSize = vec3(cs, cs * 0.97, cs);

  // Julia constant — drifts the lattice corridors
  vec3 c = vec3(u_jc.x, u_jc.y, -u_jc.x * 0.45 - u_jc.y * 0.2) * 0.85;

  // Mild domain shrink so zoom ~3–4 sits inside the architecture
  float k = 1.15;
  return sdePseudoKleinian(p * k, size, cSize, c, it) / k;
}
