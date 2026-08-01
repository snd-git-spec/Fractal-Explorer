float sdeApollonian(vec3 p, float scale, int iters) {
  float s = 1.0;
  for (int i = 0; i < 32; i++) {
    if (i >= iters) break;
    p = -1.0 + 2.0 * fract(0.5 * p + 0.5);
    float r2 = dot(p, p);
    // Only invert when inside a sphere — creates crisp nested sphere boundaries
    float k = max(scale / max(r2, 0.0001), 1.0);
    p *= k;
    s *= k;
    if (s > 1e6) break;
  }
  // Spherical distance — gives 3D tunnel / sphere-packing geometry
  return length(p) / max(s, 0.0001);
}

float sceneSDE(vec3 p) {
  int it = int(u_iter);
  // Gentle warp — shifts through the infinite sphere packing
  vec3 q = p + vec3(u_jc.x, u_jc.y, u_jc.x * 0.4) * 0.28;
  float sc = clamp(u_power * 0.07 + 1.45, 1.3, 2.1);
  return sdeApollonian(q, sc, it) * 0.45;
}
