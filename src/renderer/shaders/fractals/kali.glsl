// Kali set — abs + inversion with a plane trap.
// Scale tracks ∏(1/r²) so DE = |p.y| * scale is a true-ish distance.
float sdeKali(vec3 p, vec3 param, int iters) {
  float scale = 1.0;

  for (int i = 0; i < 10; i++) {
    if (i >= iters) break;
    p = abs(p);
    float r2 = max(dot(p, p), 0.0002);
    scale /= r2;
    p = p / r2 - param;
  }
  return abs(p.y) * abs(scale) * 0.22;
}

float sceneSDE(vec3 p) {
  int it = int(u_iter);
  if (it > 8) it = 8;
  if (it < 5) it = 5;

  // Classic Kali parameter band
  vec3 param = vec3(
    clamp(0.85 + u_jc.x * 0.20, 0.50, 1.15),
    clamp(0.80 + u_jc.y * 0.18, 0.50, 1.10),
    clamp(0.60 + u_bailout * 0.05, 0.35, 0.95)
  );

  // Zoom ~2.8 sits inside the cavern lattice
  return sdeKali(p * 0.45, param, it);
}
