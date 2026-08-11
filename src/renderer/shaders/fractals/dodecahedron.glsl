// Dodecahedron IFS — Knighty / Jos Leys golden folds.
// Morph is purely pentagonal maths: φ² scale bloom, Wythoff stretch between
// golden centres, and large rotations about true 5-fold axes — so the body
// reshapes out of itself while staying in the pentagonal family.

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

  // Fixed pentagonal fundamental-triangle normals
  vec3 n1 = normalize(vec3(-1.0, PHI - 1.0, 1.0 / (PHI - 1.0)));
  vec3 n2 = normalize(vec3(PHI - 1.0, 1.0 / (PHI - 1.0), -1.0));
  vec3 n3 = normalize(vec3(1.0 / (PHI - 1.0), -1.0, PHI - 1.0));

  // Dodeca 5-fold axes (through opposite faces)
  vec3 a5 = normalize(vec3(0.0, 1.0, PHI));
  vec3 b5 = normalize(vec3(0.0, -1.0, PHI));

  float orbit = 0.0;
  float ow = 1.0;
  float r2 = 0.0;
  int n = 0;

  for (int i = 0; i < 16; i++) {
    if (i >= iters) break;

    // Large 5-fold turns — reshape without leaving pentagonal symmetry class
    z = rotAxis(z, a5, ang5a);
    z = rotAxis(z, b5, ang5b);

    // Golden folds
    z -= 2.0 * min(0.0, dot(z, n1)) * n1;
    z -= 2.0 * min(0.0, dot(z, n2)) * n2;
    z -= 2.0 * min(0.0, dot(z, n3)) * n3;
    z -= 2.0 * min(0.0, dot(z, n1)) * n1;
    z -= 2.0 * min(0.0, dot(z, n2)) * n2;
    z -= 2.0 * min(0.0, dot(z, n3)) * n3;
    z -= 2.0 * min(0.0, dot(z, n1)) * n1;
    z -= 2.0 * min(0.0, dot(z, n2)) * n2;
    z -= 2.0 * min(0.0, dot(z, n3)) * n3;

    // Scale from stretch centre — bloom into / out of recursive folds
    z = z * scale - offset * (scale - 1.0);

    r2 = dot(z, z);

    // Soft orbit tied to pentagonal maths — colour follows folds + morph
    float r = sqrt(max(r2, 1e-8));
    float d1 = abs(dot(z, n1));
    float d2 = abs(dot(z, n2));
    float d3 = abs(dot(z, n3));
    float face = min(d1, min(d2, d3));
    float w1 = exp(-d1 * 2.8);
    float w2 = exp(-d2 * 2.8);
    float w3 = exp(-d3 * 2.8);
    float wsum = w1 + w2 + w3 + 1e-4;
    // Which golden plane dominates → hue walks with face family
    float foldMix = (w1 * 0.05 + w2 * 0.38 + w3 * 0.72) / wsum;
    // Distance to stretch centre tracks Wythoff morph across the surface
    float toC = length(z - offset);
    // 5-fold azimuth around face axis — bands lock to pentagonal symmetry
    vec3 radial = z - a5 * dot(z, a5);
    float pent =
      0.5 + 0.5 * cos(atan(radial.x, radial.z) * 5.0 + ang5a * 2.5);

    orbit += ow * (
      0.34 * exp(-r * 0.95) +
      0.28 * exp(-face * 2.4) +
      0.18 * exp(-toC * 0.85) +
      0.12 * foldMix +
      0.08 * pent
    );
    ow *= 0.68;

    n = i + 1;
    if (r2 > 1e6) break;
  }

  gOrbit = clamp(orbit * 0.62, 0.0, 1.0);
  return length(z) * pow(scale, float(-n - 1));
}

float sceneSDE(vec3 p) {
  int it = int(u_iter);
  if (it > 13) it = 13;
  if (it < 7) it = 7;

  const float PHI = 1.6180339887;
  const float TAU5 = 6.28318530718 / 5.0;

  // Big scale bloom: near-solid dodeca ↔ deep pentagonal lace
  float tPow = clamp((u_power - 5.0) / 10.0, 0.0, 1.0);
  float tBail = clamp((u_bailout - 1.5) / 4.0, 0.0, 1.0);
  float scale = mix(1.90, 2.82, clamp(tPow * 0.72 + tBail * 0.35, 0.0, 1.0));

  // Wythoff stretch: morph between distinct golden centres (pentagonal family)
  // (1,1,1) at rest · φ-permutations when warp swings — stellated / elongated reads
  vec3 oA = vec3(1.0, 1.0, 1.0);
  vec3 oB = vec3(PHI, 1.0, 1.0 / PHI);
  vec3 oC = vec3(1.0 / PHI, PHI, 1.0);
  vec3 oD = vec3(1.0, 1.0 / PHI, PHI);
  float mx = clamp(u_jc.x, -1.05, 1.05);
  float my = clamp(u_jc.y, -1.05, 1.05);
  vec3 offset =
    oA +
    mx * (oB - oA) * 0.95 +
    my * (oC - oA) * 0.95 +
    mx * my * (oD - oA) * 0.45;
  // Bailout pulls radially — opens / closes the sponge from inside
  offset *= mix(0.72, 1.32, tBail);
  offset = clamp(offset, vec3(0.5), vec3(1.65));

  // Large 5-fold orbit angles (units of 72°) — reshape, not random tumble
  float ang5a = (mx * 1.55 + (u_power - 8.0) * 0.1) * TAU5;
  float ang5b = (my * 1.45 + (u_bailout - 3.0) * 0.28) * TAU5;

  return sdeDodecaIFS(p, scale, offset, ang5a, ang5b, it);
}
