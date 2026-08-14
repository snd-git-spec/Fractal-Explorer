// Quaternion Julia (Hart 1989) — expressive 4D cross-section, infinite across scales.
// Form is the original Hart DE + rotating slice. Outward infinity is only a
// scale-shell fold sized to the set so copies don't leave empty gaps (fade → 0).

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
  float cx = cos(ax), sx = sin(ax);
  float cy = cos(ay), sy = sin(ay);
  float cz = cos(az), sz = sin(az);

  vec3 r = pos;
  r = vec3(r.x * cx - r.y * sx, r.x * sx + r.y * cx, r.z);
  r = vec3(r.x * cy - r.z * sy, r.y, r.x * sy + r.z * cy);
  float w = r.x * sz * 0.55 + r.y * sz * 0.35;
  vec4 q = vec4(r.x * cz, r.y, r.z, w);

  vec4 qp = vec4(1.0, 0.0, 0.0, 0.0);
  float orbit = 0.0;
  float ow = 1.0;

  for (int i = 0; i < 32; i++) {
    if (i >= iters) break;
    qp = 2.0 * qmul(q, qp);
    q  = qmul(q, q) + c;

    float rq = length(q);
    orbit += ow * exp(-rq * 1.1);
    ow *= 0.7;

    if (dot(q, q) > 16.0) break;
  }

  gOrbit = clamp(orbit * 0.55, 0.0, 1.0);
  float rr = length(q);
  return 0.45 * log(max(rr, 0.0001)) * rr / max(length(qp), 0.0001);
}

float sceneSDE(vec3 p) {
  int it = int(u_iter);
  if (it > 28) it = 28;

  // Original morph range — expressive topologies, not a fat clamped bulb
  vec4 c = vec4(
    u_jc.x * 0.55 - 0.12,
    u_jc.y * 0.55 + 0.22,
    u_bailout * 0.18 - 0.15,
    u_power * 0.055 - 0.35
  );

  float ax = u_power * 0.22 + u_jc.x * 0.55;
  float ay = u_bailout * 0.35 + u_jc.y * 0.45;
  float az = u_jc.x * 0.40 - u_jc.y * 0.30 + u_power * 0.08;

  // Shell sized to the set extent (~1.1): [R, R·sc) ≈ filled by A — no empty halo
  float tPow = clamp((u_power - 4.0) / 10.0, 0.0, 1.0);
  float sc = mix(1.52, 1.72, tPow);

  float k = 0.85;
  p *= k;

  float R = 0.70;
  float scale = 1.0;
  for (int i = 0; i < 16; i++) {
    float r = length(p);
    if (r >= R * sc) {
      p /= sc;
      scale *= sc;
    } else if (r < R) {
      p *= sc;
      scale /= sc;
    } else {
      break;
    }
  }

  float deep = clamp(log(1.0 / max(scale, 1e-4)) / log(sc), 0.0, 5.0);
  it = int(min(float(it) + deep, 32.0));

  return sdeQuatJulia(p, c, ax, ay, az, it) * scale / k;
}
