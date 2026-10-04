// Hyperbolic Kaleidoscope — GLSL DE + shell thickness so the cusp set fills the frame.
// Pure zero-set is hairline (~1% hit rate); a ~0.01 shell matches the explorer’s filled look.

struct Params {
  resolution: vec2f,
  yaw: f32,
  pitch: f32,
  zoom: f32,
  time: f32,
}
@group(0) @binding(0) var<uniform> params: Params;

const PHI = 1.6180339887;
const MAX_DIST = 20.0;
const FOV = 1.4;
// Shell around the thin IFS surface — without this, rays miss almost everything
const HIT_EPS = 0.006;

struct DistSample {
  d: f32,
  orbit: f32,
}

fn kaleidoDistance(point: vec3f, power: f32, bailout: f32, cx: f32, cy: f32) -> DistSample {
  var p = point * 0.4;
  let n1 = normalize(vec3f(0.0, 1.0, PHI));
  let n2 = normalize(vec3f(1.0, PHI, 0.0));
  let n3 = normalize(vec3f(PHI, 0.0, 1.0));

  var sphR = clamp(0.9 + (power - 8.0) * 0.035, 0.7, 1.25);
  sphR = clamp(sphR + (bailout - 3.0) * 0.025, 0.6, 1.35);
  let sc = clamp(1.22 + (power - 8.0) * 0.02, 1.12, 1.48);
  let offset = vec3f(
    clamp(0.55 + cx * 0.28, 0.2, 1.0),
    clamp(0.4 + cy * 0.25, 0.15, 0.9),
    clamp(0.45 + cx * 0.1 - cy * 0.08, 0.15, 0.95),
  );
  let twist = clamp(cx * 0.14 + cy * 0.1, -0.35, 0.35);
  let ct = cos(twist);
  let st = sin(twist);

  var DEf = 1.0;
  var trap = 1e5;
  let sphR2 = sphR * sphR;

  for (var i = 0; i < 12; i++) {
    p = abs(p);
    let xz = vec2f(p.x * ct - p.z * st, p.x * st + p.z * ct);
    p = vec3f(xz.x, p.y, xz.y);

    p = p - 2.0 * min(0.0, dot(p, n1)) * n1;
    p = p - 2.0 * min(0.0, dot(p, n2)) * n2;
    p = p - 2.0 * min(0.0, dot(p, n3)) * n3;
    p = abs(p);

    let r2 = max(dot(p, p), 1e-4);
    let kInv = sphR2 / r2;
    p = p * kInv;
    DEf = DEf * kInv;

    p = p * sc - offset * (sc - 1.0);
    DEf = DEf * abs(sc);
    DEf = clamp(DEf, 1e-4, 1e5);

    trap = min(trap, length(p) * 0.28 + f32(i) * 0.05);
  }

  let d = length(p) / max(DEf, 1e-4) * 0.2;
  return DistSample(d, clamp(trap * 0.55, 0.0, 1.0));
}

fn normalAt(p: vec3f, e: f32, power: f32, bailout: f32, cx: f32, cy: f32) -> vec3f {
  let k0 = vec3f(1.0, -1.0, -1.0);
  let k1 = vec3f(-1.0, -1.0, 1.0);
  let k2 = vec3f(-1.0, 1.0, -1.0);
  let k3 = vec3f(1.0, 1.0, 1.0);
  return normalize(
    k0 * kaleidoDistance(p + k0 * e, power, bailout, cx, cy).d +
    k1 * kaleidoDistance(p + k1 * e, power, bailout, cx, cy).d +
    k2 * kaleidoDistance(p + k2 * e, power, bailout, cx, cy).d +
    k3 * kaleidoDistance(p + k3 * e, power, bailout, cx, cy).d
  );
}

fn aoAt(p: vec3f, n: vec3f, power: f32, bailout: f32, cx: f32, cy: f32) -> f32 {
  var occ = 0.0;
  var w = 1.0;
  for (var i = 1; i <= 5; i++) {
    let dist = 0.015 * f32(i) * f32(i);
    occ = occ + max(dist - kaleidoDistance(p + n * dist, power, bailout, cx, cy).d, 0.0) * w;
    w = w * 0.65;
  }
  return clamp(1.0 - occ * 1.7, 0.3, 1.0);
}

