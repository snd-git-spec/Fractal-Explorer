// Menger Sponge — IFS cross-subtraction, infinite across scales.
// S = ⋃_k sc^k · A — same sponge at every size. Fold space into one scale
// shell, then measure A — zoom out/in both hit the lattice forever.
// u_jc.x  — branching scale:  widens/narrows the sponge holes
// u_jc.y  — cross spread:     varies the cross-section bar thickness
// Soft orbit trap so colour follows faces / recursion depth (not AO sparkle).

float sdeMenger(vec3 pos, float branch, float spread, int iters) {
  vec3 q0 = abs(pos) - vec3(1.0);
  float d = length(max(q0, 0.0)) + min(max(q0.x, max(q0.y, q0.z)), 0.0);
  float s = 1.0;
  float orbit = 0.0;
  float faceAcc = 0.0;
  float ow = 1.0;

  for (int i = 0; i < 16; i++) {
    if (i >= iters) break;
    vec3 a = mod(pos * s, 2.0) - 1.0;
    s *= branch;
    vec3 rr = abs(1.0 - spread * abs(a));
    float da = max(rr.x, rr.y);
    float db = max(rr.y, rr.z);
    float dc = max(rr.z, rr.x);
    float cross = min(da, min(db, dc)) - 1.0;
    d = max(d, cross / s);

    vec3 aa = abs(a);
    float face = max(aa.x, max(aa.y, aa.z));
    float faceSel = aa.x >= aa.y && aa.x >= aa.z ? 0.12 : (aa.y >= aa.z ? 0.48 : 0.82);
    vec2 fuv = aa.x >= aa.y && aa.x >= aa.z ? aa.yz : (aa.y >= aa.z ? aa.xz : aa.xy);
    float faceSamp =
      faceSel * 0.45 +
      (0.5 + 0.5 * sin(fuv.x * 1.35)) * 0.3 +
      (0.5 + 0.5 * sin(fuv.y * 1.2)) * 0.25;
    float wx = exp(-abs(a.x) * 2.4);
    float wy = exp(-abs(a.y) * 2.4);
    float wz = exp(-abs(a.z) * 2.4);
    float wsum = wx + wy + wz + 1e-4;
    float axis = (wx * 0.1 + wy * 0.4 + wz * 0.75) / wsum;
    orbit += ow * (
      0.35 * exp(-abs(cross) * 1.8) +
      0.25 * exp(-face * 1.4) +
      0.25 * faceSamp +
      0.15 * axis
    );
    faceAcc += ow * faceSamp;
    ow *= 0.62;
  }

  gOrbit = clamp(orbit * 0.6, 0.0, 1.0);
  gFace = clamp(faceAcc * 0.9, 0.0, 1.0);
  return d;
}

float sceneSDE(vec3 p) {
  int it = int(u_iter);
  float branch = clamp(u_power * 0.045 + 2.65 + u_jc.x * 0.18, 2.2, 3.8);
  float spread = clamp(3.0 + u_jc.y * 0.40, 2.2, 3.9);

  // Generation ratio = sponge subdivision (classic 3, morphs with branch)
  float sc = branch;

  // Unit sponge fills L∞ ≤ 1 — shell [1/sc, 1) is filled by A (no empty halo)
  float R = 1.0 / sc;
  float scale = 1.0;
  for (int i = 0; i < 16; i++) {
    float m = max(abs(p.x), max(abs(p.y), abs(p.z)));
    if (m >= R * sc) {
      p /= sc;
      scale *= sc;
    } else if (m < R) {
      p *= sc;
      scale /= sc;
    } else {
      break;
    }
  }

  // Deeper inward shells keep hole cuts sharp when zoomed in
  float deep = clamp(log(1.0 / max(scale, 1e-4)) / log(sc), 0.0, 5.0);
  it = int(min(float(it) + deep, 16.0));

  return sdeMenger(p, branch, spread, it) * scale;
}
