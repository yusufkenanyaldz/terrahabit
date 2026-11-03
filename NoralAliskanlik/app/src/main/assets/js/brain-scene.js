// 3B beyin sahnesi — orijinal "Nöral Alışkanlık" HTML'inden modüle taşındı.
// Değişenler: model telefonun iç depolamasından yüklenir (main.js yönetir),
// ayarlar dışarıdan verilir (SharedPreferences), küreler gerçek alışkanlık verisinden gelir,
// bloom her zaman yarım çözünürlükte, pixelRatio en fazla 2.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { yolKonumu } from './guc.js';
import { simgeSvg } from './simgeler.js';

const MAX_PIXEL_RATIO = 2;
const BLOOM_SCALE = 0.5; // Bloom, ekran çözünürlüğünün yarısında hesaplanır

const renkTuruncu = new THREE.Color(0xff7b1c);
const renkMor = new THREE.Color(0xa855f7);
const renkMavi = new THREE.Color(0x00e5ff);

/** İlerleme oranına göre turuncu → mor → mavi renk. */
export function hesaplaAsamaRengi(oran, hedefRenk = new THREE.Color()) {
  const t = Math.max(0, Math.min(1, oran));
  if (t < 0.5) hedefRenk.lerpColors(renkTuruncu, renkMor, t * 2.0);
  else hedefRenk.lerpColors(renkMor, renkMavi, (t - 0.5) * 2.0);
  return hedefRenk;
}

/** Aşama bilgisi (0 Çaba, 1 Tekrar, 2 Yerleşiyor, 3 Otomatik) — guc.js hesaplar. */
const ASAMALAR = [
  { ad: '1. Aşama: Çaba (Prefrontal)', kisa: 'Çaba', hex: '#ff7b1c' },
  { ad: '2. Aşama: Tekrar', kisa: 'Tekrar', hex: '#a855f7' },
  { ad: '3. Aşama: Yerleşiyor', kisa: 'Yerleşiyor', hex: '#0ea5e9' },
  { ad: '4. Aşama: Otomatik (Bazal Gangliyon)', kisa: 'Otomatik', hex: '#00e5ff' },
];
export function asamaBilgisiGetir(asama) {
  return ASAMALAR[Math.max(0, Math.min(3, asama))];
}

/**
 * Sahneyi kurar.
 * @param {{container:HTMLElement, labelsContainer:HTMLElement, leaderSvg:SVGElement,
 *          ayarlar:object, onSelect:(id:string)=>void, onProgress?:(p:number)=>void}} opts
 */
