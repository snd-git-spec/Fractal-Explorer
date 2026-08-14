// Dodecahedron IFS — true 20-vertex geometry, self-similar across scales.
// S = ⋃_k sc^k · A  (same IFS solid at every size). Fold space into one
// scale shell, then measure A — zoom out/in both hit the same geometry, forever.
// Morph = spin / stretch / φ-breathe of the solid + recursion scale.

vec3 rotX(vec3 p, float a) {
  float c = cos(a), s = sin(a);
  return vec3(p.x, c * p.y - s * p.z, s * p.y + c * p.z);
}

vec3 rotY(vec3 p, float a) {
  float c = cos(a), s = sin(a);
  return vec3(c * p.x + s * p.z, p.y, -s * p.x + c * p.z);
}

vec3 rotZ(vec3 p, float a) {
  float c = cos(a), s = sin(a);
  return vec3(c * p.x - s * p.y, s * p.x + c * p.y, p.z);
}

vec3 morphVert(vec3 v, float ax, float ay, float az, vec3 stretch) {
  v *= stretch;
  v = rotZ(v, az);
  v = rotY(v, ay);
  v = rotX(v, ax);
  return v;
}

// Inverse of morphVert — transform the query into canonical solid space (cheap IFS)
vec3 invMorph(vec3 v, float ax, float ay, float az, vec3 stretch) {
  v = rotX(v, -ax);
  v = rotY(v, -ay);
  v = rotZ(v, -az);
  v /= max(stretch, vec3(1e-3));
  return v;
}

void consider(inout vec3 best, inout float md, vec3 p, vec3 v) {
  float d = dot(p - v, p - v);
  if (d < md) {
    md = d;
    best = v;
  }
}

// Fixed dodecahedron vertices in canonical space (8 + 12 golden)
vec3 nearestDodecaFixed(vec3 p, float phi, float rad) {
  float inv = 1.0 / max(phi, 0.5);
  vec3 best = vec3(0.0);
  float md = 1e20;

  consider(best, md, p, vec3(1.0, 1.0, 1.0) * rad);
  consider(best, md, p, vec3(1.0, 1.0, -1.0) * rad);
  consider(best, md, p, vec3(1.0, -1.0, 1.0) * rad);
  consider(best, md, p, vec3(1.0, -1.0, -1.0) * rad);
  consider(best, md, p, vec3(-1.0, 1.0, 1.0) * rad);
  consider(best, md, p, vec3(-1.0, 1.0, -1.0) * rad);
  consider(best, md, p, vec3(-1.0, -1.0, 1.0) * rad);
  consider(best, md, p, vec3(-1.0, -1.0, -1.0) * rad);

  consider(best, md, p, vec3(0.0, inv, phi) * rad);
  consider(best, md, p, vec3(0.0, inv, -phi) * rad);
  consider(best, md, p, vec3(0.0, -inv, phi) * rad);
  consider(best, md, p, vec3(0.0, -inv, -phi) * rad);

  consider(best, md, p, vec3(inv, phi, 0.0) * rad);
  consider(best, md, p, vec3(inv, -phi, 0.0) * rad);
  consider(best, md, p, vec3(-inv, phi, 0.0) * rad);
  consider(best, md, p, vec3(-inv, -phi, 0.0) * rad);

  consider(best, md, p, vec3(phi, 0.0, inv) * rad);
  consider(best, md, p, vec3(phi, 0.0, -inv) * rad);
  consider(best, md, p, vec3(-phi, 0.0, inv) * rad);
  consider(best, md, p, vec3(-phi, 0.0, -inv) * rad);

  return best;
}

float sdeDodecaInfinite(
  vec3 p,
  float sc,
  float phi,
  float ax,
  float ay,
  float az,
  vec3 stretch,
  float rad,
  int iters,
  float minFeat
) {
  float orbit = 0.0;
  float ow = 1.0;
  float DEf = 1.0;

  for (int i = 0; i < 64; i++) {
    if (i >= iters) break;

    vec3 q = invMorph(p, ax, ay, az, stretch);
    vec3 cv = morphVert(nearestDodecaFixed(q, phi, rad), ax, ay, az, stretch);

    p = sc * p - cv * (sc - 1.0);
    DEf *= sc;

    float r = length(p);
    orbit += ow * exp(-r * 0.85);
    ow *= 0.72;

    float feat = r / max(DEf, 1e-4);
    if (feat < minFeat) break;
    if (r > 1e5) break;
  }

  gOrbit = clamp(orbit * 0.5, 0.0, 1.0);
  return length(p) / max(DEf, 1e-4) * 0.8;
}

float sceneSDE(vec3 p) {
  gIsoShade = 1.0;

  float tDet = clamp((u_iter - 8.0) / 56.0, 0.0, 1.0);

  float zoomBoost = clamp((3.0 - u_zoom) / 3.0, 0.0, 1.0);
  float deepBoost = clamp((0.5 - u_zoom) / 0.45, 0.0, 1.0);
  int it = int(mix(18.0, 48.0, tDet) + zoomBoost * 8.0 + deepBoost * 14.0);
  if (it > 64) it = 64;

  float minFeat = max(u_zoom * 0.00008, 2e-8);

  const float PHI = 1.6180339887;

  float mx = clamp(u_jc.x, -1.15, 1.15);
  float my = clamp(u_jc.y, -1.15, 1.15);
  float tPow = clamp((u_power - 4.0) / 10.0, 0.0, 1.0);
  float tBail = clamp((u_bailout - 1.5) / 3.5, 0.0, 1.0);

  float sc = mix(1.78, 2.42, tPow);
  float rad = mix(0.55, 0.95, tBail);

  float ax = my * 1.35 + (tBail - 0.5) * 0.35;
  float ay = mx * 1.55 + (tPow - 0.5) * 0.4;
  float az = mx * 0.65 + my * 0.55 + (u_power - 8.0) * 0.08;

  vec3 stretch = vec3(
    1.0 + mx * 0.48,
    1.0 + my * 0.52 + (tBail - 0.5) * 0.2,
    1.0 - mx * 0.28 + my * 0.22
  );
  stretch = clamp(stretch, vec3(0.55), vec3(1.55));

  float phi = PHI + mx * 0.28 + my * 0.22 + (tPow - 0.5) * 0.2;

  float k = 0.95;
  p *= k;

  // Characteristic radius of one generation A. Fold any point into the shell
  // [R, R·sc) so measuring A once = measuring every scaled copy of A to ∞.
  float R = rad * 1.55;
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

  float feat = minFeat / max(scale, 1e-6);
  return sdeDodecaInfinite(p, sc, phi, ax, ay, az, stretch, rad, it, feat) * scale / k;
}
