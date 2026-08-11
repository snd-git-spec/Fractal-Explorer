// u_jc.x  — branching scale:  widens/narrows the sponge holes
// u_jc.y  — cross spread:     varies the cross-section bar thickness
// Soft orbit trap so colour follows faces / recursion depth (not AO sparkle).

float sdeMenger(vec3 pos, float branch, float spread, int iters) {
  vec3 q0 = abs(pos) - vec3(1.0);
  float d = length(max(q0, 0.0)) + min(max(q0.x, max(q0.y, q0.z)), 0.0);
  float s = 1.0;
  float orbit = 0.0;
  float ow = 1.0;

  for (int i = 0; i < 16; i++) {
    if (i >= iters) break;
    vec3 a = mod(pos * s, 2.0) - 1.0;
    s *= branch;
    vec3 rr = abs(1.0 - spread * abs(a));
    float da = max(rr.x, rr.y);
    float db = max(rr.y, rr.z);
    float dc = max(rr.z, rr.x);
    float cross = min(da, min(db, dc)) - 1.0;
    d = max(d, cross / s);

    // Soft orbit — continuous across faces; tracks hole depth as morph moves
    float face = max(abs(a.x), max(abs(a.y), abs(a.z)));
    float wx = exp(-abs(a.x) * 2.4);
    float wy = exp(-abs(a.y) * 2.4);
    float wz = exp(-abs(a.z) * 2.4);
    float wsum = wx + wy + wz + 1e-4;
    float axis = (wx * 0.1 + wy * 0.4 + wz * 0.75) / wsum;
    orbit += ow * (
      0.48 * exp(-abs(cross) * 1.6) +
      0.32 * exp(-face * 1.15) +
      0.20 * axis
    );
    ow *= 0.62;
  }

  gOrbit = clamp(orbit * 0.55, 0.0, 1.0);
  return d;
}

float sceneSDE(vec3 p) {
  int it = int(u_iter);
  float branch = clamp(u_power * 0.045 + 2.65 + u_jc.x * 0.18, 2.2, 3.8);
  float spread = clamp(3.0 + u_jc.y * 0.40, 2.2, 3.9);
  return sdeMenger(p, branch, spread, it);
}
