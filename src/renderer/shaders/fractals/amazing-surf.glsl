float sdeAmazingSurf(vec3 pos, float scale, float minR, int iters) {
  vec3 p = pos;
  float Dd = 1.0;
  float minRR = max(minR * minR, 0.001);
  float maxRR = 1.0;
  float orbit = 0.0;
  float ow = 1.0;
  for (int i = 0; i < 16; i++) {
    if (i >= iters) break;
    p.x = clamp(p.x, -1.0, 1.0) * 2.0 - p.x;
    p.y = clamp(p.y, -1.0, 1.0) * 2.0 - p.y;
    p.z = clamp(p.z, -1.8, 1.8) * 2.0 - p.z;
    float rr = dot(p, p);
    if (rr < minRR) { float k = maxRR / minRR; p *= k; Dd *= k; }
    else if (rr < maxRR) { float k = maxRR / rr; p *= k; Dd *= k; }
    p = p * scale + pos;
    Dd = Dd * abs(scale) + 1.0;

    float r = length(p);
    float face = max(abs(p.x), max(abs(p.y), abs(p.z)));
    orbit += ow * (0.55 * exp(-r * 1.1) + 0.45 * exp(-face * 1.4));
    ow *= 0.7;

    if (dot(p, p) > 256.0) break;
  }
  gOrbit = clamp(orbit * 0.55, 0.0, 1.0);
  return length(p) / max(abs(Dd), 0.0001);
}

float sceneSDE(vec3 p) {
  int it = int(u_iter);
  return sdeAmazingSurf(p, u_power * 0.25 - 1.5, u_bailout * 0.08 + 0.01, it);
}
