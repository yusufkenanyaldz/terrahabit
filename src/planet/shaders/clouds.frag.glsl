uniform float uVitality;
uniform float uDrought;
uniform float uTime;
uniform vec3 uLightDirView;
varying vec3 vObjPos;
varying vec3 vNormal;
varying vec3 vViewPos;
#include "noise.glsl"
void main() {
  float cloudVis = smoothstep(0.04, 0.55, uVitality);
  if (cloudVis <= 0.001) discard;

  float d = getCloudDensity(vObjPos, uTime);
  float NdotL = dot(vNormal, uLightDirView);
  float dayLight = smoothstep(-0.18, 0.25, NdotL);

  // Gün batımında kızaran bulutlar
  float sunset = smoothstep(-0.15, 0.05, NdotL) * smoothstep(0.25, 0.0, NdotL);
  vec3 baseCloud = mix(vec3(0.96, 0.98, 1.0), vec3(0.65, 0.52, 0.40), uDrought);
  vec3 cloudCol = baseCloud * dayLight + vec3(0.95, 0.42, 0.18) * sunset * 0.6;

  gl_FragColor = vec4(cloudCol, d * cloudVis * 0.85 * smoothstep(-0.25, 0.05, NdotL));
}
