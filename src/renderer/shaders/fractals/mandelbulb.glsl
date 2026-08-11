// Classic Mandelbulb — White & Nylander spherical power-N.
// No per-iteration theta bias: that leaned lobes and made each join look
// different on one side. Warp is a Z-rotation + even axial stretch so every
// lobe join stays mirror-matched.

float sdeMandelbulb(vec3 pos, float power, float bailout, int iters) {
  vec3 z = pos;
  float dr = 1.0, r = 0.0;
  float smoothI = float(iters);
  for (int i = 0; i < 64; i++) {
    if (i >= iters) break;
    r = length(z);
    if (r > bailout) {
      smoothI = float(i) - log2(max(log2(max(r, 1.0001)), 0.0001));
      break;
    }
    float theta = acos(clamp(z.z / r, -1.0, 1.0));
    float phi = atan(z.y, z.x);
    dr = power * pow(r, power - 1.0) * dr + 1.0;
    float zr = pow(r, power);
    theta *= power;
    phi *= power;
    z = zr * vec3(sin(theta) * cos(phi), sin(theta) * sin(phi), cos(theta)) + pos;
  }
  gOrbit = clamp(smoothI / max(float(iters), 1.0), 0.0, 1.0);
  return 0.5 * log(max(r, 0.0001)) * r / max(dr, 0.0001);
}

float sceneSDE(vec3 p) {
  int it = int(u_iter);
  float n = clamp(u_power, 2.0, 14.0);

  // Lobe twist = rotate the whole bulb about Z (joins stay identical all around)
  float a = u_jc.x * 1.35;
  float ca = cos(a);
  float sa = sin(a);
  vec3 q = vec3(ca * p.x - sa * p.y, sa * p.x + ca * p.y, p.z);

  // Pole stretch is even north/south — no one-sided lean at the joins
  float stretch = clamp(1.0 + u_jc.y * 0.28, 0.78, 1.28);
  q.z *= stretch;
  q.xy *= mix(1.0, 1.0 / sqrt(max(stretch, 0.5)), 0.5);

  return sdeMandelbulb(q, n, u_bailout, it) / mix(1.0, stretch, 0.35);
}
