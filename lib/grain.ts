/**
 * Film grain over the whole background: a small standalone WebGL canvas laid over the scene.
 *  - sized in CSS pixels (one grain = one CSS pixel);
 *  - triangular noise (two uniform draws), so it clusters round zero like real film;
 *  - re-rolled every frame, like projected film.
 * Drawn as a transparent overlay: dark specks where the noise is negative, light ones where positive.
 */

const VERT = `
attribute vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }`;

const FRAG = `
precision highp float;
uniform float uAmount;
uniform float uCell;
uniform float uSeed;

float grainHash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21) + uSeed);
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

void main() {
  vec2 cell = floor(gl_FragCoord.xy / uCell);
  float n = grainHash(cell) + grainHash(cell + 17.13) - 1.0;
  float a = abs(n) * uAmount;
  vec3 c = n > 0.0 ? vec3(1.0) : vec3(0.0);
  gl_FragColor = vec4(c * a, a); // premultiplied
}`;

export type Grain = {
  resize: () => void;
  render: () => void;
  dispose: () => void;
};

/** Adds a full-size grain canvas on top of `host`. Returns null when WebGL isn't available. */
export function createGrain(host: HTMLElement, { amount = 0.07 }: { amount?: number } = {}): Grain | null {
  const canvas = document.createElement("canvas");
  canvas.className = "grain";
  const gl = canvas.getContext("webgl", { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false });
  if (!gl) return null;

  const compile = (type: number, src: string) => {
    const s = gl.createShader(type)!;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    return s;
  };
  const program = gl.createProgram()!;
  const vs = compile(gl.VERTEX_SHADER, VERT);
  const fs = compile(gl.FRAGMENT_SHADER, FRAG);
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return null;
  gl.useProgram(program);

  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const aPos = gl.getAttribLocation(program, "aPos");
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

  const uAmount = gl.getUniformLocation(program, "uAmount");
  const uCell = gl.getUniformLocation(program, "uCell");
  const uSeed = gl.getUniformLocation(program, "uSeed");
  gl.uniform1f(uAmount, amount);

  host.appendChild(canvas);

  const resize = () => {
    const ratio = Math.min(window.devicePixelRatio || 1, 1.5);
    const w = Math.max(1, Math.round(host.clientWidth * ratio));
    const h = Math.max(1, Math.round(host.clientHeight * ratio));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    gl.viewport(0, 0, w, h);
    gl.uniform1f(uCell, Math.max(1, ratio));
  };

  const render = () => {
    gl.uniform1f(uSeed, Math.random() * 100);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };

  const dispose = () => {
    gl.deleteBuffer(buffer);
    gl.deleteProgram(program);
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    canvas.remove();
  };

  resize();
  return { resize, render, dispose };
}
