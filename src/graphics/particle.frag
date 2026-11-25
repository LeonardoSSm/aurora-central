precision mediump float;
varying vec3 vColor;
varying float vLight;

void main() {
  float radius = length(gl_PointCoord - vec2(0.5)) * 2.0;
  float pin = 1.0 - smoothstep(0.13, 0.68, radius);
  float halo = 1.0 - smoothstep(0.25, 1.0, radius);
  float intensity = (pin * 0.92 + halo * 0.22) * vLight;
  vec3 color = mix(vColor, vec3(1.0, 0.82, 0.88), pin * vLight * 0.62);
  gl_FragColor = vec4(color, intensity);
}
