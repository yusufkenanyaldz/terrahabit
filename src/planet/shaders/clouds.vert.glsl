varying vec3 vObjPos;
varying vec3 vNormal;
varying vec3 vViewPos;
void main() {
  vObjPos = normalize(position);
  vNormal = normalize(normalMatrix * normal);
  vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
  vViewPos = mvPos.xyz;
  gl_Position = projectionMatrix * mvPos;
}
