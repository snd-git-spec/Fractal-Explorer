// Dodecahedron IFS — true 20-vertex geometry, self-similar across scales.
// S = ⋃_k sc^k · A  (same IFS solid at every size). Fold space into one
// scale shell, then measure A — zoom out/in both hit the same geometry, forever.
// Solid shade (not isoline bands — those read as grain on Full Spectrum).

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

vec3 invMorph(vec3 v, float ax, float ay, float az, vec3 stretch) {
  v = rotX(v, -ax);
  v = rotY(v, -ay);
  v = rotZ(v, -az);
  v /= max(stretch, vec3(1e-3));
  return v;
}

void considerD(inout vec3 best, inout float md, vec3 p, vec3 v) {
  float d = dot(p - v, p - v);
  if (d < md) {
    md = d;
    best = v;
  }
}

vec3 nearestDodecaFixed(vec3 p, float phi, float rad) {
  float inv = 1.0 / max(phi, 0.5);
  vec3 best = vec3(0.0);
  float md = 1e20;

  considerD(best, md, p, vec3(1.0, 1.0, 1.0) * rad);
  considerD(best, md, p, vec3(1.0, 1.0, -1.0) * rad);
  considerD(best, md, p, vec3(1.0, -1.0, 1.0) * rad);
  considerD(best, md, p, vec3(1.0, -1.0, -1.0) * rad);
  considerD(best, md, p, vec3(-1.0, 1.0, 1.0) * rad);
  considerD(best, md, p, vec3(-1.0, 1.0, -1.0) * rad);
  considerD(best, md, p, vec3(-1.0, -1.0, 1.0) * rad);
  considerD(best, md, p, vec3(-1.0, -1.0, -1.0) * rad);

  considerD(best, md, p, vec3(0.0, inv, phi) * rad);
  considerD(best, md, p, vec3(0.0, inv, -phi) * rad);
  considerD(best, md, p, vec3(0.0, -inv, phi) * rad);
  considerD(best, md, p, vec3(0.0, -inv, -phi) * rad);

  considerD(best, md, p, vec3(inv, phi, 0.0) * rad);
  considerD(best, md, p, vec3(inv, -phi, 0.0) * rad);
  considerD(best, md, p, vec3(-inv, phi, 0.0) * rad);
  considerD(best, md, p, vec3(-inv, -phi, 0.0) * rad);

  considerD(best, md, p, vec3(phi, 0.0, inv) * rad);
  considerD(best, md, p, vec3(phi, 0.0, -inv) * rad);
  considerD(best, md, p, vec3(-phi, 0.0, inv) * rad);
  considerD(best, md, p, vec3(-phi, 0.0, -inv) * rad);

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
  float faceAcc = 0.0;
  float ow = 1.0;
  float DEf = 1.0;

  for (int i = 0; i < 48; i++) {
    if (i >= iters) break;

    vec3 q = invMorph(p, ax, ay, az, stretch);
    vec3 cv = morphVert(nearestDodecaFixed(q, phi, rad), ax, ay, az, stretch);

    p = sc * p - cv * (sc - 1.0);
    DEf *= sc;

    float r = length(p);
    // Smooth orbit — low-freq only (no high-freq face noise)
    orbit += ow * exp(-r * 0.75);
    faceAcc += ow * (0.55 + 0.45 * sin(dot(normalize(cv + 1e-4), vec3(0.7, 1.1, 0.4)) * 2.0));
    ow *= 0.74;

    float feat = r / max(DEf, 1e-4);
    if (feat < minFeat) break;
    if (r > 1e5) break;
  }

  gOrbit = clamp(orbit * 0.55, 0.0, 1.0);
  gFace = clamp(faceAcc * 0.7, 0.0, 1.0);
  // Readable solid lace — thick enough to see, open enough to navigate
  return 0.58 * length(p) / max(DEf, 1e-4);
}

float sceneSDE(vec3 p) {
  // Solid lighting — isoline bands were the grainy Full-Spectrum look
  gIsoShade = 0.0;

  float tDet = clamp((u_iter - 8.0) / 56.0, 0.0, 1.0);

  float zoomBoost = clamp((3.0 - u_zoom) / 3.0, 0.0, 1.0);
  float deepBoost = clamp((0.5 - u_zoom) / 0.45, 0.0, 1.0);
  int it = int(mix(14.0, 36.0, tDet) + zoomBoost * 6.0 + deepBoost * 10.0);
  if (it > 42) it = 42;

  float minFeat = max(u_zoom * 0.00012, 4e-8);

  const float PHI = 1.6180339887;

  float mx = clamp(u_jc.x, -1.15, 1.15);
  float my = clamp(u_jc.y, -1.15, 1.15);
  float tPow = clamp((u_power - 4.0) / 10.0, 0.0, 1.0);
  float tBail = clamp((u_bailout - 1.5) / 3.5, 0.0, 1.0);

  // Structured lace band — dense enough to fill the view, open enough to fly
  // (too-high sc → empty; too-low sc → dust you punch through)
  float sc = mix(1.88, 2.22, tPow);
  float rad = mix(0.7, 0.98, tBail);

  float ax = my * 0.9 + (tBail - 0.5) * 0.22;
  float ay = mx * 1.0 + (tPow - 0.5) * 0.25;
  float az = mx * 0.42 + my * 0.38 + (u_power - 8.0) * 0.05;

  vec3 stretch = vec3(
    1.0 + mx * 0.28,
    1.0 + my * 0.3 + (tBail - 0.5) * 0.12,
    1.0 - mx * 0.18 + my * 0.14
  );
  stretch = clamp(stretch, vec3(0.78), vec3(1.28));

  float phi = PHI + mx * 0.16 + my * 0.12 + (tPow - 0.5) * 0.1;

  float k = 0.92;
  p *= k;

  float R = rad * 1.65;
  float scale = 1.0;
  for (int i = 0; i < 14; i++) {
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
