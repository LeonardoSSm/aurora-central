precision highp float;

in vec3 position;
uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
uniform float uTime;
uniform float uFlow;
uniform float uTurn;
uniform float uSuccessAge;
uniform float uAmplitude;
uniform float uStill;
uniform float uPixels;
uniform float uProfileLight;
uniform float uPrimaryCount;
uniform vec2 uPointer;
uniform vec4 uPose;       // scale, light, warmth, folds
uniform vec4 uSignals;    // listening, thinking, speaking, executing
uniform vec2 uOutcomes;   // success, error
uniform float uBreath;

out vec3 vColor;
out float vLight;

vec4 hash4(vec4 cell) {
  vec4 x = fract(cell * 0.1031);
  x *= x + 33.33;
  return fract(x * (x + x));
}

float noise3(vec3 p) {
  vec3 cell = floor(p);
  vec3 ease = fract(p);
  ease = ease * ease * (3.0 - 2.0 * ease);
  float base = dot(cell, vec3(1.0, 59.0, 113.0));
  vec4 corners = base + vec4(0.0, 1.0, 59.0, 60.0);
  vec4 z = mix(hash4(corners), hash4(corners + 113.0), ease.z);
  vec2 y = mix(z.xz, z.yw, ease.x);
  return mix(y.x, y.y, ease.y) * 2.0 - 1.0;
}

vec2 rotate(vec2 value, float angle) {
  float c = cos(angle);
  float s = sin(angle);
  return mat2(c, s, -s, c) * value;
}

void main() {
  float radius = length(position);
  vec3 direction = position / max(radius, 0.0001);
  float grain = hash4(vec4(dot(position, vec3(171.3, 305.7, 95.6)))).x;
  float flow = uFlow;
  float broad = noise3(direction * 1.48 + vec3(0.3, -0.25, 0.19) * flow);
  float fine = noise3(direction * 3.8 + vec3(-0.24, 0.16, 0.17) * flow + broad * 0.7);
  float phase = dot(direction, vec3(4.4, 5.4, -3.1)) + 3.8 * broad + 0.52 * flow;
  float fold = sin(phase);
  float crease = pow(0.5 + 0.5 * sin(phase + 1.1 + fine * 0.48), 4.0);

  float breathing = (sin(uTime * 1.12) + 0.24 * sin(uTime * 0.63 + 1.4)) * 0.026 * uBreath;
  float listening = uSignals.x * sin(direction.y * 7.5 - flow * 1.75);
  float thinking = uSignals.y * sin(direction.z * 10.5 + direction.x * 6.4 + flow * 2.3 + broad * 2.0);
  float syllable = 0.42 + 0.34 * sin(uTime * 5.7) + 0.17 * sin(uTime * 8.3 + 1.6);
  float speaking = uSignals.z * (0.52 * syllable + 1.12 * uAmplitude);
  float executionBand = exp(-9.0 * abs(direction.y + 0.29 * direction.x - 0.22 * sin(flow * 0.9)));
  float executing = uSignals.w * executionBand;
  float waveFront = mix(-1.12 + 1.46 * uSuccessAge, 0.24, uStill);
  float waveDistance = direction.y + 0.27 * direction.x - waveFront;
  float success = uOutcomes.x * exp(-waveDistance * waveDistance * 17.0);
  float error = uOutcomes.y * sin(phase * 1.68 - 0.9 * flow + 1.9 * fine);

  float displacement = uPose.w * (0.124 * broad + 0.098 * fold + 0.032 * fine);
  displacement += 0.035 * listening + 0.049 * thinking + 0.10 * speaking;
  displacement += 0.095 * executing + 0.095 * success + 0.062 * error;
  vec3 p = position * (uPose.x + displacement + breathing);
  p += radius * vec3(0.067 * fine + 0.032 * fold, 0.048 * broad, 0.038 * fold - 0.061 * fine);
  p += radius * cos(phase) * vec3(0.013, -0.035, 0.012);

  p.xz = rotate(p.xz, uTurn + uPointer.x * 0.16);
  p.yz = rotate(p.yz, -0.22 + 0.09 * sin(uTime * 0.28) - uPointer.y * 0.14);
  p.xy = rotate(p.xy, 0.11 + 0.075 * sin(uTime * 0.32 + 0.8));
  p.y *= 0.965;
  p.xy += uPointer * 0.029;
  vec4 view = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * view;

  float depth = smoothstep(-1.05, 0.98, p.z);
  float outer = smoothstep(0.40, 0.97, radius);
  float lightBand = crease * (0.58 + 0.42 * smoothstep(-0.6, 0.46, broad));
  vec3 warmCenter = p - vec3(0.24 + 0.12 * sin(flow * 0.43), 0.02 + 0.12 * sin(flow * 0.31), 0.87);
  float warmLight = exp(-6.5 * dot(warmCenter, warmCenter));
  float hue = 0.67 * p.x + 0.42 * p.y + 0.15 * broad + 0.16 * sin(phase * 0.55) + uPose.z;
  hue += 0.42 * warmLight;
  hue += 0.20 * executing + 0.24 * success + 0.10 * error - 0.085 * thinking;
  vec3 blue = vec3(0.26, 0.43, 1.0);
  vec3 violet = vec3(0.52, 0.16, 1.0);
  vec3 lilac = vec3(0.75, 0.39, 1.0);
  vec3 magenta = vec3(1.0, 0.10, 0.65);
  vec3 pink = vec3(1.0, 0.35, 0.70);
  vec3 coral = vec3(1.0, 0.36, 0.23);
  vec3 color = mix(blue, violet, smoothstep(-0.81, -0.35, hue));
  color = mix(color, lilac, smoothstep(-0.55, -0.19, hue));
  color = mix(color, magenta, smoothstep(-0.36, 0.13, hue));
  color = mix(color, pink, smoothstep(-0.02, 0.47, hue));
  color = mix(color, coral, smoothstep(0.20, 0.68, hue));
  color = mix(color, vec3(1.0, 0.35, 0.16), uOutcomes.y * (0.53 + 0.16 * error));
  color = mix(color, vec3(1.0, 0.83, 0.97), 0.27 * lightBand + 0.25 * success);

  vColor = color;
  float primary = 1.0 - step(uPrimaryCount, float(gl_VertexID));
  float behaviorLight = 0.08 * listening + 0.11 * thinking + 0.26 * speaking + 0.38 * executing + 0.52 * success;
  vLight = (0.24 + 0.58 * depth + 1.05 * lightBand + 0.73 * warmLight + behaviorLight) * uPose.y * uProfileLight;
  vLight *= mix(0.30, 1.0, outer) * (0.58 + 0.42 * grain) * mix(0.84, 1.18, primary);

  float apparentSize = 1.30 + 0.85 * depth + 1.03 * lightBand + 0.62 * grain * grain + 0.77 * warmLight;
  apparentSize *= mix(0.95, 1.15, primary);
  gl_PointSize = max(1.0, apparentSize * uPixels * 4.18 / -view.z);
}
