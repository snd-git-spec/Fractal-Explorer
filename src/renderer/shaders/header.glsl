precision highp float;

uniform vec2  u_res;
uniform float u_time;
uniform float u_rotY;
uniform float u_rotX;
uniform float u_zoom;
uniform vec2  u_pan;
uniform float u_power;
uniform float u_bailout;
uniform float u_iter;
uniform vec2  u_jc;
uniform float u_colorShift;
uniform float u_bright;
uniform int   u_palette;
uniform float u_fov;
uniform float u_fog;
uniform float u_gamma;
uniform float u_vignette;
uniform float u_softShadow;
uniform float u_maxSteps;

#define MAX_STEPS 160
#define MAX_DIST  24.0
#define MIN_DIST  0.0005

mat3 mRotX(float a) {
  float c = cos(a), s = sin(a);
  return mat3(1, 0, 0, 0, c, -s, 0, s, c);
}

mat3 mRotY(float a) {
  float c = cos(a), s = sin(a);
  return mat3(c, 0, s, 0, 1, 0, -s, 0, c);
}
