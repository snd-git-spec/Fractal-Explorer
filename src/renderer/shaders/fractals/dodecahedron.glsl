// Dodecahedral Mandelbox: icosahedral fold + sphere inversion + scale.
// Identical mathematical structure to Pseudo-Kleinian (box-fold variant) but
// using the 5-fold icosahedral reflection planes instead of cubic box-fold planes.
// Fills all of 3D space infinitely through the sphere inversion — no mod tiling needed.
float sdeDodecaKleinian(vec3 p, float sc, float t, float KRsq, vec3 C, int iters) {
  float ph = 1.6180339887; // golden ratio

  // 6 icosahedral edge-direction normals (the 12-fold reflection set of the icosahedron).
  // Twisting t via u_power continuously morphs the symmetry for infinite shape variety.
  vec3 n1 = normalize(vec3( 1.0, ph + t,  t));
  vec3 n2 = normalize(vec3(-1.0, ph + t, -t));
  vec3 n3 = normalize(vec3( t,   1.0,  ph + t));
  vec3 n4 = normalize(vec3(-t,  -1.0,  ph + t));
  vec3 n5 = normalize(vec3(ph + t,  t,  1.0));
  vec3 n6 = normalize(vec3(ph + t, -t, -1.0));

  float DEf = 1.0;

  for (int i = 0; i < 20; i++) {
    if (i >= iters) break;

    // 1. Icosahedral fold — reflect through all 6 symmetry planes.
    //    Creates the 5-fold infinite lattice; every point is folded into a
    //    fundamental domain, building self-similar structure at every scale.
    p -= 2.0 * min(0.0, dot(p, n1)) * n1;
    p -= 2.0 * min(0.0, dot(p, n2)) * n2;
    p -= 2.0 * min(0.0, dot(p, n3)) * n3;
    p -= 2.0 * min(0.0, dot(p, n4)) * n4;
    p -= 2.0 * min(0.0, dot(p, n5)) * n5;
    p -= 2.0 * min(0.0, dot(p, n6)) * n6;

    // 2. Sphere inversion — Kleinian group action.
    //    Maps the exterior of the sphere to the interior; this is what makes
    //    the fractal fill all of infinite space rather than sitting in a box.
    float r2 = dot(p, p);
    float k  = max(KRsq / max(r2, 1e-5), 1.0);
    p   *= k;
    DEf *= k;

    // 3. Scale + Julia offset — self-similar recursion at every depth.
    p   = p * sc - C * (sc - 1.0);
    DEf *= abs(sc);
  }

  return length(p) / max(DEf, 1e-5);
}

float sceneSDE(vec3 p) {
  int it = int(u_iter); if (it > 20) it = 20;

  // u_power: scale (fractal density) and twist (morphs the icosahedral symmetry)
  float sc   = clamp(u_power * 0.06 + 1.65, 1.5, 2.6);
  float t    = (u_power - 8.0) * 0.055;

  // u_bailout: sphere inversion radius — controls sphere packing density
  float KRsq = clamp(u_bailout * 0.06 + 0.18, 0.10, 0.55);
  KRsq       = KRsq * KRsq;

  // u_jc: Julia offset — drives continuous shape morphing
  vec3 C = vec3(u_jc.x, u_jc.y, u_jc.x * 0.38) * 0.46;

  return sdeDodecaKleinian(p, sc, t, KRsq, C, it);
}
