import noise from './noise.glsl?raw';
import planetVert from './planet.vert.glsl?raw';
import planetFrag from './planet.frag.glsl?raw';
import cloudsVert from './clouds.vert.glsl?raw';
import cloudsFrag from './clouds.frag.glsl?raw';
import haloVert from './halo.vert.glsl?raw';
import haloFrag from './halo.frag.glsl?raw';

// Ortak noise kodunu `#include "noise.glsl"` satırının yerine koyar.
const withNoise = (src) => src.replace('#include "noise.glsl"', noise);

export const planetShader = { vertexShader: planetVert, fragmentShader: withNoise(planetFrag) };
export const cloudsShader = { vertexShader: cloudsVert, fragmentShader: withNoise(cloudsFrag) };
export const haloShader = { vertexShader: haloVert, fragmentShader: haloFrag };
