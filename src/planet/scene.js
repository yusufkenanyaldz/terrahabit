import * as THREE from 'three';
import { createControls } from './controls.js';
import { planetShader, cloudsShader, haloShader } from './shaders/index.js';

// r128 renk davranışı: renk yönetimi yok, çıktı doğrusal (dönüşümsüz).
// r152+ varsayılanları (sRGB çıktı + ColorManagement) yıldız rengini farklı
// yorumlayacağı için ikisi de r128'deki gibi kapatılır. Renk nesneleri
// oluşturulmadan önce ayarlanmalı.
THREE.ColorManagement.enabled = false;

export function createPlanetScene(container) {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, window.innerWidth / window.innerHeight, 0.1, 1000);

  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2.5));
  container.appendChild(renderer.domElement);

  const planetGroup = new THREE.Group();
  scene.add(planetGroup);

  // 1. Ana Gezegen Küresi
  // Bu vektör bulut materyaliyle paylaşılır; her karede nesne uzayı ışık yönü
  // olarak güncellenir (tek dosyalık sürümle aynı davranış).
  const lightDirVec = new THREE.Vector3(1.3, 0.45, 0.9).normalize();

  const planetMat = new THREE.ShaderMaterial({
    ...planetShader,
    uniforms: {
      uVitality: { value: 0.0 },
      uDrought: { value: 0.0 },
      uPulse: { value: 0.0 },
      uTime: { value: 0.0 },
      uLightDirObj: { value: lightDirVec }
    }
  });
  const planetMesh = new THREE.Mesh(new THREE.SphereGeometry(1.55, 128, 128), planetMat);
  planetGroup.add(planetMesh);

  // 2. Bağımsız Siklonik Bulut Küresi
  const cloudMat = new THREE.ShaderMaterial({
    ...cloudsShader,
    uniforms: {
      uVitality: { value: 0.0 },
      uDrought: { value: 0.0 },
      uTime: { value: 0.0 },
      uLightDirView: { value: lightDirVec }
    },
    transparent: true,
    depthWrite: false
  });
  planetGroup.add(new THREE.Mesh(new THREE.SphereGeometry(1.572, 96, 96), cloudMat));

  // 3. Dış Atmosferik Aura (Rayleigh Halo)
  const haloMat = new THREE.ShaderMaterial({
    ...haloShader,
    uniforms: { uVitality: { value: 0.0 }, uDrought: { value: 0.0 } },
    blending: THREE.AdditiveBlending,
    side: THREE.BackSide,
    transparent: true,
    depthWrite: false
  });
  scene.add(new THREE.Mesh(new THREE.SphereGeometry(1.72, 64, 64), haloMat));

  // 4. Derin Uzay Yıldız Tarlası
  const starGeo = new THREE.BufferGeometry();
  const starCount = 1400;
  const starPos = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount * 3; i++) {
    starPos[i] = (Math.random() - 0.5) * 55;
  }
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xe2e8f0, size: 0.032, transparent: true, opacity: 0.55 })));

  const controls = createControls(container, planetGroup);
  camera.position.set(0, 0, controls.targetZoom);

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  let targetVitality = 0.0;
  let currentVitality = 0.0;
  let targetDrought = 0.0;
  let currentDrought = 0.0;
  let pulseIntensity = 0.0;

  // Animasyon ve fizik döngüsü
  const timer = new THREE.Timer();
  const worldLightDir = new THREE.Vector3(1.3, 0.45, 0.9).normalize();
  const invMat = new THREE.Matrix4();
  const localLight = new THREE.Vector3();

  function animate(timestamp) {
    timer.update(timestamp);
    const elapsed = timer.getElapsed();

    currentVitality += (targetVitality - currentVitality) * 0.04;
    currentDrought += (targetDrought - currentDrought) * 0.04;
    pulseIntensity *= 0.93;
    camera.position.z += (controls.targetZoom - camera.position.z) * 0.08;

    if (!controls.isDragging) {
      controls.velX += (0.0014 - controls.velX) * 0.03;
      controls.velY *= 0.92;
      planetGroup.rotation.y += controls.velX;
      planetGroup.rotation.x = Math.max(-1.2, Math.min(1.2, planetGroup.rotation.x + controls.velY));
    }

    // Güneşin yönünü gezegenin dönüşünden bağımsız sabit tut (Gerçekçi Yörünge Işığı)
    planetMesh.updateMatrixWorld();
    invMat.copy(planetMesh.matrixWorld).invert();
    localLight.copy(worldLightDir).transformDirection(invMat).normalize();

    planetMat.uniforms.uLightDirObj.value.copy(localLight);
    planetMat.uniforms.uVitality.value = currentVitality;
    planetMat.uniforms.uDrought.value = currentDrought;
    planetMat.uniforms.uPulse.value = pulseIntensity;
    planetMat.uniforms.uTime.value = elapsed;

    cloudMat.uniforms.uVitality.value = currentVitality;
    cloudMat.uniforms.uDrought.value = currentDrought;
    cloudMat.uniforms.uTime.value = elapsed;

    haloMat.uniforms.uVitality.value = currentVitality;
    haloMat.uniforms.uDrought.value = currentDrought;

    renderer.render(scene, camera);
  }

  return {
    start() { renderer.setAnimationLoop(animate); },
    setTargets(vitality, drought) {
      targetVitality = vitality;
      targetDrought = drought;
    },
    pulse(intensity) { pulseIntensity = intensity; }
  };
}
