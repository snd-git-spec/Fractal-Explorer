// Kali set — abs + inversion (Fragmentarium).
// Classic |y|·scale keeps the spheres. Soft-union with a fat min-radius fill
// so Julia gaps don't punch through to the black backdrop.

float softMin(float a, float b, float k) {
  float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
  return mix(b, a, h) - k * h * (1.0 - h);
}

float sdeKali(vec3 p, vec3 param, int iters) {
  float scale = 1.0;
  float minR = 1e5;
  float orbit = 0.0;
  float ow = 1.0;

  for (int i = 0; i < 10; i++) {
    if (i >= iters) break;
    p = abs(p);
    float r2 = max(dot(p, p), 0.0002);
    scale /= r2;
    p = p / r2 - param;

    float r = length(p);
    minR = min(minR, r);
    orbit += ow * exp(-r * 1.1);
    ow *= 0.7;
  }

  // Cap scale hard — runaway scale → hairline DE → missed rays → black dots
  float s = clamp(abs(scale), 0.05, 120.0);

  // Classic Kali spheres (plane trap)
  float dPlane = abs(p.y) * s * 0.22;
  // Fat solid fill from same inversions — plugs the holes, overlaps neighbouring bulbs
  float dFill = minR * 0.14;

  gOrbit = clamp(orbit * 0.55, 0.0, 1.0);
  return softMin(dPlane, dFill, 0.06);
}

float sceneSDE(vec3 p) {
  int it = int(u_iter);
  if (it > 8) it = 8;
  if (it < 5) it = 5;

  vec3 param = vec3(
    clamp(0.85 + u_jc.x * 0.20, 0.50, 1.15),
    clamp(0.80 + u_jc.y * 0.18, 0.50, 1.10),
    clamp(0.60 + u_bailout * 0.05, 0.35, 0.95)
  );

  // Slightly denser pack so bulbs overlap in frame
  return sdeKali(p * 0.4, param, it);
}
