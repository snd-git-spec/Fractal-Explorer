// tp / pp are per-iteration angle biases added after multiplying by power.
// They break the bulb's discrete N-fold symmetry and create genuinely different
// lobe topologies — not just size changes from power/bailout oscillation.
float sdeMandelbulb(vec3 pos, float power, float bailout, float tp, float pp, int iters) {
  vec3 z = pos;
  float dr = 1.0, r = 0.0;
  for (int i = 0; i < 64; i++) {
    if (i >= iters) break;
    r = length(z);
    if (r > bailout) break;
    float theta = acos(clamp(z.z / r, -1.0, 1.0));
    float phi = atan(z.y, z.x);
    dr = power * pow(r, power - 1.0) * dr + 1.0;
    float zr = pow(r, power);
    // Angle biases: tp tilts lobes toward/away from poles, pp rotates/twists them
    theta = theta * power + tp;
    phi   = phi   * power + pp;
    z = zr * vec3(sin(theta) * cos(phi), sin(theta) * sin(phi), cos(theta)) + pos;
  }
  return 0.5 * log(max(r, 0.0001)) * r / max(dr, 0.0001);
}

float sceneSDE(vec3 p) {
  int it = int(u_iter);
  float n  = clamp(u_power, 2.0, 14.0);
  // u_jc drives the angle biases independently of power/bailout — 4 evolving
  // dimensions (n, bailout, tp, pp) whose combination never repeats.
  float pp = u_jc.x * 0.75;   // phi bias  — twists lobes around Z-axis
  float tp = u_jc.y * 0.55;   // theta bias — tilts lobes toward poles
  return sdeMandelbulb(p, n, u_bailout, tp, pp, it);
}
