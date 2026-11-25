precision mediump float;

in vec3 vColor;
in float vLight;
out vec4 fragment;

void main() {
  vec2 point = gl_PointCoord * 2.0 - 1.0;
  float radius = dot(point, point);
  float pin = 1.0 - smoothstep(0.025, 0.60, radius);
  float halo = 1.0 - smoothstep(0.10, 1.0, radius);
  float alpha = min(1.0, (0.86 * pin + 0.19 * halo) * vLight);
  vec3 color = mix(vColor, vec3(1.0, 0.90, 0.95), 0.38 * pin * min(vLight, 1.0));
  fragment = vec4(color * alpha, alpha);
}
