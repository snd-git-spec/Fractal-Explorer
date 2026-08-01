// u_jc.x  — branching scale:  widens/narrows the sponge holes
// u_jc.y  — cross spread:     varies the cross-section bar thickness
// Neither parameter shifts the sponge away from the origin.
float sdeMenger(vec3 pos, float branch, float spread, int iters) {
  vec3 q0 = abs(pos) - vec3(1.0);
  float d = length(max(q0, 0.0)) + min(max(q0.x, max(q0.y, q0.z)), 0.0);
  float s = 1.0;
  for (int i = 0; i < 16; i++) {
    if (i >= iters) break;
    vec3 a = mod(pos * s, 2.0) - 1.0;
    s *= branch;
    vec3 rr = abs(1.0 - spread * abs(a));
    float da = max(rr.x, rr.y), db = max(rr.y, rr.z), dc = max(rr.z, rr.x);
    d = max(d, (min(da, min(db, dc)) - 1.0) / s);
  }
  return d;
}

float sceneSDE(vec3 p) {
  int it = int(u_iter);
  float branch = clamp(u_power * 0.045 + 2.65 + u_jc.x * 0.18, 2.2, 3.8);
  float spread = clamp(3.0 + u_jc.y * 0.40, 2.2, 3.9);
  return sdeMenger(p, branch, spread, it);
}
