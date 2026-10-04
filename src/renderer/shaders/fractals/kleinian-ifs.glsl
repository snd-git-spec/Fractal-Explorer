// Octahedral IFS attractor — stellated spiky Kleinian-like structure.
// Running DE (not pow(scale,-u_iter)) so high Detail does not collapse into noise.
float sdeOctahedralIFS(vec3 p, float scale, int iters) {
  float DEf = 1.0;
  float orbit = 0.0;
  float ow = 1.0;
  float off = scale - 1.0;
  for (int i = 0; i < 18; i++) {
    if (i >= iters) break;
    p = abs(p);
    float tmp;
    if (p.x < p.y) { tmp = p.x; p.x = p.y; p.y = tmp; }
    if (p.x < p.z) { tmp = p.x; p.x = p.z; p.z = tmp; }
    if (p.y < p.z) { tmp = p.y; p.y = p.z; p.z = tmp; }
    p = p * scale - vec3(off, 0.0, 0.0);
    if (p.z < -0.5 * off) p.z += off;
    DEf *= abs(scale);

    float r = length(p);
    float face = max(p.x, max(p.y, p.z));
    orbit += ow * (0.55 * exp(-r * 1.1) + 0.45 * exp(-face * 1.4));
    ow *= 0.7;
  }
  gOrbit = clamp(orbit * 0.55, 0.0, 1.0);
  return 0.5 * (length(p) - 0.35) / max(DEf, 1e-4);
}

float sceneSDE(vec3 p) {
  int it = int(u_iter);
  if (it > 16) it = 16;
  if (it < 7) it = 7;

  vec3 q = mod(p * 0.5 + 0.5, 1.0) * 2.0 - 1.0;

  float sc = clamp(u_power * 0.06 + 1.8 + u_jc.x * 0.08, 1.7, 2.4);

  return sdeOctahedralIFS(q, sc, it) * 0.5;
}
