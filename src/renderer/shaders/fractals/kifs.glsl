// Generic KIFS — octahedral IFS (same cell as Kleinian IFS) + mild post-fold twist.
// Keeps the known-good period-2 framing so the default orbit camera sees structure.
float sdeKIFS(vec3 p, float scale, float twist, int iters) {
  float ct = cos(twist), st = sin(twist);

  for (int i = 0; i < 14; i++) {
    if (i >= iters) break;

    p = abs(p);
    float tmp;
    if (p.x < p.y) { tmp = p.x; p.x = p.y; p.y = tmp; }
    if (p.x < p.z) { tmp = p.x; p.x = p.z; p.z = tmp; }
    if (p.y < p.z) { tmp = p.y; p.y = p.z; p.z = tmp; }

    // Mild kaleidoscopic twist after the sort (pre-fold rotation empties the DE)
    float y = p.y;
    p.y = ct * y - st * p.z;
    p.z = st * y + ct * p.z;

    p = p * scale - vec3(scale - 1.0, 0.0, 0.0);
    if (p.z < -(scale - 1.0) * 0.5) p.z += scale - 1.0;
  }
  return (length(p) - 0.35) * pow(scale, -float(iters));
}

float sceneSDE(vec3 p) {
  int it = int(u_iter);
  if (it > 14) it = 14;
  if (it < 6) it = 6;

  // Same period-2 cell as Kleinian IFS — camera zoom ~2.2 sits in the lattice
  vec3 q = mod(p * 0.5 + 0.5, 1.0) * 2.0 - 1.0;

  float sc = clamp(u_power * 0.06 + 1.8 + u_jc.x * 0.05, 1.65, 2.30);
  float twist = clamp(u_jc.y, -1.2, 1.2) * 0.22;

  return sdeKIFS(q, sc, twist, it) * 0.5;
}
