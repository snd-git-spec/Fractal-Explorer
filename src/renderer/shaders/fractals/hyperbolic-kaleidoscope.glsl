// Hyperbolic Kaleidoscope — Knighty-style ideal polyhedron IFS.
// Detail comes from folds × inversion × scale (length/DEf), NOT plane traps.
// Plane / |y| DE was the “stacked 2D overlay” look; radial mush wiped the lace.

float sdeHyperbolicKaleido(
  vec3 p,
  float sphR,
  float sc,
  vec3 offset,
  float twist,
  int iters
) {
  const float PHI = 1.6180339887;

  vec3 n1 = normalize(vec3(0.0, 1.0, PHI));
  vec3 n2 = normalize(vec3(1.0, PHI, 0.0));
  vec3 n3 = normalize(vec3(PHI, 0.0, 1.0));

  float ct = cos(twist);
  float st = sin(twist);
  mat2 Rz = mat2(ct, st, -st, ct);

  float DEf = 1.0;
  float trap = 1e5;
  float sphR2 = sphR * sphR;

  for (int i = 0; i < 12; i++) {
    if (i >= iters) break;

    p = abs(p);
    p.xz = Rz * p.xz;

    // Kaleidoscope chamber (symmetry only — not the distance primitive)
    p -= 2.0 * min(0.0, dot(p, n1)) * n1;
    p -= 2.0 * min(0.0, dot(p, n2)) * n2;
    p -= 2.0 * min(0.0, dot(p, n3)) * n3;
    p = abs(p);

    // Hyperbolic isometry
    float r2 = max(dot(p, p), 1e-4);
    float k = sphR2 / r2;
    p *= k;
    DEf *= k;

    // Mild boost — nesting detail without emptying into void
    p = p * sc - offset * (sc - 1.0);
    DEf *= abs(sc);

    DEf = clamp(DEf, 1e-4, 1e5);
    // Colour from 3D orbit depth only (no face / plane IDs)
    trap = min(trap, length(p) * 0.28 + float(i) * 0.05);
  }

  gOrbit = clamp(trap * 0.55, 0.0, 1.0);

  // Fractal surface = IFS residual in R³ (cusps / bulbs), not flat sheets
  float d = length(p) / max(DEf, 1e-4);
  return d * 0.2;
}

float sceneSDE(vec3 p) {
  int it = int(u_iter);
  if (it > 10) it = 10;
  if (it < 6) it = 6;

  // Inversion sphere
  float sphR = clamp(0.9 + (u_power - 8.0) * 0.035, 0.7, 1.25);
  sphR = clamp(sphR + (u_bailout - 3.0) * 0.025, 0.6, 1.35);
  // Slight Euclidean boost for lace depth (keep near 1.2–1.5)
  float sc = clamp(1.22 + (u_power - 8.0) * 0.02, 1.12, 1.48);
  vec3 offset = vec3(
    clamp(0.55 + u_jc.x * 0.28, 0.2, 1.0),
    clamp(0.4 + u_jc.y * 0.25, 0.15, 0.9),
    clamp(0.45 + u_jc.x * 0.1 - u_jc.y * 0.08, 0.15, 0.95)
  );
  float twist = clamp(u_jc.x * 0.14 + u_jc.y * 0.1, -0.35, 0.35);

  return sdeHyperbolicKaleido(p * 0.4, sphR, sc, offset, twist, it);
}
