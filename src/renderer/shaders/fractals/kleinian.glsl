float sdeKleinian(vec3 p, float scale, float cs, float minR, float maxR, int iters) {
  float DEf = 1.0;
  vec3 off = vec3(scale - 1.0, scale - 1.0, (scale - 1.0) * 0.45);
  float orbit = 0.0;
  float ow = 1.0;
  for (int i = 0; i < 16; i++) {
    if (i >= iters) break;
    p = clamp(p, -cs, cs) * 2.0 - p;
    float r2 = dot(p, p);
    float mn2 = minR * minR;
    float mx2 = maxR * maxR;
    if (r2 < mn2) { float k = mx2 / mn2; p *= k; DEf *= k; }
    else if (r2 < mx2) { float k = mx2 / r2; p *= k; DEf *= k; }
    p = p * scale - off;
    DEf *= abs(scale);

    float r = length(p);
    float face = max(abs(p.x), max(abs(p.y), abs(p.z)));
    orbit += ow * (0.55 * exp(-r * 1.1) + 0.45 * exp(-face * 1.4));
    ow *= 0.7;
  }
  gOrbit = clamp(orbit * 0.55, 0.0, 1.0);
  return (length(p) - abs(scale - 1.0)) / max(DEf, 0.0001);
}

float sceneSDE(vec3 p) {
  int it = int(u_iter);
  return sdeKleinian(
    p,
    u_power * 0.3 + 1.5,
    u_bailout * 0.3 + 0.7,
    abs(u_jc.x) * 0.4 + 0.1,
    abs(u_jc.y) * 0.6 + 0.5,
    it
  );
}
