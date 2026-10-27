varying vec3 vObjPos;
varying vec3 vObjNormal;
varying vec3 vViewPos;
varying mat3 vNormalMat;

void main() {
  vObjPos = normalize(position);
  vObjNormal = normalize(normal);
  vNormalMat = normalMatrix;
  vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
  vViewPos = mvPos.xyz;
  gl_Position = projectionMatrix * mvPos;
}
