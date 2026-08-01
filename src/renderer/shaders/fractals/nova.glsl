// Nova / Newton — one large quaternion Newton fractal (z³ − 1 = 0).
// No mod-tiling: a single detailed structure, not a grid of copies.
vec4 qmul(vec4 a, vec4 b) {
  return vec4(
    a.x * b.x - a.y * b.y - a.z * b.z - a.w * b.w,
    a.x * b.y + a.y * b.x + a.z * b.w - a.w * b.z,
    a.x * b.z - a.y * b.w + a.z * b.x + a.w * b.y,
    a.x * b.w + a.y * b.z - a.z * b.y + a.w * b.x
  );
}

float sdeNova(vec3 pos, vec2 cp, float bailout, int iters) {
  // Early-out far from the single structure
  float sphereD = length(pos) - 2.4;
  if (sphereD > 0.2) return sphereD;

  vec4 z = vec4(pos, 0.0);
  // u_jc morphs the Nova constant — basin boundaries reshape continuously
  vec4 c = vec4(cp.x * 0.42, cp.y * 0.42, cp.x * 0.08, cp.y * 0.08);
  float minD = 1e5;
  float dr = 1.0;

  for (int i = 0; i < 12; i++) {
    if (i >= iters) break;
    vec4 z2 = qmul(z, z);
    vec4 z3 = qmul(z2, z);
    vec4 dz = z2 * 3.0;
    float denom = dot(dz, dz);
    if (denom < 1e-5) break;

    vec4 num = z3 - vec4(1.0, 0.0, 0.0, 0.0);
    vec4 dzC = vec4(dz.x, -dz.y, -dz.z, -dz.w);

    dr *= clamp(length(num) / sqrt(denom) + 0.5, 0.35, 2.5);

    z = z - qmul(num, dzC) / denom + c;

    float d0 = length(z - vec4( 1.0,  0.0, 0.0, 0.0));
    float d1 = length(z - vec4(-0.5,  0.866, 0.0, 0.0));
    float d2 = length(z - vec4(-0.5, -0.866, 0.0, 0.0));
    minD = min(minD, min(d0, min(d1, d2)));

    if (dot(z, z) > bailout * bailout) break;
  }

  // Hard floor prevents ray-stall blank screens inside basins
  float de = max(minD / max(dr, 0.5) * 0.40, 0.0025);
  return max(de, sphereD);
}

float sceneSDE(vec3 p) {
  int it = int(u_iter);
  if (it > 12) it = 12;
  if (it < 6) it = 6;

  // Mild world scale — one large object filling the view (no tiling)
  float sc = clamp(0.72 + u_power * 0.018, 0.65, 0.95);
  return sdeNova(p * sc, u_jc, clamp(u_bailout * 0.6 + 1.8, 1.8, 4.0), it);
}
