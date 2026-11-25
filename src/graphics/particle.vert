attribute vec3 aPosition;
uniform float uTime;
uniform float uPixels;
uniform vec2 uAspect;
varying vec3 vColor;
varying float vLight;

void main() {
  float angle = 0.18 + uTime * 0.09;
  float turn = cos(angle);
  float swing = sin(angle);
  vec3 p = aPosition;
  p = vec3(turn * p.x + swing * p.z, p.y, -swing * p.x + turn * p.z);

  float ruffle = sin(5.7 * p.y + 2.8 * p.x - 2.7 * p.z + uTime * 0.75);
  float waves = sin(4.0 * p.x - 3.8 * p.y + 3.4 * p.z - uTime * 0.46);
  float ripple = sin(10.0 * p.y - 3.7 * p.x + 4.0 * p.z + uTime * 0.35);
  p *= 1.0 + 0.082 * ruffle + 0.058 * waves + 0.041 * ripple;
  p.x += 0.060 * sin(3.1 * p.y + 2.2 * p.z + uTime * 0.25);
  p.y += 0.055 * cos(4.0 * p.z - 1.8 * p.x - uTime * 0.46);

  float perspective = 3.65 / (3.65 - p.z);
  gl_Position = vec4(0.75 * perspective * p.xy * uAspect, 0.0, 1.0);

  float position = p.y * 0.58 + p.x * 0.42 + 0.13 * ruffle + 0.15 * p.z;
  vec3 blue = vec3(0.28, 0.42, 1.0);
  vec3 violet = vec3(0.57, 0.20, 1.0);
  vec3 magenta = vec3(1.0, 0.16, 0.68);
  vec3 coral = vec3(1.0, 0.46, 0.36);
  vec3 color = mix(blue, violet, smoothstep(-1.05, -0.33, position));
  color = mix(color, magenta, smoothstep(-0.43, 0.34, position));
  float flare = sin(4.7 * p.x - 3.5 * p.y + 2.2 * p.z) * 0.12;
  color = mix(color, coral, smoothstep(0.15, 0.76, position + flare));
  float fold = smoothstep(0.10, 0.96, ruffle * 0.49 + waves * 0.46 + ripple * 0.20);
  float depth = smoothstep(-1.0, 1.1, p.z);
  float grain = fract(sin(dot(aPosition, vec3(106.3, 61.7, 164.5))) * 4237.5);
  vColor = mix(color, vec3(1.0, 0.79, 0.95), 0.29 * fold);
  vLight = min(1.0, (0.32 + 0.58 * depth + 0.46 * fold) * (0.63 + 0.37 * grain));
  gl_PointSize = uPixels * perspective * (1.48 + 1.03 * depth + 1.3 * fold + 0.7 * grain);
}
