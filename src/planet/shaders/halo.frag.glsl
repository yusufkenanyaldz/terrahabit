uniform float uVitality;
uniform float uDrought;
varying vec3 vNormal;
varying vec3 vViewPos;
void main() {
  vec3 V = normalize(-vViewPos);
  float rim = pow(0.68 - dot(vNormal, V), 3.2);
  vec3 col = mix(vec3(0.75, 0.32, 0.14), vec3(0.15, 0.58, 1.0), smoothstep(0.05, 0.6, uVitality));
  col = mix(col, vec3(0.75, 0.45, 0.15), uDrought);
  gl_FragColor = vec4(col, rim * (0.28 + uVitality * 0.55));
}
