uniform float uVitality;
uniform float uDrought;
uniform float uPulse;
uniform float uTime;
uniform vec3 uLightDirObj;
varying vec3 vObjPos;
varying vec3 vObjNormal;
varying vec3 vViewPos;
varying mat3 vNormalMat;
#include "noise.glsl"

void main() {
  vec3 p = normalize(vObjPos);
  float h = getTerrainHeight(p);

  // Su seviyesi hesabı
  float effectiveWater = clamp(uVitality * (1.0 - uDrought * 0.35), 0.0, 1.0);
  float waterLevel = mix(-0.42, 0.06, effectiveWater);
  bool isOcean = (h < waterLevel) && (effectiveWater > 0.015);

  // --- PER-PIXEL BUMP / NORMAL MAPPING (Keskin Dağ ve Krater Işıklandırması) ---
  vec3 up = abs(p.y) < 0.99 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0);
  vec3 tangent = normalize(cross(up, p));
  vec3 bitangent = cross(p, tangent);

  float eps = 0.0022;
  float hX = getTerrainHeight(normalize(p + tangent * eps));
  float hY = getTerrainHeight(normalize(p + bitangent * eps));

  // Okyanus yüzeyi pürüzsüzdür, karalar ise sarp kayalıktır
  float bumpScale = isOcean ? 0.4 : 22.0;
  vec3 bumpedObjNormal = normalize(p - (tangent * (hX - h) + bitangent * (hY - h)) * bumpScale);

  vec3 N = normalize(vNormalMat * bumpedObjNormal);
  vec3 smoothN = normalize(vNormalMat * p);
  vec3 L = normalize(vNormalMat * uLightDirObj);
  vec3 V = normalize(-vViewPos);

  float NdotL = max(dot(N, L), 0.0);
  float smoothNdotL = dot(smoothN, L);

  // --- BULUT GÖLGESİ (Bulutların Kıtalara ve Okyanusa Düşen Gölgesi) ---
  float cloudVis = smoothstep(0.04, 0.55, uVitality);
  float shadowSample = getCloudDensity(normalize(p + uLightDirObj * 0.028), uTime);
  float cloudShadow = 1.0 - (shadowSample * cloudVis * 0.65);

  // --- NASA / TERRAGENESIS GERÇEKÇİ BİYOM PALETİ ---
  float alt = max(0.0, h - waterLevel);
  float latitude = abs(p.y);

  // 1. Çorak Mars/Merkür Bazalt ve Oksitli Toprak
  vec3 basaltDark = vec3(0.14, 0.10, 0.09);
  vec3 ironOxide = vec3(0.48, 0.23, 0.14);
  vec3 dustyHigh = vec3(0.66, 0.42, 0.28);
  vec3 barrenCol = mix(basaltDark, ironOxide, smoothstep(-0.35, 0.15, h));
  barrenCol = mix(barrenCol, dustyHigh, smoothstep(0.15, 0.55, h));

  // 2. Canlı Dünya Biyomları (Enlem ve Rakıma Göre)
  vec3 beachSand = vec3(0.76, 0.68, 0.50);
  vec3 savanna = vec3(0.45, 0.48, 0.18);
  vec3 tropicalForest = vec3(0.05, 0.26, 0.09);
  vec3 borealForest = vec3(0.08, 0.20, 0.12);
  vec3 alpineRock = vec3(0.32, 0.30, 0.29);
  vec3 glacierSnow = vec3(0.94, 0.97, 1.0);

  // Kuraklıkta sararan bitki örtüsü
  vec3 vegColor = mix(tropicalForest, borealForest, smoothstep(0.2, 0.7, latitude));
  vegColor = mix(vegColor, savanna, smoothstep(0.0, 0.35, abs(p.y - 0.15)) * 0.45);
  vegColor = mix(vegColor, vec3(0.55, 0.38, 0.15), uDrought);

  float vegCoverage = smoothstep(0.12, 0.78, uVitality);
  vec3 landCol = mix(barrenCol, vegColor, vegCoverage);

  // Kıyı şeridi kumsalı ve yüksek dağ kayalıkları
  landCol = mix(beachSand, landCol, smoothstep(0.0, 0.025, alt));
  float slope = 1.0 - max(dot(bumpedObjNormal, p), 0.0);
  landCol = mix(landCol, alpineRock, smoothstep(0.16, 0.36, alt) + slope * 1.8);

  // Kutup Buzulları ve Dağ Zirvesi Karları
  float snowLine = (1.0 - latitude * 0.85) * 0.38;
  float snowMask = smoothstep(snowLine, snowLine + 0.08, alt) * smoothstep(0.08, 0.4, uVitality) * (1.0 - uDrought * 0.6);
  landCol = mix(landCol, glacierSnow, clamp(snowMask, 0.0, 1.0));

  vec3 surfaceAlbedo = landCol;
  float specular = 0.0;

  // 3. Okyanus Derinliği (Batimetri) ve Güneş Yansıması
  if (isOcean) {
    float depth = clamp((waterLevel - h) * 6.5, 0.0, 1.0);
    vec3 coastalShelf = vec3(0.04, 0.38, 0.48);
    vec3 abyssalOcean = vec3(0.01, 0.05, 0.14);
    surfaceAlbedo = mix(coastalShelf, abyssalOcean, smoothstep(0.0, 0.85, depth));

    // Güneşin su üzerindeki gerçekçi parlaması (Blinn-Phong Specular)
    vec3 H = normalize(L + V);
    float specAngle = max(dot(N, H), 0.0);
    specular = pow(specAngle, 64.0) * 0.85 * cloudShadow * smoothstep(0.0, 0.2, smoothNdotL);
  }

  // --- GÜNDÜZ / GECE TERMİNATÖR KIZILLIĞI (Rayleigh Scattering) ---
  float dayFactor = smoothstep(-0.08, 0.12, smoothNdotL);
  float twilightBand = smoothstep(-0.18, 0.02, smoothNdotL) * smoothstep(0.28, -0.02, smoothNdotL);
  vec3 sunsetScatter = vec3(0.95, 0.32, 0.08) * twilightBand * (0.25 + 0.55 * uVitality);

  // Atmosferik Kenar Halesi (Fresnel Limb)
  float fresnel = pow(1.0 - max(dot(V, smoothN), 0.0), 3.4);
  vec3 barrenAtmos = vec3(0.72, 0.36, 0.18);
  vec3 earthAtmos = vec3(0.18, 0.55, 0.98);
  vec3 atmosCol = mix(barrenAtmos, earthAtmos, smoothstep(0.05, 0.6, uVitality));
  atmosCol = mix(atmosCol, vec3(0.78, 0.45, 0.15), uDrought);

  // --- GECE TARAFI MEDENİYET ŞEHİR IŞIKLARI (Evre 5) ---
  float nightMask = smoothstep(0.08, -0.18, smoothNdotL);
  float cityCluster = smoothstep(0.54, 0.66, snoise(p * 14.0)) * smoothstep(0.3, 0.7, snoise(p * 42.0));
  float coastalPref = smoothstep(0.18, 0.01, alt); // Şehirler kıyılara ve ovalara kurulur
  vec3 cityLights = vec3(1.0, 0.76, 0.38) * cityCluster * (0.4 + 0.6 * coastalPref) * nightMask * (isOcean ? 0.0 : 1.0) * smoothstep(0.75, 0.95, uVitality) * (1.0 - uDrought);

  // Görev Tamamlama Biyo-Tarama Dalgası
  float scanWave = exp(-pow((p.y - sin(uTime * 3.0)) * 4.5, 2.0)) * uPulse;
  vec3 pulseCol = vec3(0.15, 0.85, 0.65) * scanWave * 0.4;

  // Nihai Kompozisyon
  vec3 diffuseLight = surfaceAlbedo * NdotL * cloudShadow * 1.15;
  vec3 ambientLight = surfaceAlbedo * 0.025; // Uzay karanlığı (AMOLED kontrastı)
  vec3 limbGlow = atmosCol * fresnel * smoothstep(-0.25, 0.35, smoothNdotL) * 0.75;

  vec3 finalRGB = diffuseLight + ambientLight + specular + sunsetScatter + limbGlow + cityLights + pulseCol;

  // Sinematik Tonlama (Filmic Contrast)
  finalRGB = pow(clamp(finalRGB, 0.0, 1.0), vec3(0.92));

  gl_FragColor = vec4(finalRGB, 1.0);
}