export function createBrainScene({ container, labelsContainer, leaderSvg, ayarlar, onSelect, onProgress }) {
  let aktifAyarlar = ayarlar;
  // Ekranın panellerle kapanmayan kısmı (main.js günceller): etiketler bu aralıkta kalır,
  // 3B görüntü de bu aralığın ortasına kaydırılır.
  let ustSinir = 115;
  let altSinir = window.innerHeight - 195;
  let hedefKayma = 0;   // piksel; pozitif = görüntü yukarı
  let mevcutKayma = 0;
  let seciliId = null;  // Seçili alışkanlık varken yalnızca onun etiketi görünür
  // =======================================================================
  // SAHNE, KAMERA (AÇILIŞTA YANDAN GÖRÜNÜM), RENDERER VE POST-PROCESSING
  // =======================================================================
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x060913);

  const camera = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 0.1, 100);
  // Dikey ekranda yatay görüş dar: beyin sığsın diye kamerayı uzaklaştır.
  // Uygulamaya geri dönülürken WebView ilk anda yanlış (ör. 0 yükseklikli) boyut
  // bildirebiliyor; bu yüzden çarpan her boyut değişiminde yeniden hesaplanır.
  function mesafeCarpaniHesapla() {
    const w = window.innerWidth, h = window.innerHeight;
    if (!(w > 0 && h > 0)) return 2.6; // Boyut henüz belli değil: dikey ekran varsay
    const oran = w / h;
    // Dikey telefonda beyin ekran genişliğinin yaklaşık 3/4'ünü kaplasın
    return oran < 1 ? Math.min(2.8, 1.18 / oran) : 1;
  }
  let MESAFE_CARPANI = mesafeCarpaniHesapla();
  camera.position.set(0.0, 0.12, 3.85 * MESAFE_CARPANI);

  // antialias kapalı: sahne EffectComposer'ın ara dokusuna çizildiği için ekran
  // tamponundaki MSAA görüntüye katkı yapmıyor, yalnızca bellek trafiği ekliyordu.
  // WebGL bağlamını kendimiz oluşturuyoruz çünkü Three.js tuvali her zaman saydam (alpha)
  // açar. Opak tuvali telefon her karede sayfayla harmanlamak zorunda kalmaz
  // (arka plan zaten koyu); bu, görüntünün bir anlık kaybolmasını önlemeye yöneliktir.
  const tuval = document.createElement('canvas');
  const gl = tuval.getContext('webgl2', {
    alpha: false,
    antialias: false, // Composer'ın ara dokusuna çiziliyor; MSAA katkı yapmıyordu
    depth: true,
    stencil: false,
    premultipliedAlpha: true,
    preserveDrawingBuffer: false,
    powerPreference: 'high-performance',
  });
  const renderer = new THREE.WebGLRenderer({ canvas: tuval, context: gl });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.95;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.localClippingEnabled = false;
  container.appendChild(renderer.domElement);

  // Ortam ışığı dokusu: bir kez üretilir.
  const pmremGenerator = new THREE.PMREMGenerator(renderer);
  scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.45;
  pmremGenerator.dispose();

  const dirLight = new THREE.DirectionalLight(0xfff5ea, 1.35);
  dirLight.position.set(3.5, 4.5, 3.0);
  scene.add(dirLight);
  const rimLight = new THREE.DirectionalLight(0x60a5fa, 0.75);
  rimLight.position.set(-3.5, -1.5, -3.5);
  scene.add(rimLight);
  scene.add(new THREE.AmbientLight(0x1e293b, 0.6));

  // Kesit düzlemi (Sagital kesit)
  const clipPlane = new THREE.Plane(new THREE.Vector3(0, 0, -1), 0.02);

  // Post-processing: Bloom (strength 0.4, threshold 0.85) + vinyet
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloomPass = new UnrealBloomPass(
    new THREE.Vector2(Math.floor(window.innerWidth * BLOOM_SCALE), Math.floor(window.innerHeight * BLOOM_SCALE)),
    0.4, 0.35, 0.85);
  // composer.setSize her pass'e tam boyut verir; bloom'u hep düşük çözünürlükte tut.
  const bloomSetSize = bloomPass.setSize.bind(bloomPass);
  bloomPass.setSize = (w, h) =>
    bloomSetSize(Math.max(1, Math.floor(w * BLOOM_SCALE)), Math.max(1, Math.floor(h * BLOOM_SCALE)));
  composer.addPass(bloomPass);

  const VignetteShader = {
    uniforms: {
      tDiffuse: { value: null },
      offset: { value: 1.05 },
      darkness: { value: 1.15 },
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform sampler2D tDiffuse;
      uniform float offset;
      uniform float darkness;
      varying vec2 vUv;
      void main() {
        vec4 texel = texture2D(tDiffuse, vUv);
        vec2 uv = (vUv - vec2(0.5)) * vec2(offset);
        texel.rgb = mix(texel.rgb, texel.rgb * (1.0 - darkness), dot(uv, uv));
        gl_FragColor = texel;
      }
    `,
  };
  composer.addPass(new ShaderPass(VignetteShader));
  composer.addPass(new OutputPass());

  // OrbitControls
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0.0, 0.04, 0.0);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.minDistance = 1.65;
  controls.maxDistance = 6.5 * MESAFE_CARPANI;
  controls.autoRotate = false;
  controls.autoRotateSpeed = 0.32;

  let odakHedefi = null;
  let userInteracting = false;
  let autoRotateTimer = setTimeout(() => {
    if (!odakHedefi && !userInteracting) controls.autoRotate = true;
  }, 6000);
  controls.addEventListener('start', () => {
    userInteracting = true;
    controls.autoRotate = false;
    if (autoRotateTimer) clearTimeout(autoRotateTimer);
  });
  controls.addEventListener('end', () => {
    userInteracting = false;
    autoRotateTimer = setTimeout(() => {
      if (!odakHedefi) controls.autoRotate = true;
    }, 5000);
  });

  // Arka plan toz parçacıkları
  const tozParcaciklari = (() => {
    const adet = 90;
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(adet * 3);
    for (let i = 0; i < adet; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 10;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 8;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 8;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const points = new THREE.Points(geo, new THREE.PointsMaterial({
      color: 0x64748b, size: 0.025, transparent: true, opacity: 0.35, depthWrite: false,
    }));
    scene.add(points);
    return points;
  })();

  // =======================================================================
  // BEYİN MODELİ VE İÇİ BOŞ CAM (FRESNEL) ŞEFFAFLIK SİSTEMİ
  // =======================================================================
  const brainPivotGroup = new THREE.Group();
  scene.add(brainPivotGroup);

  let proceduralBrainGroup = null;
  let loadedGlbModel = null;
  let seffafModAcik = true; // Varsayılan: şeffaf mod açık

  function enjekteFresnelShader(mat) {
    if (mat.userData.fresnelKuruldu) return;
    mat.userData.fresnelKuruldu = true;
    mat.userData.uFresnelActive = { value: seffafModAcik ? 1.0 : 0.0 };
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uFresnelActive = mat.userData.uFresnelActive;
      shader.fragmentShader = `
        uniform float uFresnelActive;
      ` + shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <dithering_fragment>',
        `
        #include <dithering_fragment>
        if (uFresnelActive > 0.5) {
          vec3 viewDir = normalize(vViewPosition);
          // 'normal' her ışıklı malzemede var; vNormal ise normal'i olmayan
          // (düz gölgeli) modellerde tanımsız kalır ve shader derlenmez.
          // Güvenli normalize: sıfır uzunluklu normal (bozuk üçgen) NaN üretmesin.
          vec3 nrm = normal * inversesqrt(max(dot(normal, normal), 1e-8));
          // ÖNEMLİ: yuvarlama hatasıyla |dot| 1'i az farkla aşınca taban negatif olur ve
          // pow(negatif, 2.3) NaN verir. Tek bir NaN piksel bloom bulanıklığıyla bütün
          // ekrana yayılıp o kareyi bozuyordu (şeffaf modda görüntünün bir anlık kopması).
          float fresnelTaban = clamp(1.0 - abs(dot(nrm, viewDir)), 0.0, 1.0);
          float fresnel = pow(fresnelTaban, 2.3);
          vec3 rimColor = vec3(0.48, 0.84, 1.0);
          gl_FragColor.rgb = mix(gl_FragColor.rgb, rimColor, fresnel * 0.78);
          gl_FragColor.rgb += rimColor * fresnel * 0.42;
          gl_FragColor.a = clamp(gl_FragColor.a + fresnel * 0.68, 0.0, 0.92);
          // Güvenlik ağı: herhangi bir sebeple NaN oluşursa piksel bloom'a sızmasın.
          if (any(isnan(gl_FragColor))) gl_FragColor = vec4(0.0);
        }
        `
      );
    };
    mat.needsUpdate = true;
  }

  function gyriNoise(x, y, z) {
    const f1 = Math.sin(x * 9.5 + Math.cos(y * 8.2) + z * 7.0);
    const f2 = Math.cos(y * 11.0 - Math.sin(z * 9.5) + x * 6.5);
    const f3 = Math.sin(z * 12.5 + x * 8.0 - y * 7.5);
    return (f1 + f2 + f3) / 3.0;
  }

  // brain.glb yüklenene (ya da bulunamazsa) kadar görünen prosedürel beyin
  function olusturProsedurelBeyin() {
    const grup = new THREE.Group();
    const cortexMat = new THREE.MeshPhysicalMaterial({
      color: 0xd99b96, roughness: 0.68, metalness: 0.02, clearcoat: 0.18, clearcoatRoughness: 0.45,
      clippingPlanes: [clipPlane], clipShadows: true,
    });
    enjekteFresnelShader(cortexMat);

    // Sağ ve sol serebral yarımküreler
    [-1, 1].forEach((side) => {
      const geo = new THREE.SphereGeometry(0.95, 72, 56);
      const pos = geo.attributes.position;
      const v = new THREE.Vector3();
      for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i);
        v.x *= 1.18; v.y *= 0.86; v.z *= 0.46;
        if (side * v.z < 0 && Math.abs(v.z) < 0.22) v.z *= 0.28;
        const n = gyriNoise(v.x * 1.6, v.y * 1.6, (v.z + side * 0.4) * 1.6);
        const sulci = Math.pow(Math.abs(n), 0.65) * (n < 0 ? -0.055 : 0.042);
        v.addScaledVector(v.clone().normalize(), sulci);
        pos.setXYZ(i, v.x, v.y, v.z);
      }
      geo.computeVertexNormals();
      const matClone = cortexMat.clone();
      enjekteFresnelShader(matClone);
      const mesh = new THREE.Mesh(geo, matClone);
      mesh.position.set(0.05, 0.16, side * 0.43);
      grup.add(mesh);
    });

    // Beyincik
    const cerebGeo = new THREE.SphereGeometry(0.42, 48, 36);
    const cPos = cerebGeo.attributes.position;
    const cv = new THREE.Vector3();
    for (let i = 0; i < cPos.count; i++) {
      cv.fromBufferAttribute(cPos, i);
      cv.x *= 0.95; cv.y *= 0.72; cv.z *= 1.35;
      const folia = Math.sin(cv.y * 38.0 + Math.cos(cv.z * 8.0)) * 0.016;
      cv.addScaledVector(cv.clone().normalize(), folia);
      cPos.setXYZ(i, cv.x, cv.y, cv.z);
    }
    cerebGeo.computeVertexNormals();
    const cerebMat = cortexMat.clone();
    cerebMat.color.setHex(0xc4827d);
    enjekteFresnelShader(cerebMat);
    const cerebMesh = new THREE.Mesh(cerebGeo, cerebMat);
    cerebMesh.position.set(-0.62, -0.42, 0);
    grup.add(cerebMesh);

    // Beyin sapı
    const stemMat = cortexMat.clone();
    stemMat.color.setHex(0xd49a94);
    enjekteFresnelShader(stemMat);
    const stemMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.12, 0.68, 28), stemMat);
    stemMesh.position.set(-0.18, -0.58, 0);
    stemMesh.rotation.z = -0.24;
    grup.add(stemMesh);
    return grup;
  }

  // Örnek (prosedürel) beyin açılışta çizilmez: gerçek model gelmeden önce bir an
  // görünüp "göz kırpıyordu". Yalnızca model yoksa veya açılamazsa gösterilir.
  function showFallbackBrain() {
    if (loadedGlbModel || proceduralBrainGroup) return;
    proceduralBrainGroup = olusturProsedurelBeyin();
    brainPivotGroup.add(proceduralBrainGroup);
    guncelleBeyinMateryalleri();
  }

  // Şeffaf modda iç küreler net görünür (depthTest: false); opak modda derinlik testi açık.
  function guncelleIcDerinlikGorunumu() {
    const derinlikTesti = !seffafModAcik;
    [prefrontalMarker, basalMarker].forEach((m) => {
      m.traverse((c) => { if (c.isMesh && c.material) c.material.depthTest = derinlikTesti; });
    });
    if (neuralTubeMesh) neuralTubeMesh.material.depthTest = derinlikTesti;
    if (neuralCoreTubeMesh) neuralCoreTubeMesh.material.depthTest = derinlikTesti;
    akisPoints.material.depthTest = derinlikTesti;
    kureler.forEach((k) => {
      k.mesh.material.depthTest = derinlikTesti;
      k.halo.material.depthTest = derinlikTesti;
      k.iz.material.depthTest = derinlikTesti;
    });
  }

  function guncelleBeyinMateryalleri() {
    const hedefGrup = loadedGlbModel || proceduralBrainGroup;
    if (!hedefGrup) return;
    hedefGrup.traverse((child) => {
      if (child.isMesh && child.material) {
        child.renderOrder = 1;
        const mats = Array.isArray(child.material) ? child.material : [child.material];
        mats.forEach((mat) => {
          enjekteFresnelShader(mat);
          mat.clippingPlanes = [clipPlane];
          mat.clipShadows = true;
          if (seffafModAcik) {
            mat.transparent = true;
            mat.opacity = 0.20;
            mat.depthWrite = false;
            if (mat.userData.uFresnelActive) mat.userData.uFresnelActive.value = 1.0;
          } else {
            mat.transparent = false;
            mat.opacity = 1.0;
            mat.depthWrite = true;
            if (mat.userData.uFresnelActive) mat.userData.uFresnelActive.value = 0.0;
          }
          mat.needsUpdate = true;
        });
      }
    });
    guncelleIcDerinlikGorunumu();
  }

  /** Bir grubu sahneden çıkarıp GPU belleğini boşaltır. */
  function grubuAt(grup) {
    brainPivotGroup.remove(grup);
    grup.traverse((c) => {
      if (c.isMesh) {
        c.geometry?.dispose();
        const mats = Array.isArray(c.material) ? c.material : [c.material];
        mats.forEach((m) => {
          if (!m) return;
          for (const v of Object.values(m)) if (v && v.isTexture) v.dispose();
          m.dispose();
        });
      }
    });
  }

  function sahneyeGlbModeliYerlestir(gltfScene) {
    // Prosedürel beyni veya önceki modeli kaldır (yeni model eskisinin yerine geçer)
    if (proceduralBrainGroup) { grubuAt(proceduralBrainGroup); proceduralBrainGroup = null; }
    if (loadedGlbModel) { grubuAt(loadedGlbModel); loadedGlbModel = null; }
    // Ortala ve ölçekle
    const box = new THREE.Box3().setFromObject(gltfScene);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);
    const hedefOlcek = 2.45 / (Math.max(size.x, size.y, size.z) || 1);
    const wrapper = new THREE.Group();
    gltfScene.position.sub(center);
    wrapper.add(gltfScene);
    wrapper.scale.setScalar(hedefOlcek);

    wrapper.traverse((child) => {
      if (child.isMesh && child.material) {
        const mats = Array.isArray(child.material) ? child.material : [child.material];
        mats.forEach((mat) => {
          if (typeof mat.roughness === 'number') mat.roughness = Math.min(1.0, Math.max(mat.roughness + 0.25, 0.72));
          if (typeof mat.metalness === 'number') mat.metalness = Math.min(mat.metalness, 0.08);
          if (mat.emissiveIntensity !== undefined) mat.emissiveIntensity = Math.min(mat.emissiveIntensity, 0.1);
          enjekteFresnelShader(mat);
        });
      }
    });
    loadedGlbModel = wrapper;
    brainPivotGroup.add(loadedGlbModel);
    guncelleBeyinMateryalleri();
  }

  /**
   * Beyin modelini yükler (Draco çözücü assets/lib/draco'dan, internet gerekmez;
   * WebP dokular WebView tarafından doğrudan çözülür). Dönüş: başarılı mı.
   */
  function loadBrain(url) {
    return new Promise((resolve) => {
      const dracoLoader = new DRACOLoader();
      dracoLoader.setDecoderPath('lib/draco/');
      const gltfLoader = new GLTFLoader();
      gltfLoader.setDRACOLoader(dracoLoader);
      gltfLoader.load(url,
        (gltf) => { sahneyeGlbModeliYerlestir(gltf.scene); dracoLoader.dispose(); resolve(true); },
        (e) => { if (e.total && onProgress) onProgress(e.loaded / e.total); },
        (err) => { console.warn('brain.glb yüklenemedi:', err); dracoLoader.dispose(); resolve(false); });
    });
  }

  // =======================================================================
  // BÖLGE VURGULARI, PARLAK NÖRAL YOL VE KÜRELER
  // =======================================================================
  function olusturBolgeVurgusu(renkHex) {
    const grup = new THREE.Group();
    grup.renderOrder = 12;
    const coreMesh = new THREE.Mesh(new THREE.SphereGeometry(0.06, 24, 24), new THREE.MeshBasicMaterial({
      color: new THREE.Color(renkHex).multiplyScalar(1.8), transparent: true, opacity: 0.95, depthTest: !seffafModAcik,
    }));
    coreMesh.renderOrder = 12;
    grup.add(coreMesh);
    const shellMesh = new THREE.Mesh(new THREE.SphereGeometry(0.14, 24, 24), new THREE.MeshBasicMaterial({
      color: renkHex, transparent: true, opacity: 0.25, depthWrite: false, depthTest: !seffafModAcik,
    }));
    shellMesh.renderOrder = 11;
    grup.add(shellMesh);
    const ringMesh = new THREE.Mesh(new THREE.RingGeometry(0.155, 0.175, 36), new THREE.MeshBasicMaterial({
      color: new THREE.Color(renkHex).multiplyScalar(1.5), side: THREE.DoubleSide, transparent: true,
      opacity: 0.75, depthWrite: false, depthTest: !seffafModAcik,
    }));
    ringMesh.renderOrder = 12;
    grup.add(ringMesh);
    grup.userData.ring = ringMesh;
    return grup;
  }

  const prefrontalMarker = olusturBolgeVurgusu(0xff7b1c);
  const basalMarker = olusturBolgeVurgusu(0x00e5ff);
  scene.add(prefrontalMarker, basalMarker);

  let neuralCurve = null;
  let neuralTubeMesh = null;
  let neuralCoreTubeMesh = null;

  function olusturParcacikDokusu() {
    const c = document.createElement('canvas');
    c.width = 64; c.height = 64;
    const ctx = c.getContext('2d');
    const grad = ctx.createRadialGradient(32, 32, 2, 32, 32, 30);
    grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
    grad.addColorStop(0.35, 'rgba(230, 210, 255, 0.9)');
    grad.addColorStop(0.7, 'rgba(168, 85, 247, 0.35)');
    grad.addColorStop(1, 'rgba(168, 85, 247, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
  }

  // Yol boyunca akan parçacıklar
  const akisParcacikSayisi = 45;
  const akisGeo = new THREE.BufferGeometry();
  const akisOffsets = new Float32Array(akisParcacikSayisi);
  for (let i = 0; i < akisParcacikSayisi; i++) akisOffsets[i] = i / akisParcacikSayisi;
  akisGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(akisParcacikSayisi * 3), 3));
  const akisPoints = new THREE.Points(akisGeo, new THREE.PointsMaterial({
    color: new THREE.Color(0xffffff).multiplyScalar(2.2), map: olusturParcacikDokusu(), size: 0.11,
    transparent: true, opacity: 0.98, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: !seffafModAcik,
  }));
  akisPoints.renderOrder = 18;
  scene.add(akisPoints);

  // Prefrontal → Bazal Gangliyon nöral yolu (ayar değişince yeniden kurulur)
  function olusturNoralYol() {
    const a = aktifAyarlar;
    const p1 = new THREE.Vector3(a.prefrontal.x, a.prefrontal.y, a.prefrontal.z);
    const p2 = new THREE.Vector3(a.basalGanglia.x, a.basalGanglia.y, a.basalGanglia.z);
    prefrontalMarker.position.copy(p1);
    basalMarker.position.copy(p2);

    const mid1 = new THREE.Vector3().lerpVectors(p1, p2, 0.33);
    mid1.y += 0.16; mid1.z += 0.08;
    const mid2 = new THREE.Vector3().lerpVectors(p1, p2, 0.68);
    mid2.y += 0.08; mid2.z -= 0.05;
    neuralCurve = new THREE.CatmullRomCurve3([p1, mid1, mid2, p2]);

    // Eski tüpleri at
    for (const m of [neuralTubeMesh, neuralCoreTubeMesh]) {
      if (m) { scene.remove(m); m.geometry.dispose(); m.material.dispose(); }
    }

    const tubeGeo = new THREE.TubeGeometry(neuralCurve, 72, 0.032, 16, false);
    const count = tubeGeo.attributes.position.count;
    const colors = new Float32Array(count * 3);
    const uv = tubeGeo.attributes.uv;
    const c = new THREE.Color();
    for (let i = 0; i < count; i++) {
      hesaplaAsamaRengi(uv.getX(i), c);
      colors[i * 3] = c.r * 2.1;
      colors[i * 3 + 1] = c.g * 2.1;
      colors[i * 3 + 2] = c.b * 2.1;
    }
    tubeGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    neuralTubeMesh = new THREE.Mesh(tubeGeo, new THREE.MeshBasicMaterial({
      vertexColors: true, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending,
      depthWrite: false, depthTest: !seffafModAcik,
    }));
    neuralTubeMesh.renderOrder = 14;
    scene.add(neuralTubeMesh);

    const coreTubeGeo = new THREE.TubeGeometry(neuralCurve, 72, 0.013, 12, false);
    coreTubeGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    neuralCoreTubeMesh = new THREE.Mesh(coreTubeGeo, new THREE.MeshBasicMaterial({
      vertexColors: true, transparent: true, opacity: 0.95, depthWrite: false, depthTest: !seffafModAcik,
    }));
    neuralCoreTubeMesh.renderOrder = 15;
    scene.add(neuralCoreTubeMesh);
  }

  // SVG kılavuz çizgisi + uç noktası
  function olusturSvgBaglantiElemanlari(renk) {
    const ns = 'http://www.w3.org/2000/svg';
    const polyline = document.createElementNS(ns, 'polyline');
    polyline.setAttribute('class', 'leader-line');
    polyline.setAttribute('stroke', renk);
    polyline.setAttribute('points', '-999,-999 -999,-999');
    const dot = document.createElementNS(ns, 'circle');
    dot.setAttribute('class', 'leader-dot');
    dot.setAttribute('r', '2.8');
    dot.setAttribute('cx', '-999');
    dot.setAttribute('cy', '-999');
    dot.setAttribute('fill', renk);
    leaderSvg.appendChild(polyline);
    leaderSvg.appendChild(dot);
    return { polyline, dot };
  }

  // Bölge etiketleri
  const labelEffortEl = document.createElement('div');
  labelEffortEl.className = 'scene-label label-effort';
  labelEffortEl.textContent = 'ÇABA / Prefrontal Korteks';
  labelsContainer.appendChild(labelEffortEl);
  const svgEffortBag = olusturSvgBaglantiElemanlari('#ff7b1c');

  const labelAutoEl = document.createElement('div');
  labelAutoEl.className = 'scene-label label-auto';
  labelAutoEl.textContent = 'OTOMATİK / Bazal Gangliyon';
  labelsContainer.appendChild(labelAutoEl);
  const svgAutoBag = olusturSvgBaglantiElemanlari('#00e5ff');

  // Ortak geometriler: tüm alışkanlık küreleri aynı geometriyi paylaşır.
  const kureGeo = new THREE.SphereGeometry(0.104, 32, 32);
  const haloGeo = new THREE.SphereGeometry(0.168, 24, 24);
  const izGeo = new THREE.RingGeometry(0.12, 0.14, 40);

  /** Alışkanlık küreleri: id -> nesne. Sıra listeyle aynı tutulur. */
  const kureler = new Map();

  function kureOlustur(id) {
    const grup = new THREE.Group();
    grup.renderOrder = 25;
    const mesh = new THREE.Mesh(kureGeo, new THREE.MeshStandardMaterial({
      color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 2.8, roughness: 0.15,
      depthTest: !seffafModAcik, transparent: true,
    }));
    mesh.renderOrder = 26;
    mesh.userData.habitId = id;
    grup.add(mesh);
    const halo = new THREE.Mesh(haloGeo, new THREE.MeshBasicMaterial({
      color: 0xffffff, transparent: true, opacity: 0.36, blending: THREE.AdditiveBlending,
      depthWrite: false, depthTest: !seffafModAcik,
    }));
    halo.renderOrder = 25;
    halo.userData.habitId = id;
    grup.add(halo);
    scene.add(grup);

    // "İz" halkası: ulaşılan en yüksek gücün (P) yerinde soluk bir halka.
    // "Daha önce buraya ulaştın, geri dönüş daha hızlı" mesajı (Spesifikasyon §3.5).
    const iz = new THREE.Mesh(izGeo, new THREE.MeshBasicMaterial({
      color: 0xffffff, transparent: true, opacity: 0, side: THREE.DoubleSide,
      depthWrite: false, depthTest: !seffafModAcik,
    }));
    iz.renderOrder = 24;
    iz.visible = false;
    scene.add(iz);

    const labelEl = document.createElement('div');
    labelEl.className = 'scene-label label-habit';
    labelEl.innerHTML = '<span class="dot"></span><span class="lbl-text"></span>';
    labelEl.addEventListener('click', (e) => { e.stopPropagation(); onSelect(id); });
    labelsContainer.appendChild(labelEl);

    return {
      id, grup, mesh, halo, iz, labelEl,
      svgBag: olusturSvgBaglantiElemanlari('#ff7b1c'),
      asama: 0, mevcutOran: 0, hedefOran: 0, izOran: 0,
      parlaklik: 1, mevcutParlaklik: 1,
      kacirildiZamanlayici: 0, kutlamaZamanlayici: 0,
      etiketGenislik: 115,
    };
  }

  function kureSil(k) {
    scene.remove(k.grup);
    scene.remove(k.iz);
    k.mesh.material.dispose();
    k.halo.material.dispose();
    k.iz.material.dispose();
    k.labelEl.remove();
    k.svgBag.polyline.remove();
    k.svgBag.dot.remove();
  }

  /**
   * Küreleri alışkanlık listesine göre günceller.
   * @param {{id:string, name:string, H:number, P:number, asama:number, son7Oran:number}[]} list
   */
  function setHabits(list) {
    etiketleriGoster();
    const ids = new Set(list.map((h) => h.id));
    for (const [id, k] of kureler) if (!ids.has(id)) { kureSil(k); kureler.delete(id); }
    const sirali = new Map();
    for (const h of list) {
      let k = kureler.get(h.id);
      const yeni = !k;
      if (!k) k = kureOlustur(h.id);
      k.asama = h.asama;
      k.hedefOran = yolKonumu(h.H);   // Konum = alışkanlık gücü (parçalı eşleme)
      k.izOran = yolKonumu(h.P);      // İz = ulaşılan en yüksek güç
      k.parlaklik = h.son7Oran;       // Parlaklık = son 7 günün performansı
      if (yeni) { k.mevcutOran = k.hedefOran; k.mevcutParlaklik = k.parlaklik; }
      const asama = asamaBilgisiGetir(h.asama);
      const dotEl = k.labelEl.querySelector('.dot');
      dotEl.style.background = asama.hex;
      dotEl.style.color = asama.hex;
      // Nokta yerine alışkanlığın simgesi (aşama renginde). Yalnız değiştiğinde yeniden yazılır.
      const ikon = h.ikon || 'genel';
      if (k.ikon !== ikon) {
        k.ikon = ikon;
        dotEl.innerHTML = simgeSvg(ikon, 16); // Simge artık kimliği tek başına taşıyor
        dotEl.classList.add('simgeli');
      }
      // Etikette ad yazmaz: simge + yüzde. Adlar beynin yarısını kapatıyordu; alışkanlığı
      // simgesinden tanıyoruz (adı alttaki listede ve detay kartında yazılı).
      k.labelEl.querySelector('.lbl-text').textContent = `%${Math.round(h.H * 100)}`;
      k.labelEl.setAttribute('aria-label', `${h.name}, %${Math.round(h.H * 100)}`);
      k.labelEl.title = h.name;
      k.svgBag.polyline.setAttribute('stroke', asama.hex);
      k.svgBag.dot.setAttribute('fill', asama.hex);
      // Etiket genişliği yalnızca metin değişince ölçülür (her karede ölçmek yavaştır).
      k.etiketGenislik = 0;
      sirali.set(h.id, k);
    }
    kureler.clear();
    for (const [id, k] of sirali) kureler.set(id, k);
  }

  /** Seçili alışkanlığa kamerayı odakla (null: serbest). */
  // -----------------------------------------------------------------------
  // Etiketler beyni kapatmasın: dokunulmadığında 5 sn sonra yavaşça kaybolur;
  // ekrana dokununca, sahne değişince ya da bir alışkanlık seçiliyken görünür.
  // -----------------------------------------------------------------------
  const ETIKET_SURESI = 5000;
  let etiketZaman = null;
  function etiketleriGoster() {
    labelsContainer.classList.remove('soluk');
    clearTimeout(etiketZaman);
    etiketZaman = setTimeout(() => {
      if (!seciliId) labelsContainer.classList.add('soluk');
    }, ETIKET_SURESI);
  }
  etiketleriGoster();

  function select(id) {
    seciliId = id;
    etiketleriGoster();
    const k = id ? kureler.get(id) : null;
    // Kamera hep beynin merkezine bakar (küreye kaydırınca beyin kenara kayıyordu);
    // seçim yalnızca otomatik dönmeyi durdurur, küre yerinde kalsın.
    odakHedefi = k ? new THREE.Vector3(0, 0.04, 0) : null;
    if (k) controls.autoRotate = false;
  }

  /** Kaçırılan gün: küre bir kez sönükleşip titrer. */
  function flashMiss(id) {
    const k = kureler.get(id);
    if (k) k.kacirildiZamanlayici = 1.0;
  }

  /** 66. gün kutlaması: küre büyüyüp parlar. */
  function celebrate(id) {
    const k = kureler.get(id);
    if (k) k.kutlamaZamanlayici = 1.0;
  }

  /** Ayar panelinden gelen değerleri uygula: model döndürme + bölge konumları. */
  function applySettings(ayar) {
    aktifAyarlar = ayar;
    brainPivotGroup.rotation.set(
      THREE.MathUtils.degToRad(ayar.modelRot.x),
      THREE.MathUtils.degToRad(ayar.modelRot.y),
      THREE.MathUtils.degToRad(ayar.modelRot.z));
    olusturNoralYol();
  }

  /**
   * Panellerle kapanmayan dikey alan (piksel). Beyin bu alanın ortasında görünsün diye
   * kamera görüntüsü kaydırılır (setViewOffset: ek çizim maliyeti yok).
   */
  function setGorunurAlan(ust, alt) {
    ustSinir = ust + 14;
    altSinir = alt - 16;
    hedefKayma = window.innerHeight / 2 - (ust + alt) / 2;
    // Alan daralınca (ör. liste genişleyince) beyin sığsın diye kamera oransal olarak
    // uzaklaşır. Mutlak mesafe verilmez; kullanıcının kendi yakınlaştırması korunur.
    const oran = Math.max(0.1, (alt - ust) / window.innerHeight);
    const yeni = Math.min(1.6, Math.max(1, 0.62 / oran));
    if (Math.abs(yeni - uyumCarpani) > 0.004) {
      const simdi = camera.position.distanceTo(controls.target);
      hedefMesafe = Math.min(controls.maxDistance,
        Math.max(controls.minDistance, simdi * (yeni / uyumCarpani)));
      uyumCarpani = yeni;
    }
  }
  let uyumCarpani = 1;
  let hedefMesafe = null;

  function uygulaKayma() {
    const w = window.innerWidth, h = window.innerHeight;
    camera.setViewOffset(w, h, 0, mevcutKayma, w, h);
    camera.updateProjectionMatrix();
  }

  function setTransparent(acik) {
    seffafModAcik = acik;
    guncelleBeyinMateryalleri();
  }

  function toggleClip() {
    renderer.localClippingEnabled = !renderer.localClippingEnabled;
    return renderer.localClippingEnabled;
  }

  // Dokunarak küre seçimi
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  renderer.domElement.addEventListener('pointerdown', () => etiketleriGoster());
  renderer.domElement.addEventListener('pointerdown', (e) => {
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObjects([...kureler.values()].map((k) => k.halo), false)[0];
    if (hit && hit.object.userData.habitId) onSelect(hit.object.userData.habitId);
  });

  // =======================================================================
  // KÜRELERİN ÜZERİNE BİNMEYEN KILAVUZ ÇİZGİLİ ETİKET YERLEŞİMİ
  // =======================================================================
  const tempProjVec = new THREE.Vector3();

  // Takılma (mikro donma) olmasın diye bu fonksiyon her karede yeni nesne üretmez:
  // aynı nesneler yeniden kullanılır ve DOM'a yalnızca değişen değerler yazılır.
  // Etiketler left/top yerine transform ile taşınır (sayfa yerleşimi yeniden hesaplanmaz).
  const etiketHavuzu = [];
  const aktifEtiketler = [];
  const kureEkranNoktalari = [];
  const yukaridanAsagi = (a, b) => a.y - b.y;

  function havuzdan(i) {
    if (!etiketHavuzu[i]) etiketHavuzu[i] = { domEl: null, svgBag: null, anchorX: 0, anchorY: 0, x: 0, y: 0, side: 1, width: 0 };
    return etiketHavuzu[i];
  }
  function noktadan(i) {
    if (!kureEkranNoktalari[i]) kureEkranNoktalari[i] = { x: 0, y: 0 };
    return kureEkranNoktalari[i];
  }

  function gizle(domEl, svgBag) {
    if (domEl._gizli) return;
    domEl._gizli = true;
    domEl._x = NaN;
    domEl.style.opacity = '0';
    domEl.style.transform = 'translate3d(-9999px, 0, 0)'; // Görünmez etiket dokunuş almasın
    svgBag.polyline.style.opacity = '0';
    svgBag.dot.style.opacity = '0';
    svgBag._ax = NaN;
    svgBag._op = '';
  }

  function guncelleEtiketKonumlari() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const kameraMesafesi = camera.position.distanceTo(controls.target);
    const icYapilarGorunur = seffafModAcik || renderer.localClippingEnabled;
    // Bir alışkanlık seçiliyken bölge etiketleri ve diğer alışkanlıkların etiketleri gizlenir.
    // Üçten çok alışkanlıkta bölge etiketleri gizlenir: dar alanda alışkanlık
    // etiketleriyle çakışıyorlardı.
    const bolgeEtiketleriGorunur = !seciliId && kureler.size <= 3
      && kameraMesafesi < 4.25 * MESAFE_CARPANI && icYapilarGorunur;
    aktifEtiketler.length = 0;
    let noktaSayisi = 0;

    for (const k of kureler.values()) {
      tempProjVec.copy(k.grup.position).project(camera);
      if (tempProjVec.z <= 1) {
        const n = noktadan(noktaSayisi++);
        n.x = (tempProjVec.x * 0.5 + 0.5) * w;
        n.y = (-(tempProjVec.y * 0.5) + 0.5) * h;
      }
    }

    function projekteYanEtiket(worldPos, domEl, svgBag, gorunurMu, tercihYonu, dikeyKayma, genislik) {
      if (!gorunurMu) return gizle(domEl, svgBag);
      tempProjVec.copy(worldPos).project(camera);
      if (tempProjVec.z > 1) return gizle(domEl, svgBag);
      const anchorX = (tempProjVec.x * 0.5 + 0.5) * w;
      const anchorY = (-(tempProjVec.y * 0.5) + 0.5) * h;
      // Etiket tercih edilen tarafa sığmıyorsa (dar dikey ekran) diğer tarafa geç.
      let side = tercihYonu;
      if (side > 0 && anchorX + 68 + genislik > w - 6) side = -1;
      else if (side < 0 && anchorX - 68 - genislik < 6) side = 1;
      const e = havuzdan(aktifEtiketler.length);
      e.domEl = domEl; e.svgBag = svgBag;
      e.anchorX = anchorX; e.anchorY = anchorY;
      e.x = anchorX + side * 68; e.y = anchorY + dikeyKayma;
      e.side = side; e.width = genislik;
      aktifEtiketler.push(e);
    }

    projekteYanEtiket(prefrontalMarker.position, labelEffortEl, svgEffortBag, bolgeEtiketleriGorunur, 1, -34, 170);
    projekteYanEtiket(basalMarker.position, labelAutoEl, svgAutoBag, bolgeEtiketleriGorunur, -1, -34, 175);

    let idx = 0;
    for (const k of kureler.values()) {
      if (!k.etiketGenislik) k.etiketGenislik = k.labelEl.offsetWidth || 115;
      const side = k.mevcutOran < 0.5 ? 1 : -1;
      const gorunur = !seciliId || seciliId === k.id;
      projekteYanEtiket(k.grup.position, k.labelEl, k.svgBag, gorunur, side, seciliId ? -30 : (idx - 1) * 26, k.etiketGenislik);
      idx++;
    }

    // Etiket-etiket ve etiket-küre çakışmalarını dikey olarak ayır
    aktifEtiketler.sort(yukaridanAsagi);
    const minDikeyMesafe = 36;
    for (let iter = 0; iter < 4; iter++) {
      for (const lbl of aktifEtiketler) {
        const sol = lbl.side > 0 ? lbl.x : lbl.x - lbl.width;
        const sag = lbl.side > 0 ? lbl.x + lbl.width : lbl.x;
        for (let n = 0; n < noktaSayisi; n++) {
          const sp = kureEkranNoktalari[n];
          if (sp.x > sol - 24 && sp.x < sag + 24 && Math.abs(lbl.y - sp.y) < 28) {
            lbl.y += (lbl.y >= sp.y ? 1 : -1) * (28 - Math.abs(lbl.y - sp.y) + 6);
          }
        }
      }
      for (let i = 0; i < aktifEtiketler.length; i++) {
        for (let j = i + 1; j < aktifEtiketler.length; j++) {
          const ust = aktifEtiketler[i];
          const alt = aktifEtiketler[j];
          const ustSol = ust.side > 0 ? ust.x : ust.x - ust.width;
          const ustSag = ust.side > 0 ? ust.x + ust.width : ust.x;
          const altSol = alt.side > 0 ? alt.x : alt.x - alt.width;
          const altSag = alt.side > 0 ? alt.x + alt.width : alt.x;
          const yatayCakisiyor = !(ustSag + 10 < altSol || altSag + 10 < ustSol);
          if (yatayCakisiyor) {
            const fark = alt.y - ust.y;
            if (fark < minDikeyMesafe) {
              const itme = (minDikeyMesafe - fark) * 0.55;
              ust.y -= itme;
              alt.y += itme;
            }
          }
        }
      }
    }

    // Üst bar ve alt panel ile çakışmasın; DOM'a yalnızca değişen değerleri yaz
    const etiketOpak = icYapilarGorunur ? '1' : '0.45';
    const cizgiOpak = icYapilarGorunur ? '0.82' : '0.3';
    const noktaOpak = icYapilarGorunur ? '0.95' : '0.35';
    for (const item of aktifEtiketler) {
      item.y = Math.max(ustSinir, Math.min(altSinir, item.y));
      // Hiçbir tarafa sığmayan etiketi ekran içine it.
      if (item.side > 0) item.x = Math.max(6, Math.min(item.x, w - 6 - item.width));
      else item.x = Math.min(w - 6, Math.max(item.x, 6 + item.width));

      // 0.1 piksel hassasiyet: tam piksele yuvarlamak etiketleri 3B görüntüye göre
      // 1 px'lik sıçramalarla oynatıyordu (titreşim). Değişmeyen değer yine yazılmaz.
      const x = Math.round(item.x * 10) / 10, y = Math.round(item.y * 10) / 10;
      const ax = Math.round(item.anchorX * 10) / 10, ay = Math.round(item.anchorY * 10) / 10;
      const el = item.domEl;
      if (el._gizli) {
        el._gizli = false;
        el._op = '';
      }
      if (el._x !== x || el._y !== y || el._side !== item.side) {
        el._x = x; el._y = y; el._side = item.side;
        el.style.transform = `translate3d(${x}px, ${y}px, 0) translate(${item.side < 0 ? '-100%' : '0'}, -50%)`;
      }
      if (el._op !== etiketOpak) { el._op = etiketOpak; el.style.opacity = etiketOpak; }

      const bag = item.svgBag;
      const elbowX = ax + item.side * 26;
      const endX = x - item.side * 5;
      if (bag._ax !== ax || bag._ay !== ay || bag._y !== y || bag._ex !== endX) {
        bag._ax = ax; bag._ay = ay; bag._y = y; bag._ex = endX;
        bag.polyline.setAttribute('points', `${ax},${ay} ${elbowX},${y} ${endX},${y}`);
        bag.dot.setAttribute('cx', ax);
        bag.dot.setAttribute('cy', ay);
      }
      if (bag._op !== cizgiOpak) {
        bag._op = cizgiOpak;
        bag.polyline.style.opacity = cizgiOpak;
        bag.dot.style.opacity = noktaOpak;
      }
    }
  }

  // =======================================================================
  // ANİMASYON DÖNGÜSÜ
  // =======================================================================
  // Zaman, ekran yenilemesinin (vsync) zaman damgasından ölçülür. performance.now()
  // kodun çalıştığı anı verir ve birkaç ms oynar; adımlar kareden kareye eşit olmaz,
  // dönüş ve kayma titrer. vsync damgası her karede düzenli artar.
  let gecenSure = 0; // saniye

  // Kare hızından bağımsız üstel yumuşatma katsayısı: 1 - e^(-hız·dt)
  const yumusat = (hiz, dt) => 1 - Math.exp(-hiz * dt);
  const geciciRenk = new THREE.Color();
  const geciciNokta = new THREE.Vector3();
  const geciciTanjant = new THREE.Vector3();
  const geciciYan = new THREE.Vector3();
  const geciciUst = new THREE.Vector3();
  const YUKARI = new THREE.Vector3(0, 1, 0);
  const DEMET_ARALIGI = 0.24; // kürelerin yoldan uzaklık adımı (küre çapı 0,21: altında üst üste binerler)

  /**
   * Yol üzerindeki t (0..1) noktası; idx > 0 ise küre yolun etrafında kendi açısında
   * biraz yana kayık durur (aynı güçteki alışkanlıklar üst üste binmesin).
   */
  function demetKonumu(tHam, idx, hedef) {
    const t = Math.max(0, Math.min(1, tHam));
    neuralCurve.getPointAt(t, hedef);
    if (idx === 0) return hedef;
    neuralCurve.getTangentAt(t, geciciTanjant);
    geciciYan.crossVectors(geciciTanjant, YUKARI);
    if (geciciYan.lengthSq() < 1e-6) geciciYan.set(1, 0, 0); // yol dikse
    geciciYan.normalize();
    geciciUst.crossVectors(geciciYan, geciciTanjant).normalize();
    const aci = idx * 2.39996; // altın açı
    const r = DEMET_ARALIGI * Math.sqrt(idx);
    return hedef.addScaledVector(geciciYan, Math.cos(aci) * r).addScaledVector(geciciUst, Math.sin(aci) * r);
  }
  const merkez = new THREE.Vector3(0, 0.04, 0);

  // Uyarlanabilir çözünürlük: telefon zorlanırsa (2 sn boyunca < 45 fps) çizim
  // çözünürlüğünü kademeli düşür. Yalnızca aşağı iner; ileri geri zıplayıp takılma yapmaz.
  let cizimOrani = renderer.getPixelRatio();
  const MIN_CIZIM_ORANI = 1.25;
  let olcumKare = 0;
  let olcumSure = 0;
  let isinmaSuresi = 4; // İlk saniyeler (model/shader hazırlığı) ölçülmez

  function performansKontrol(hamDt) {
    if (isinmaSuresi > 0) { isinmaSuresi -= hamDt; return; }
    olcumKare++;
    olcumSure += hamDt;
    if (olcumSure < 2) return;
    const fps = olcumKare / olcumSure;
    olcumKare = 0;
    olcumSure = 0;
    if (fps < 45 && cizimOrani > MIN_CIZIM_ORANI) {
      cizimOrani = Math.max(MIN_CIZIM_ORANI, cizimOrani - 0.25);
      renderer.setPixelRatio(cizimOrani);
      composer.setPixelRatio(cizimOrani);
      isinmaSuresi = 1; // Değişiklik sonrası bir saniye bekle, sonra yeniden ölç
    }
  }

  // Kare hızı 60'ta sabit: 120 Hz ekranda bazı karelerin 8 ms'ye yetişip bazılarının
  // yetişememesi düzensiz akışa ("yalpalama") yol açar; düzenli 60 daha akıcı görünür.
  const HEDEF_KARE_MS = 1000 / 60;
  let sonKare = 0;

  // Ölçüm göstergesi için (başlığa 3 kez dokununca görünür)
  const olcum = { fps: 0, enUzun: 0, takilma: 0, kareler: 0, sure: 0, gecici: 0 };
  let saniyeKare = 0, saniyeSure = 0, saniyeEnUzun = 0, saniyeTakilma = 0;

  // Arka plandan dönünce ilk kare uzun bir aralık saymasın
  document.addEventListener('visibilitychange', () => { if (!document.hidden) sonKare = 0; });

  function animate(zaman) {
    if (document.hidden) return; // Arka planda çizme (pil/ısınma)
    // 2 ms pay: 60 Hz ekranda hiçbir kare atlanmasın
    if (zaman - sonKare < HEDEF_KARE_MS - 2) return;
    const aralik = sonKare ? zaman - sonKare : HEDEF_KARE_MS;
    sonKare = zaman;
    saniyeKare++;
    saniyeSure += aralik;
    if (aralik > saniyeEnUzun) saniyeEnUzun = aralik;
    if (aralik > 25) saniyeTakilma++; // 60 fps'de bir kareden fazla kaçırıldı
    if (saniyeSure >= 1000) {
      olcum.fps = Math.round((saniyeKare * 1000) / saniyeSure);
      olcum.enUzun = Math.round(saniyeEnUzun);
      olcum.takilma = saniyeTakilma;
      saniyeKare = 0; saniyeSure = 0; saniyeEnUzun = 0; saniyeTakilma = 0;
    }
    const hamDt = aralik / 1000;
    performansKontrol(hamDt);
    const dt = Math.min(hamDt, 0.1); // Uzun duraklamadan sonra sıçrama olmasın
    gecenSure += dt;
    const elapsed = gecenSure;

    prefrontalMarker.userData.ring.lookAt(camera.position);
    basalMarker.userData.ring.lookAt(camera.position);

    const posAttr = akisGeo.attributes.position;
    for (let i = 0; i < akisParcacikSayisi; i++) {
      neuralCurve.getPointAt((akisOffsets[i] + elapsed * 0.22) % 1.0, geciciNokta);
      posAttr.setXYZ(i, geciciNokta.x, geciciNokta.y, geciciNokta.z);
    }
    posAttr.needsUpdate = true;

    let idx = 0;
    kureler.forEach((k) => {
      // Geri hareket ileri hareketten daha yavaş ve sakin (Spesifikasyon §3.5)
      const geri = k.hedefOran < k.mevcutOran;
      k.mevcutOran += (k.hedefOran - k.mevcutOran) * yumusat(geri ? 1.5 : 5.0, dt);
      k.mevcutParlaklik += (k.parlaklik - k.mevcutParlaklik) * yumusat(2.0, dt);
      let egriOrani = k.mevcutOran;
      // Önce ışık, sonra konum: birkaç gün kaçırılınca küre yerinden oynamadan sönükleşir
      let emissiveYogunluk = 2.8 * (0.3 + 0.7 * k.mevcutParlaklik);

      // Kaçırılan gün: sönükleş ve titre
      if (k.kacirildiZamanlayici > 0) {
        k.kacirildiZamanlayici = Math.max(0, k.kacirildiZamanlayici - dt * 1.4);
        const titreme = Math.sin(elapsed * 42.0) * 0.018 * k.kacirildiZamanlayici;
        egriOrani = Math.max(0, egriOrani - 0.025 * k.kacirildiZamanlayici + titreme);
        emissiveYogunluk = 0.45;
      }

      demetKonumu(egriOrani, idx, k.grup.position);

      // İz halkası: güç, ulaşılan en yüksek seviyenin belirgin altındaysa görünür
      const izGorunur = k.izOran - k.mevcutOran > 0.02;
      k.iz.visible = izGorunur;
      if (izGorunur) {
        demetKonumu(k.izOran, idx, k.iz.position);
        k.iz.lookAt(camera.position);
        hesaplaAsamaRengi(k.izOran, geciciRenk);
        k.iz.material.color.copy(geciciRenk);
        k.iz.material.opacity = 0.35 + Math.sin(elapsed * 1.5 + idx) * 0.08;
      }

      hesaplaAsamaRengi(k.mevcutOran, geciciRenk);
      k.halo.material.color.copy(geciciRenk).multiplyScalar(1.8 * (0.4 + 0.6 * k.mevcutParlaklik));
      k.mesh.material.color.copy(geciciRenk);
      k.mesh.material.emissive.copy(geciciRenk);
      k.mesh.material.emissiveIntensity = emissiveYogunluk;

      let olcek;
      if (k.asama === 3) olcek = 1.0 + Math.sin(elapsed * 2.6 + idx) * 0.16;
      else if (k.asama === 0) olcek = 1.0 + Math.sin(elapsed * 8.0 + idx) * 0.06;
      else olcek = 1.0;

      // Otomatik'e ulaşma kutlaması: büyük parlama dalgası (~2.5 sn)
      if (k.kutlamaZamanlayici > 0) {
        k.kutlamaZamanlayici = Math.max(0, k.kutlamaZamanlayici - dt * 0.4);
        const dalga = Math.sin(k.kutlamaZamanlayici * Math.PI);
        olcek *= 1 + dalga * 1.2;
        k.mesh.material.emissiveIntensity = emissiveYogunluk + dalga * 4;
      }
      k.grup.scale.setScalar(olcek);
      idx++;
    });

    // Panel açılıp kapanınca görüntü yumuşakça kaysın
    if (Math.abs(hedefKayma - mevcutKayma) > 0.5) {
      mevcutKayma += (hedefKayma - mevcutKayma) * yumusat(6, dt);
      uygulaKayma();
    }

    if (!userInteracting) {
      controls.target.lerp(odakHedefi || merkez, yumusat(odakHedefi ? 4.5 : 2.5, dt));
    }
    // Görünür alan değiştiyse mesafeyi yumuşakça yeni hedefe taşı
    if (hedefMesafe !== null) {
      const simdi = camera.position.distanceTo(controls.target);
      if (Math.abs(hedefMesafe - simdi) < 0.01 || userInteracting) {
        hedefMesafe = null;
      } else {
        const yeniMesafe = simdi + (hedefMesafe - simdi) * yumusat(3.2, dt);
        camera.position.sub(controls.target).multiplyScalar(yeniMesafe / simdi).add(controls.target);
      }
    }
    tozParcaciklari.rotation.y = elapsed * 0.015;

    controls.update(dt); // Otomatik dönüş gerçek süreyle ilerlesin
    guncelleEtiketKonumlari();
    composer.render();
  }

  applySettings(aktifAyarlar);
  guncelleBeyinMateryalleri();
  renderer.setAnimationLoop(animate);

  window.addEventListener('resize', () => {
    if (!(window.innerWidth > 0 && window.innerHeight > 0)) return;
    // Ekran oranı değiştiyse kamerayı aynı oranda yaklaştır/uzaklaştır: beyin ekrana sığsın.
    const yeniCarpan = mesafeCarpaniHesapla();
    if (Math.abs(yeniCarpan - MESAFE_CARPANI) > 1e-3) {
      camera.position.sub(controls.target).multiplyScalar(yeniCarpan / MESAFE_CARPANI).add(controls.target);
      MESAFE_CARPANI = yeniCarpan;
      controls.maxDistance = 6.5 * MESAFE_CARPANI;
    }
    camera.aspect = window.innerWidth / window.innerHeight;
    uygulaKayma();
    renderer.setSize(window.innerWidth, window.innerHeight);
    composer.setSize(window.innerWidth, window.innerHeight);
  });

  /** Ölçüm göstergesi: son saniyenin fps'i, en uzun kare (ms), takılma sayısı, çizim oranı. */
  function getStats() {
    return { fps: olcum.fps, enUzun: olcum.enUzun, takilma: olcum.takilma, oran: cizimOrani };
  }

  return { etiketleriGoster, getStats, loadBrain, showFallbackBrain, setHabits, select, flashMiss, celebrate, setTransparent, toggleClip, applySettings, setGorunurAlan };
}
