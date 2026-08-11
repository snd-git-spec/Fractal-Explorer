// Dodecahedron IFS — Syntopia / Knighty classic.
// Fixed golden fold planes. Morph = recursion scale + stretch centre + pose.
// Open lace you can fly through — no hollow-shell hack.

vec3 rotAxis(vec3 p, vec3 ax, float a) {
  float c = cos(a);
  float s = sin(a);
  return p * c + cross(ax, p) * s + ax * dot(ax, p) * (1.0 - c);
}

float sdeDodecaIFS(
  vec3 z,
  float scale,
  vec3 offset,
  float ang5a,
  float ang5b,
  int iters
) {
  const float PHI = 1.6180339887;

  vec3 n1 = normalize(vec3(-1.0, PHI - 1.0, 1.0 / (PHI - 1.0)));
  vec3 n2 = normalize(vec3(PHI - 1.0, 1.0 / (PHI - 1.0), -1.0));
  vec3 n3 = normalize(vec3(1.0 / (PHI - 1.0), -1.0, PHI - 1.0));

  vec3 a5 = normalize(vec3(0.0, 1.0, PHI));
  vec3 b5 = normalize(vec3(0.0, -1.0, PHI));

  z = rotAxis(z, a5, ang5a);
  z = rotAxis(z, b5, ang5b);

  float orbit = 0.0;
  float ow = 1.0;
  float DEf = 1.0;

  for (int i = 0; i < 20; i++) {
    if (i >= iters) break;

    z -= 2.0 * min(0.0, dot(z, n1)) * n1;
    z -= 2.0 * min(0.0, dot(z, n2)) * n2;
    z -= 2.0 * min(0.0, dot(z, n3)) * n3;
    z -= 2.0 * min(0.0, dot(z, n1)) * n1;
    z -= 2.0 * min(0.0, dot(z, n2)) * n2;
    z -= 2.0 * min(0.0, dot(z, n3)) * n3;
    z -= 2.0 * min(0.0, dot(z, n1)) * n1;
    z -= 2.0 * min(0.0, dot(z, n2)) * n2;
    z -= 2.0 * min(0.0, dot(z, n3)) * n3;

    z = z * scale - offset * (scale - 1.0);
    DEf *= scale;

    float r = length(z);
    orbit += ow * exp(-r * 0.9);
    ow *= 0.7;

    if (dot(z, z) > 1e6) break;
  }

  gOrbit = clamp(orbit * 0.55, 0.0, 1.0);
  return length(z) / max(DEf, 1e-4) * 0.85;
}

float sceneSDE(vec3 p) {
  float tDet = clamp((u_iter - 8.0) / 56.0, 0.0, 1.0);
  int it = int(mix(10.0, 18.0, tDet));

  const float PHI = 1.6180339887;
  const float TAU5 = 6.28318530718 / 5.0;

  float mx = clamp(u_jc.x, -1.0, 1.0);
  float my = clamp(u_jc.y, -1.0, 1.0);

  // Near φ² — solid lace that still blooms
  float bloom = clamp((u_power - 4.0) / 10.0, 0.0, 1.0);
  bloom = clamp(bloom * 0.8 + clamp((u_bailout - 1.5) / 3.5, 0.0, 1.0) * 0.2, 0.0, 1.0);
  float scale = mix(2.15, 2.7, bloom);

  vec3 oA = vec3(1.0);
  vec3 oB = vec3(PHI, 1.0, 1.0 / PHI);
  vec3 oC = vec3(1.0 / PHI, PHI, 1.0);
  vec3 oD = vec3(1.0, 1.0 / PHI, PHI);
  vec3 offset =
    oA +
    mx * (oB - oA) * 0.9 +
    my * (oC - oA) * 0.9 +
    mx * my * (oD - oA) * 0.35;
  offset *= mix(0.88, 1.12, clamp((u_bailout - 1.5) / 3.5, 0.0, 1.0));
  offset = clamp(offset, vec3(0.75), vec3(1.3));

  float ang5a = mx * 0.9 * TAU5;
  float ang5b = my * 0.85 * TAU5;

  float k = 0.85;
  return sdeDodecaIFS(p * k, scale, offset, ang5a, ang5b, it) / k;
}
