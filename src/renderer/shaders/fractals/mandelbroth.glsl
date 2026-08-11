float sdeMandelbroth(vec3 pos, float power, float bailout, int iters) {
  vec3 z = pos;
  float dr = 1.0, r = 0.0;
  float sc = power * 0.18 - 0.9;
  float orbit = 0.0;
  float ow = 1.0;
  for (int i = 0; i < 48; i++) {
    if (i >= iters) break;
    r = length(z);
    if (r > bailout) break;
    if (mod(float(i), 2.0) < 1.0) {
      float theta = acos(clamp(z.z / r, -1.0, 1.0));
      float phi = atan(z.y, z.x);
      dr = power * pow(r, power - 1.0) * dr + 1.0;
      float zr = pow(r, power);
      theta *= power;
      phi *= power;
      z = zr * vec3(sin(theta) * cos(phi), sin(theta) * sin(phi), cos(theta)) + pos;
    } else {
      z = clamp(z, -1.0, 1.0) * 2.0 - z;
      float rr = dot(z, z);
      if (rr < 0.25) { z *= 4.0; dr *= 4.0; }
      else if (rr < 1.0) { float k = 1.0 / rr; z *= k; dr *= k; }
      z = z * sc + pos;
      dr = dr * abs(sc) + 1.0;
    }
    float zr = length(z);
    float face = max(abs(z.x), max(abs(z.y), abs(z.z)));
    orbit += ow * (0.55 * exp(-zr * 1.1) + 0.45 * exp(-face * 1.4));
    ow *= 0.7;
  }
  gOrbit = clamp(orbit * 0.55, 0.0, 1.0);
  return 0.5 * log(max(r, 0.0001)) * r / max(dr, 0.0001);
}

float sceneSDE(vec3 p) {
  int it = int(u_iter);
  return sdeMandelbroth(p, u_power, u_bailout, it);
}
