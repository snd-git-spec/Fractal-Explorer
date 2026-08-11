// Penrose Quasicrystal — immersive golden caverns.
// Kali inversion + icosahedral φ trap, with curved bulk so walls aren't flat planes.

float smin(float a, float b, float k) {
  float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
  return mix(b, a, h) - k * h * (1.0 - h);
}

float sdePenroseCavern(vec3 p, vec3 param, float twist, int iters) {
  const float PHI = 1.6180339887;

  vec3 n1 = normalize(vec3(0.0, 1.0, PHI));
  vec3 n2 = normalize(vec3(0.0, -1.0, PHI));
  vec3 n3 = normalize(vec3(1.0, PHI, 0.0));
  vec3 n4 = normalize(vec3(-1.0, PHI, 0.0));
  vec3 n5 = normalize(vec3(PHI, 0.0, 1.0));
  vec3 n6 = normalize(vec3(PHI, 0.0, -1.0));

  float ct = cos(twist);
  float st = sin(twist);
  mat2 R = mat2(ct, st, -st, ct);

  float scale = 1.0;
  float trapCol = 1e5;

  for (int i = 0; i < 12; i++) {
    if (i >= iters) break;

    p = abs(p);
    p.xz = R * p.xz;

    float r2 = max(dot(p, p), 0.0002);
    scale /= r2;
    p = p / r2 - param;

    trapCol = min(trapCol, length(p) * 0.35 + float(i) * 0.04);
  }

  // Base: nearest golden / icosahedral sheet
  float d1 = abs(dot(p, n1));
  float d2 = abs(dot(p, n2));
  float d3 = abs(dot(p, n3));
  float d4 = abs(dot(p, n4));
  float d5 = abs(dot(p, n5));
  float d6 = abs(dot(p, n6));
  float planes = min(d1, min(d2, min(d3, min(d4, min(d5, d6)))));

  // Corrugate sheets in-plane so they stop reading as flat 2D walls
  float ridge =
    sin(dot(p, n1) * 5.2) * sin(dot(p, n3) * 4.1) * 0.055 +
    sin(dot(p, n5) * 3.7 + length(p) * 2.4) * 0.04;
  float sheets = abs(planes - ridge);

  // Volumetric bulk — golden sphere / tube fields break the planar look
  float shell = abs(length(p) - PHI * 0.42) * 0.55;
  float tubes =
    min(length(p.yz), min(length(p.xz), length(p.xy))) * 0.62 - 0.08;
  float vol = smin(shell, abs(tubes), 0.18);

  // Favour volume over bare planes (was ~100% plane trap before)
  float d = smin(sheets, vol, 0.22);
  d = mix(d, sheets, 0.28);

  gOrbit = clamp(trapCol, 0.0, 1.0);
  float planeId =
    d1 * 0.17 + d2 * 0.15 + d3 * 0.17 + d4 * 0.15 + d5 * 0.18 + d6 * 0.18;
  gOrbit = clamp(mix(gOrbit, fract(planeId * 2.5 + trapCol + length(p) * 0.2), 0.55), 0.0, 1.0);
  return d * abs(scale) * 0.22;
}

float sceneSDE(vec3 p) {
  int it = int(u_iter);
  if (it > 9) it = 9;
  if (it < 5) it = 5;

  vec3 param = vec3(
    clamp(0.85 + u_jc.x * 0.2 + (u_power - 8.0) * 0.012, 0.5, 1.18),
    clamp(0.80 + u_jc.y * 0.18, 0.48, 1.12),
    clamp(0.58 + u_bailout * 0.05, 0.35, 0.98)
  );
  float twist = clamp(u_jc.x * 0.12 + u_jc.y * 0.08, -0.3, 0.3);

  return sdePenroseCavern(p * 0.48, param, twist, it);
}