fn palette(o: f32, spin: f32) -> vec3f {
  let h = fract(o * 2.5 + spin);
  let c0 = vec3f(0.05, 0.95, 1.0);
  let c1 = vec3f(1.0, 0.1, 0.85);
  let c2 = vec3f(1.0, 0.85, 0.12);
  let c3 = vec3f(0.55, 0.15, 1.0);
  let ab = mix(c0, c1, smoothstep(0.0, 0.28, h));
  let bc = mix(ab, c2, smoothstep(0.28, 0.6, h));
  return mix(bc, c3, smoothstep(0.6, 1.0, h));
}

@fragment fn fs_main(@location(0) uv: vec2f) -> @location(0) vec4f {
  let t = params.time;
  let zoom = 0.2;
  let yaw = 0.75 + t * 0.12;
  let pitch = 0.4;
  // Slightly hotter than Stained Glass — more nest / cusp contrast
  let power = 8.8;
  let bailout = 3.2;
  let cx = -0.25 + 0.12 * sin(t * 0.11);
  let cy = -0.2 + 0.1 * cos(t * 0.09);

  let cp = cos(pitch);
  let sp = sin(pitch);
  let cyA = cos(yaw);
  let sy = sin(yaw);

  let ro = zoom * vec3f(cp * sy, -sp, cp * cyA);
  let forward = normalize(-ro);
  var worldUp = vec3f(0.0, 1.0, 0.0);
  if (abs(forward.y) > 0.92) {
    worldUp = vec3f(0.0, 0.0, 1.0);
  }
  let right = normalize(cross(worldUp, forward));
  let up = cross(forward, right);

  let aspect = params.resolution.x / max(params.resolution.y, 1.0);
  let screen = vec2f((uv.x - 0.5) * aspect, 0.5 - uv.y);
  let rd = normalize(forward + (right * screen.x + up * screen.y) / FOV);

  var travel = 0.001;
  var hit = false;
  var orbit = 0.0;
  var stepsTaken = 0;

  for (var step = 0; step < 160; step++) {
    stepsTaken = step;
    let sample = kaleidoDistance(ro + rd * travel, power, bailout, cx, cy);
    if (sample.d < HIT_EPS) {
      hit = true;
      orbit = sample.orbit;
      break;
    }
    travel += sample.d * 0.72;
    if (travel > MAX_DIST) {
      break;
    }
  }

  if (!hit) {
    return vec4f(0.0, 0.008, 0.025, 1.0);
  }

  let p = ro + rd * travel;
  let n = normalAt(p, 0.002, power, bailout, cx, cy);
  orbit = kaleidoDistance(p, power, bailout, cx, cy).orbit;
  let ao = aoAt(p, n, power, bailout, cx, cy);
  let key = normalize(vec3f(0.75, 0.55, 0.4));
  let fillL = normalize(vec3f(-0.55, 0.35, 0.75));
  let dif1 = clamp(dot(n, key), 0.0, 1.0);
  let dif2 = clamp(dot(n, fillL), 0.0, 1.0);
  let fres = pow(1.0 - abs(dot(n, -rd)), 2.6);

  let trap = pow(orbit, 0.5);
  let face = fract(abs(n.x) * 0.5 + abs(n.y) * 0.4 + abs(n.z) * 0.35);
  let phase = clamp(trap * 0.85 + face * 0.95 + (1.0 - ao) * 0.2, 0.0, 1.0);
  let spin = fract(trap * 2.6 + face * 0.4 + t * 0.12);

  var col = palette(phase, spin);
  col = mix(col, palette(fract(phase + 0.2), spin * 0.7), 0.4);
  col = mix(col, palette(fract(phase + 0.45), spin * 0.5), 0.18);
  col = col * ((0.2 + 1.1 * dif1 + 0.4 * dif2) * ao);
  col = col + palette(fract(phase + 0.12), spin) * fres * 0.75;
  col = col * (1.0 - 0.18 * pow(f32(stepsTaken) / 160.0, 0.5));
  col = mix(col, vec3f(0.0, 0.008, 0.025), clamp(travel / MAX_DIST, 0.0, 1.0) * 0.65);
  col = pow(max(col, vec3f(0.0)), vec3f(0.52));
  return vec4f(col, 1.0);
}
