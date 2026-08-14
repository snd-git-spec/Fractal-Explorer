// Pseudo-Kleinian (Knighty / Theli-at) — scale-1 Julia box folds + plane trap.
// Hard architectural band: extreme UI / evolve values cannot collapse into foam.

float sdePseudoKleinian(vec3 p, float size, vec3 cSize, vec3 c, int iters) {
  float def = 1.0;
  vec3 ap = p + 1.0;
  float orbit = 0.0;
  float ow = 1.0;

  for (int i = 0; i < 16; i++) {
    if (i >= iters) break;
    if (dot(ap - p, ap - p) < 1e-12) break;
    ap = p;

    p = 2.0 * clamp(p, -cSize, cSize) - p;

    float r2 = dot(p, p);
    float k = max(size / max(r2, 1e-8), 1.0);
    p *= k;
    def *= k;

    p += c;

    // Keep DE thick — runaway def → hairline dust
    if (def > 800.0) {
      p *= 800.0 / def;
      def = 800.0;
      break;
    }

    float r = length(p);
    float face = max(abs(p.x), max(abs(p.y), abs(p.z)));
    orbit += ow * (0.55 * exp(-r * 1.05) + 0.45 * exp(-face * 1.3));
    ow *= 0.72;
  }

  gOrbit = clamp(orbit * 0.55, 0.0, 1.0);
  // Plane trap — cathedral slabs / corridors
  return 0.75 * abs(p.z) / max(abs(def), 1e-4);
}

float sceneSDE(vec3 p) {
  int it = int(u_iter);
  if (it > 11) it = 11;
  if (it < 5) it = 5;

  // Map full slider range into a SAFE architectural band only
  float size = mix(0.88, 1.18, clamp((u_power - 2.5) / 12.0, 0.0, 1.0));
  float cs = mix(0.92, 1.18, clamp((u_bailout - 1.0) / 5.0, 0.0, 1.0));
  vec3 cSize = vec3(cs, cs * 0.96, cs * 1.02);

  // Julia drifts corridors — capped so it never shreds the lattice
  vec2 j = clamp(u_jc, vec2(-0.85), vec2(0.85));
  vec3 c = vec3(j.x, j.y, -j.x * 0.35 - j.y * 0.18) * 0.42;

  float k = 1.05;
  return sdePseudoKleinian(p * k, size, cSize, c, it) / k;
}
