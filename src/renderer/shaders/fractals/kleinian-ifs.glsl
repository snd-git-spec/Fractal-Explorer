// Octahedral IFS attractor — creates the stellated spiky Kleinian-like structure.
// The sort + translate + z-fold combination produces a bounded attractor.
// SDE: for a pure IFS the orbit in void regions grows as scale^n, so dividing
// by scale^n gives the correct distance estimate everywhere — no cap needed.
// (Capping at 4 makes void SDE = d×scale^(n-4) ≈ d×80000 → rays overshoot → empty.)
float sdeOctahedralIFS(vec3 p, float scale, int iters) {
  for (int i = 0; i < 16; i++) {
    if (i >= iters) break;
    p = abs(p);
    float tmp;
    if (p.x < p.y) { tmp = p.x; p.x = p.y; p.y = tmp; }
    if (p.x < p.z) { tmp = p.x; p.x = p.z; p.z = tmp; }
    if (p.y < p.z) { tmp = p.y; p.y = p.z; p.z = tmp; }
    p = p * scale - vec3(scale - 1.0, 0.0, 0.0);
    if (p.z < -(scale - 1.0) * 0.5) p.z += scale - 1.0;
  }
  return (length(p) - 0.35) * pow(scale, -float(iters));
}

float sceneSDE(vec3 p) {
  int it = int(u_iter); if (it > 16) it = 16;

  // Original tiling: period-2, IFS operates in [-1, 1].
  // u_jc is NOT used for tiling offset — shifting cell boundaries creates
  // SDE discontinuities as they sweep past the camera during evolution.
  vec3 q = mod(p * 0.5 + 0.5, 1.0) * 2.0 - 1.0;

  // u_power drives scale (fractal density); u_jc.x adds a fine variation
  // without touching the tiling, so structure stays intact while morphing.
  float sc = u_power * 0.06 + 1.8 + u_jc.x * 0.08;

  return sdeOctahedralIFS(q, sc, it) * 0.5;
}
