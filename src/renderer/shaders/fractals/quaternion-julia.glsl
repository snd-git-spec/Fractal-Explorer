// Quaternion Julia (Hart 1989) — expressive 4D cross-section.
// Vastness comes from a rotating 4D slice plane + full 4-component c,
// so auto-evolve reveals continuously different topologies, not one fixed blob.
vec4 qmul(vec4 a, vec4 b) {
  return vec4(
    a.x * b.x - a.y * b.y - a.z * b.z - a.w * b.w,
    a.x * b.y + a.y * b.x + a.z * b.w - a.w * b.z,
    a.x * b.z - a.y * b.w + a.z * b.x + a.w * b.y,
    a.x * b.w + a.y * b.z - a.z * b.y + a.w * b.x
  );
}

float sdeQuatJulia(vec3 pos, vec4 c, float ax, float ay, float az, int iters) {
  // Embed R³ → ℍ through a rotating 4D slice plane.
  // Angles morph which 3D "cut" of the 4D Julia you see — the main source of
  // topological variety (lobes, bridges, hollows appearing/disappearing).
  float cx = cos(ax), sx = sin(ax);
  float cy = cos(ay), sy = sin(ay);
  float cz = cos(az), sz = sin(az);

  // Rotate pos in XY, then XZ, then mix a W component from the rotated axes
  vec3 r = pos;
  r = vec3(r.x * cx - r.y * sx, r.x * sx + r.y * cx, r.z);
  r = vec3(r.x * cy - r.z * sy, r.y, r.x * sy + r.z * cy);
  float w = r.x * sz * 0.55 + r.y * sz * 0.35;
  vec4 q = vec4(r.x * cz, r.y, r.z, w);

  // Analytic derivative for a proper DE (not an orbit trap)
  vec4 qp = vec4(1.0, 0.0, 0.0, 0.0);
  float orbit = 0.0;
  float ow = 1.0;

  for (int i = 0; i < 32; i++) {
    if (i >= iters) break;
    qp = 2.0 * qmul(q, qp);
    q  = qmul(q, q) + c;

    float r = length(q);
    orbit += ow * exp(-r * 1.1);
    ow *= 0.7;

    if (dot(q, q) > 16.0) break;
  }

  gOrbit = clamp(orbit * 0.55, 0.0, 1.0);
  float rr = length(q);
  // Slightly thicker surface so the vast structure reads clearly at distance
  return 0.45 * log(max(rr, 0.0001)) * rr / max(length(qp), 0.0001);
}

float sceneSDE(vec3 p) {
  int it = int(u_iter);
  if (it > 28) it = 28;

  // Full 4D Julia constant — all four components morph independently.
  // Classic interesting region sits near |c| ≈ 0.7–1.1.
  vec4 c = vec4(
    u_jc.x * 0.55 - 0.12,
    u_jc.y * 0.55 + 0.22,
    u_bailout * 0.18 - 0.15,
    u_power * 0.055 - 0.35
  );

  // Slice-plane rotation angles — driven by power/bailout so evolve reshapes topology
  float ax = u_power * 0.22 + u_jc.x * 0.55;
  float ay = u_bailout * 0.35 + u_jc.y * 0.45;
  float az = u_jc.x * 0.40 - u_jc.y * 0.30 + u_power * 0.08;

  // Mild world-space scale-down so the set fills a larger visual field (vastness)
  return sdeQuatJulia(p * 0.85, c, ax, ay, az, it);
}
