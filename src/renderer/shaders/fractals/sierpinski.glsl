float sdeSierpinski(vec3 p, float sc, vec3 va, vec3 vb, vec3 vc, vec3 vd, int iters) {
  float orbit = 0.0;
  float ow = 1.0;
  for (int i = 0; i < 12; i++) {
    if (i >= iters) break;
    vec3 cv = va;
    float md = length(p - va), dd;
    dd = length(p - vb); if (dd < md) { md = dd; cv = vb; }
    dd = length(p - vc); if (dd < md) { md = dd; cv = vc; }
    dd = length(p - vd); if (dd < md) { cv = vd; }
    p = sc * p - cv * (sc - 1.0);

    float r = length(p);
    orbit += ow * exp(-r * 1.1);
    ow *= 0.7;
  }
  gOrbit = clamp(orbit * 0.55, 0.0, 1.0);
  return length(p) * pow(sc, -float(iters));
}

float sceneSDE(vec3 p) {
  int it = int(u_iter); if (it > 12) it = 12;

  // Fold scale: controls fractal thickness and compression
  float sc = clamp(u_power * 0.09 + 1.75, 1.6, 2.5);

  // Morph the 4 tetrahedron vertices continuously:
  // wx  — rotates the base 3 vertices around Y and tilts the top vertex in X
  // wy  — stretches/squishes the tetrahedron vertically (elongated / flat forms)
  float wx = u_jc.x * 0.65;
  float wy = u_jc.y * 0.50;
  float cw = cos(wx), sw = sin(wx);

  // Top vertex (base: 0, 1, 0) — tilts in X with wx, rises/lowers with wy
  vec3 va = vec3(sw * 0.55, 1.0 + wy * 0.40, 0.0);

  // Bottom 3 vertices — Y-rotation by wx, vertical shift by wy
  vec3 b0 = vec3(0.0, -1.0, 1.0);
  vec3 vb = vec3(b0.x*cw - b0.z*sw, b0.y + wy*0.55, b0.x*sw + b0.z*cw);

  vec3 c0 = vec3(0.943, -1.0, -0.471);
  vec3 vc = vec3(c0.x*cw - c0.z*sw, c0.y - wy*0.30, c0.x*sw + c0.z*cw);

  vec3 d0 = vec3(-0.943, -1.0, -0.471);
  vec3 vd = vec3(d0.x*cw - d0.z*sw, d0.y, d0.x*sw + d0.z*cw);

  // Infinite tiling — period varies with u_bailout for grid-density variation
  float period = clamp(u_bailout * 0.28 + 3.0, 2.5, 5.0);
  vec3 q = mod(p + period * 0.5, period) - period * 0.5;

  return sdeSierpinski(q, sc, va, vb, vc, vd, it);
}
