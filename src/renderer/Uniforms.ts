export interface UniformLocations {
  res: WebGLUniformLocation | null;
  time: WebGLUniformLocation | null;
  rotY: WebGLUniformLocation | null;
  rotX: WebGLUniformLocation | null;
  zoom: WebGLUniformLocation | null;
  pan: WebGLUniformLocation | null;
  power: WebGLUniformLocation | null;
  bailout: WebGLUniformLocation | null;
  iter: WebGLUniformLocation | null;
  jc: WebGLUniformLocation | null;
  colorShift: WebGLUniformLocation | null;
  bright: WebGLUniformLocation | null;
  palette: WebGLUniformLocation | null;
  fov: WebGLUniformLocation | null;
  fog: WebGLUniformLocation | null;
  gamma: WebGLUniformLocation | null;
  vignette: WebGLUniformLocation | null;
  softShadow: WebGLUniformLocation | null;
  maxSteps: WebGLUniformLocation | null;
}

export function getUniformLocations(
  gl: WebGLRenderingContext,
  program: WebGLProgram,
): UniformLocations {
  return {
    res: gl.getUniformLocation(program, 'u_res'),
    time: gl.getUniformLocation(program, 'u_time'),
    rotY: gl.getUniformLocation(program, 'u_rotY'),
    rotX: gl.getUniformLocation(program, 'u_rotX'),
    zoom: gl.getUniformLocation(program, 'u_zoom'),
    pan: gl.getUniformLocation(program, 'u_pan'),
    power: gl.getUniformLocation(program, 'u_power'),
    bailout: gl.getUniformLocation(program, 'u_bailout'),
    iter: gl.getUniformLocation(program, 'u_iter'),
    jc: gl.getUniformLocation(program, 'u_jc'),
    colorShift: gl.getUniformLocation(program, 'u_colorShift'),
    bright: gl.getUniformLocation(program, 'u_bright'),
    palette: gl.getUniformLocation(program, 'u_palette'),
    fov: gl.getUniformLocation(program, 'u_fov'),
    fog: gl.getUniformLocation(program, 'u_fog'),
    gamma: gl.getUniformLocation(program, 'u_gamma'),
    vignette: gl.getUniformLocation(program, 'u_vignette'),
    softShadow: gl.getUniformLocation(program, 'u_softShadow'),
    maxSteps: gl.getUniformLocation(program, 'u_maxSteps'),
  };
}

export interface UniformValues {
  width: number;
  height: number;
  time: number;
  rotY: number;
  rotX: number;
  zoom: number;
  panX: number;
  panY: number;
  power: number;
  bailout: number;
  iter: number;
  cx: number;
  cy: number;
  colorShift: number;
  bright: number;
  palette: number;
  fov: number;
  fog: number;
  gamma: number;
  vignette: number;
  softShadow: number;
  maxSteps: number;
}

export function uploadUniforms(
  gl: WebGLRenderingContext,
  U: UniformLocations,
  v: UniformValues,
): void {
  gl.uniform2f(U.res, v.width, v.height);
  gl.uniform1f(U.time, v.time);
  gl.uniform1f(U.rotY, v.rotY);
  gl.uniform1f(U.rotX, v.rotX);
  gl.uniform1f(U.zoom, v.zoom);
  gl.uniform2f(U.pan, v.panX, v.panY);
  gl.uniform1f(U.power, v.power);
  gl.uniform1f(U.bailout, v.bailout);
  gl.uniform1f(U.iter, v.iter);
  gl.uniform2f(U.jc, v.cx, v.cy);
  gl.uniform1f(U.colorShift, v.colorShift);
  gl.uniform1f(U.bright, v.bright);
  gl.uniform1i(U.palette, v.palette);
  gl.uniform1f(U.fov, v.fov);
  gl.uniform1f(U.fog, v.fog);
  gl.uniform1f(U.gamma, v.gamma);
  gl.uniform1f(U.vignette, v.vignette);
  gl.uniform1f(U.softShadow, v.softShadow);
  gl.uniform1f(U.maxSteps, v.maxSteps);
}
