// ============================================
// globe.js — Earth Globe with Day/Night Shader
// ============================================
import * as THREE from 'three';

export const GLOBE_RADIUS = 1.0;

// --- Texture URLs (Ultra High-Res 8K NASA Textures) ---
const TEXTURE_URLS = {
    day: 'https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg',
    night: 'https://unpkg.com/three-globe/example/img/earth-night.jpg',
    bump: 'https://unpkg.com/three-globe/example/img/earth-topology.png',
    specular: 'https://unpkg.com/three-globe/example/img/earth-water.png',
    clouds: 'https://unpkg.com/three-globe/example/img/earth-clouds.png',
};

// --- GLSL Shaders ---

const earthVertexShader = /* glsl */ `
varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vWorldPosition;

void main() {
    vUv = uv;
    vNormal = normalize(normalMatrix * normal);
    vWorldPosition = (modelMatrix * vec4(position, 1.0)).xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const earthFragmentShader = /* glsl */ `
uniform sampler2D dayTexture;
uniform sampler2D nightTexture;
uniform sampler2D specularTexture;
uniform vec3 sunDirection;
uniform int lightingMode;

varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vWorldPosition;

void main() {
    vec3 normal = normalize(vNormal);
    vec3 sunDir = normalize(sunDirection);

    // Cosine of angle between surface normal and sun direction
    float cosAngle = dot(normal, sunDir);

    // Smooth terminator: transition zone from night to day
    float dayFactor = smoothstep(-0.15, 0.3, cosAngle);
    
    // Override based on lightingMode
    if (lightingMode == 1 || lightingMode == 3) {
        dayFactor = 1.0; // Solo Día o Plano
    } else if (lightingMode == 2) {
        dayFactor = 0.0; // Solo Noche
    }

    // Sample textures
    vec4 dayColor = texture2D(dayTexture, vUv);
    vec4 nightColor = texture2D(nightTexture, vUv);

    // Lit day side (apply diffuse lighting)
    float lighting = (lightingMode == 1 || lightingMode == 3) ? 1.0 : (0.08 + 0.92 * max(0.0, cosAngle));
    vec3 litDay = dayColor.rgb * lighting;

    // Night side: boost city lights emission + add faint moonlight on terrain
    // We use a small fraction of the day color with a bluish tint to reveal continents
    vec3 moonLight = dayColor.rgb * 0.08 * vec3(0.4, 0.6, 1.0);
    vec3 nightGlow = nightColor.rgb * 2.5 + moonLight; // Boosted city lights to 2.5 for better visibility

    // Mix day and night
    vec3 color = mix(nightGlow, litDay, dayFactor);

    // Specular highlight on water bodies (Disabled in Flat/Plano mode)
    if (lightingMode != 3) {
        float spec = texture2D(specularTexture, vUv).r;
        vec3 viewDir = normalize(cameraPosition - vWorldPosition);
        vec3 halfDir = normalize(sunDir + viewDir);
        float specIntensity = pow(max(dot(normal, halfDir), 0.0), 48.0) * spec * dayFactor;
        color += vec3(0.35, 0.55, 0.8) * specIntensity * 0.4;
    }

    gl_FragColor = vec4(color, 1.0);
}
`;

const atmosphereVertexShader = /* glsl */ `
varying vec3 vNormal;
varying vec3 vViewDir;

void main() {
    vNormal = normalize(normalMatrix * normal);
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vViewDir = normalize(cameraPosition - worldPos.xyz);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const atmosphereFragmentShader = /* glsl */ `
uniform vec3 glowColor;
uniform float intensity;
varying vec3 vNormal;
varying vec3 vViewDir;

void main() {
    float fresnel = pow(0.62 - dot(vNormal, vViewDir), 3.5);
    fresnel = clamp(fresnel, 0.0, 1.0);
    gl_FragColor = vec4(glowColor * intensity, fresnel * 0.75);
}
`;

// --- Procedural Texture Fallbacks ---

function createProceduralDayTexture() {
    const w = 2048, h = 1024;
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d');

    // Ocean gradient (deep blue, varying with latitude)
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, '#1b3a5c');
    grad.addColorStop(0.15, '#14466e');
    grad.addColorStop(0.35, '#0e5a8f');
    grad.addColorStop(0.5, '#0e64a0');
    grad.addColorStop(0.65, '#0e5a8f');
    grad.addColorStop(0.85, '#14466e');
    grad.addColorStop(1, '#1b3a5c');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Simplified continents
    const continents = getContinentPaths();
    continents.forEach(path => {
        ctx.beginPath();
        const pts = path.map(([lng, lat]) => [
            ((lng + 180) / 360) * w,
            ((90 - lat) / 180) * h
        ]);
        ctx.moveTo(pts[0][0], pts[0][1]);
        for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
        ctx.closePath();

        // Land gradient
        const landGrad = ctx.createLinearGradient(0, 0, 0, h);
        landGrad.addColorStop(0, '#e8e4d8');    // snow
        landGrad.addColorStop(0.15, '#5a8a5c');  // tundra
        landGrad.addColorStop(0.3, '#3d7a40');   // forest
        landGrad.addColorStop(0.45, '#4a9a4e');  // tropical
        landGrad.addColorStop(0.55, '#4a9a4e');
        landGrad.addColorStop(0.7, '#3d7a40');
        landGrad.addColorStop(0.85, '#5a8a5c');
        landGrad.addColorStop(1, '#e8e4d8');
        ctx.fillStyle = landGrad;
        ctx.fill();
    });

    // Grid lines (subtle)
    ctx.strokeStyle = 'rgba(120, 200, 255, 0.045)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 36; i++) {
        const x = (i / 36) * w;
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
    }
    for (let i = 0; i <= 18; i++) {
        const y = (i / 18) * h;
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
}

function createProceduralNightTexture() {
    const w = 2048, h = 1024;
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d');

    // Very dark background
    ctx.fillStyle = '#020208';
    ctx.fillRect(0, 0, w, h);

    // City lights on continents
    const continents = getContinentPaths();

    // Create temporary canvas to check if point is inside continent
    const maskCanvas = document.createElement('canvas');
    maskCanvas.width = w; maskCanvas.height = h;
    const maskCtx = maskCanvas.getContext('2d');
    continents.forEach(path => {
        maskCtx.beginPath();
        const pts = path.map(([lng, lat]) => [
            ((lng + 180) / 360) * w,
            ((90 - lat) / 180) * h
        ]);
        maskCtx.moveTo(pts[0][0], pts[0][1]);
        for (let i = 1; i < pts.length; i++) maskCtx.lineTo(pts[i][0], pts[i][1]);
        maskCtx.closePath();
        maskCtx.fillStyle = '#fff';
        maskCtx.fill();
    });
    const maskData = maskCtx.getImageData(0, 0, w, h).data;

    // Scatter lights where mask is white
    const rng = mulberry32(42);
    for (let i = 0; i < 18000; i++) {
        const x = Math.floor(rng() * w);
        const y = Math.floor(rng() * h);
        const idx = (y * w + x) * 4;
        if (maskData[idx] > 128) {
            const brightness = 0.3 + rng() * 0.7;
            const radius = 1 + rng() * 2.5;
            const hue = rng() > 0.7 ? 30 : 50; // mix warm yellow and orange
            ctx.beginPath();
            ctx.arc(x, y, radius, 0, Math.PI * 2);
            const grad = ctx.createRadialGradient(x, y, 0, x, y, radius);
            grad.addColorStop(0, `hsla(${hue}, 90%, 85%, ${brightness})`);
            grad.addColorStop(1, `hsla(${hue}, 90%, 60%, 0)`);
            ctx.fillStyle = grad;
            ctx.fill();
        }
    }

    // Add some brighter clusters for major cities
    const majorCities = [
        [-74, 40.7], [-118, 34], [-87, 41.9], [-99, 19.4], [-43, -22.9], [-58, -34.6],
        [0, 51.5], [2.3, 48.9], [13.4, 52.5], [12.5, 41.9], [-3.7, 40.4],
        [37.6, 55.8], [28.9, 41], [31.2, 30], [55.3, 25.3],
        [77.2, 28.6], [72.9, 19.1], [88.4, 22.6], [90.4, 23.7],
        [103.8, 1.4], [106.8, -6.2], [100.5, 13.8], [116.4, 39.9],
        [121.5, 31.2], [114.2, 22.3], [126.9, 37.6], [139.7, 35.7],
        [151.2, -33.9], [174.8, -41.3]
    ];
    majorCities.forEach(([lng, lat]) => {
        const cx = ((lng + 180) / 360) * w;
        const cy = ((90 - lat) / 180) * h;
        for (let j = 0; j < 40; j++) {
            const ox = cx + (rng() - 0.5) * 20;
            const oy = cy + (rng() - 0.5) * 15;
            const r = 1 + rng() * 3;
            const br = 0.5 + rng() * 0.5;
            ctx.beginPath();
            const grad = ctx.createRadialGradient(ox, oy, 0, ox, oy, r);
            grad.addColorStop(0, `hsla(45, 100%, 88%, ${br})`);
            grad.addColorStop(1, 'hsla(45, 100%, 60%, 0)');
            ctx.fillStyle = grad;
            ctx.arc(ox, oy, r, 0, Math.PI * 2);
            ctx.fill();
        }
    });

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
}

function createProceduralSpecularTexture() {
    const w = 2048, h = 1024;
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d');

    // White everywhere (ocean = reflective)
    ctx.fillStyle = '#aaa';
    ctx.fillRect(0, 0, w, h);

    // Black on continents (land = not reflective)
    const continents = getContinentPaths();
    continents.forEach(path => {
        ctx.beginPath();
        const pts = path.map(([lng, lat]) => [
            ((lng + 180) / 360) * w,
            ((90 - lat) / 180) * h
        ]);
        ctx.moveTo(pts[0][0], pts[0][1]);
        for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
        ctx.closePath();
        ctx.fillStyle = '#111';
        ctx.fill();
    });

    return new THREE.CanvasTexture(canvas);
}

// --- Advanced Procedural Textures ---

async function createHologramTexture() {
    const w = 4096, h = 2048;
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d');

    // Deep black background
    ctx.fillStyle = '#02040a';
    ctx.fillRect(0, 0, w, h);

    // Glowing cyan grid
    ctx.strokeStyle = 'rgba(0, 255, 255, 0.15)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    // Latitudes (every 10 degrees)
    for (let i = 0; i <= 18; i++) {
        const y = (i / 18) * h;
        ctx.moveTo(0, y); ctx.lineTo(w, y);
    }
    // Longitudes (every 10 degrees)
    for (let i = 0; i <= 36; i++) {
        const x = (i / 36) * w;
        ctx.moveTo(x, 0); ctx.lineTo(x, h);
    }
    ctx.stroke();

    // Fetch real country borders for high-fidelity glowing edges
    try {
        const res = await fetch('https://raw.githubusercontent.com/datasets/geo-countries/master/data/countries.geojson');
        const data = await res.json();
        
        ctx.strokeStyle = '#00ffff';
        ctx.lineWidth = 2;
        ctx.shadowColor = '#00ffff';
        ctx.shadowBlur = 8; // Neon glow

        ctx.beginPath();
        data.features.forEach(feature => {
            const drawPoly = (coords) => {
                const boundary = coords[0];
                if (!boundary) return;
                for (let i = 0; i < boundary.length; i++) {
                    const [lng, lat] = boundary[i];
                    const x = ((lng + 180) / 360) * w;
                    const y = ((90 - lat) / 180) * h;
                    if (i === 0) ctx.moveTo(x, y);
                    else {
                        const [prevLng] = boundary[i - 1];
                        if (Math.abs(lng - prevLng) < 180) ctx.lineTo(x, y);
                        else ctx.moveTo(x, y);
                    }
                }
            };
            if (feature.geometry.type === 'Polygon') drawPoly(feature.geometry.coordinates);
            else if (feature.geometry.type === 'MultiPolygon') feature.geometry.coordinates.forEach(drawPoly);
        });
        ctx.stroke();
    } catch (e) {
        console.warn('Failed to load countries for hologram', e);
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
}

async function createTectonicTexture() {
    const w = 4096, h = 2048;
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d');

    // Dark greyish-blue background (like a dark ocean/land)
    ctx.fillStyle = '#0a0d14';
    ctx.fillRect(0, 0, w, h);
    
    // Faint grid for scale
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 18; i++) { const y = (i / 18) * h; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
    for (let i = 0; i <= 36; i++) { const x = (i / 36) * w; ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }

    // Optional: Draw very faint continent outlines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1;
    const continents = getContinentPaths();
    continents.forEach(path => {
        ctx.beginPath();
        const pts = path.map(([lng, lat]) => [((lng + 180) / 360) * w, ((90 - lat) / 180) * h]);
        ctx.moveTo(pts[0][0], pts[0][1]);
        for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
        ctx.stroke();
    });

    // Fetch tectonic plates boundaries
    try {
        const res = await fetch('https://raw.githubusercontent.com/fraxen/tectonicplates/master/GeoJSON/PB2002_boundaries.json');
        const data = await res.json();
        
        ctx.strokeStyle = '#ff4400';
        ctx.lineWidth = 4;
        ctx.shadowColor = '#ffaa00';
        ctx.shadowBlur = 10; // Magma glow

        ctx.beginPath();
        data.features.forEach(feature => {
            if (feature.geometry.type === 'LineString') {
                const coords = feature.geometry.coordinates;
                for (let i = 0; i < coords.length; i++) {
                    const [lng, lat] = coords[i];
                    const x = ((lng + 180) / 360) * w;
                    const y = ((90 - lat) / 180) * h;
                    if (i === 0) ctx.moveTo(x, y);
                    else {
                        const [prevLng] = coords[i - 1];
                        if (Math.abs(lng - prevLng) < 180) ctx.lineTo(x, y);
                        else ctx.moveTo(x, y);
                    }
                }
            }
        });
        ctx.stroke();
    } catch (e) {
        console.warn('Failed to load tectonic plates', e);
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
}

// Simple seeded RNG (mulberry32)
function mulberry32(a) {
    return function() {
        a |= 0; a = a + 0x6D2B79F5 | 0;
        let t = Math.imul(a ^ a >>> 15, 1 | a);
        t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
}

// Simplified continent outlines [lng, lat]
function getContinentPaths() {
    return [
        // North America
        [[-130,55],[-125,50],[-123,46],[-120,37],[-117,32],[-110,25],[-105,20],[-100,18],[-97,17],[-92,16],[-87,14],[-83,10],[-80,8],[-78,18],[-80,25],[-82,30],[-77,35],[-73,40],[-70,42],[-67,45],[-60,47],[-55,51],[-57,55],[-62,58],[-68,60],[-75,62],[-80,64],[-85,67],[-90,70],[-100,72],[-115,72],[-130,70],[-140,65],[-145,62],[-150,61],[-155,58],[-160,56],[-165,62],[-170,65],[-168,68],[-165,70],[-155,72],[-140,72],[-130,70],[-130,55]],
        // South America
        [[-80,10],[-78,5],[-77,2],[-80,-2],[-78,-5],[-75,-10],[-72,-15],[-70,-18],[-67,-22],[-65,-28],[-60,-33],[-58,-36],[-64,-42],[-66,-45],[-68,-48],[-70,-52],[-73,-53],[-75,-50],[-74,-46],[-73,-40],[-72,-35],[-71,-30],[-70,-22],[-68,-15],[-65,-10],[-60,-5],[-55,-2],[-50,0],[-47,-2],[-42,-3],[-38,-5],[-36,-8],[-36,-12],[-38,-15],[-40,-20],[-43,-23],[-47,-25],[-50,-28],[-52,-32],[-53,-34],[-57,-36],[-60,-33],[-65,-28],[-67,-22],[-80,10]],
        // Europe
        [[-10,36],[-6,37],[-2,36],[2,38],[3,43],[6,44],[8,44],[10,46],[12,44],[14,41],[16,39],[18,38],[20,36],[22,35],[24,35],[26,36],[28,38],[30,41],[32,42],[28,44],[24,45],[22,48],[20,50],[18,52],[16,54],[14,54],[10,55],[8,55],[6,53],[3,51],[0,51],[-3,48],[-5,44],[-8,43],[-9,39],[-10,36]],
        // Africa
        [[-15,28],[-17,15],[-17,12],[-15,10],[-10,6],[-8,5],[-3,5],[2,5],[5,4],[8,4],[10,2],[10,5],[12,4],[15,3],[18,2],[20,3],[25,0],[30,-1],[32,-3],[35,-5],[38,-8],[40,-11],[40,-15],[37,-20],[35,-25],[32,-28],[30,-30],[28,-33],[25,-34],[20,-35],[18,-32],[20,-28],[25,-26],[28,-22],[30,-15],[32,-8],[33,-3],[35,0],[35,5],[35,10],[35,15],[33,20],[35,30],[35,32],[32,35],[28,37],[22,38],[15,38],[12,37],[10,37],[5,36],[0,35],[-5,36],[-10,36],[-15,28]],
        // Asia
        [[28,38],[30,41],[32,42],[35,42],[38,40],[40,38],[42,37],[44,35],[46,32],[48,30],[52,26],[55,25],[58,22],[60,25],[62,28],[66,30],[68,28],[70,26],[72,22],[74,20],[77,18],[78,8],[80,10],[82,15],[84,18],[86,22],[88,22],[90,22],[92,20],[95,18],[98,16],[100,14],[102,12],[104,10],[106,8],[108,6],[110,2],[115,0],[118,2],[120,8],[122,12],[125,10],[128,8],[120,5],[118,0],[115,-3],[114,-6],[112,-8],[110,-6],[108,2],[106,8],[105,10],[102,14],[100,16],[98,20],[96,22],[95,24],[90,28],[88,28],[86,28],[84,28],[80,30],[78,34],[76,35],[72,37],[70,38],[68,40],[66,42],[64,40],[62,38],[60,38],[56,40],[54,42],[52,45],[50,48],[48,50],[50,52],[52,54],[55,55],[60,55],[62,55],[65,55],[68,55],[70,58],[72,60],[75,60],[80,55],[82,52],[85,50],[90,50],[95,50],[100,48],[105,45],[108,48],[110,50],[115,50],[120,52],[125,55],[130,55],[135,52],[138,48],[140,44],[142,40],[143,37],[145,35],[148,32],[148,36],[145,42],[143,45],[140,48],[138,52],[135,55],[130,60],[125,62],[120,60],[115,55],[110,55],[105,52],[100,55],[95,55],[90,55],[85,55],[80,60],[75,65],[70,68],[65,70],[60,68],[55,60],[52,58],[50,55],[48,52],[46,50],[44,48],[42,45],[40,42],[38,40],[35,42],[33,38],[32,36],[28,38]],
        // Australia
        [[114,-25],[115,-30],[115,-34],[118,-35],[122,-35],[126,-33],[130,-32],[132,-28],[134,-25],[135,-20],[136,-15],[134,-12],[132,-12],[130,-14],[128,-16],[126,-18],[124,-20],[122,-22],[120,-25],[118,-30],[116,-33],[114,-34],[114,-25]],
        // Greenland
        [[-55,60],[-50,62],[-45,62],[-40,63],[-35,65],[-25,70],[-20,74],[-18,77],[-22,80],[-30,82],[-40,83],[-50,82],[-55,80],[-58,77],[-58,74],[-56,70],[-53,65],[-55,60]],
    ];
}


// --- Globe Creation ---

async function loadTexture(url) {
    return new Promise((resolve, reject) => {
        new THREE.TextureLoader().load(
            url,
            (tex) => { tex.colorSpace = THREE.SRGBColorSpace; resolve(tex); },
            undefined,
            () => reject(new Error(`Failed to load ${url}`))
        );
    });
}

async function loadTextures(onProgress) {
    const textures = {};
    const keys = ['day', 'night', 'specular'];

    for (const key of keys) {
        try {
            if (onProgress) onProgress(`Cargando textura: ${key}...`);
            textures[key] = await loadTexture(TEXTURE_URLS[key]);
        } catch (e) {
            console.warn(`Textura "${key}" no cargó, usando procedural.`, e.message);
        }
    }

    // Fallback to procedural textures
    if (!textures.day) textures.day = createProceduralDayTexture();
    if (!textures.night) textures.night = createProceduralNightTexture();
    if (!textures.specular) textures.specular = createProceduralSpecularTexture();

    // Also try to load bump and clouds (optional)
    try {
        textures.bump = await loadTexture(TEXTURE_URLS.bump);
    } catch (e) { /* no bump, fine */ }

    try {
        textures.clouds = await loadTexture(TEXTURE_URLS.clouds);
    } catch (e) { /* no clouds texture, fine */ }

    return textures;
}

export async function createGlobe(scene, onProgress) {
    const textures = await loadTextures(onProgress);

    // --- Earth Mesh (Day/Night Shader) ---
    const earthGeo = new THREE.SphereGeometry(GLOBE_RADIUS, 128, 64);
    const earthMat = new THREE.ShaderMaterial({
        uniforms: {
            dayTexture: { value: textures.day },
            nightTexture: { value: textures.night },
            specularTexture: { value: textures.specular },
            sunDirection: { value: new THREE.Vector3(1, 0.2, 0.5).normalize() },
            lightingMode: { value: 0 },
        },
        vertexShader: earthVertexShader,
        fragmentShader: earthFragmentShader,
    });
    const earth = new THREE.Mesh(earthGeo, earthMat);
    earth.layers.set(0);
    earth.name = 'earth';
    scene.add(earth);

    // --- Atmosphere (Fresnel Glow) ---
    const atmoGeo = new THREE.SphereGeometry(GLOBE_RADIUS * 1.06, 64, 32);
    const atmoMat = new THREE.ShaderMaterial({
        uniforms: {
            glowColor: { value: new THREE.Color(0x4488ff) },
            intensity: { value: 1.2 },
        },
        vertexShader: atmosphereVertexShader,
        fragmentShader: atmosphereFragmentShader,
        side: THREE.BackSide,
        blending: THREE.AdditiveBlending,
        transparent: true,
        depthWrite: false,
    });
    const atmosphere = new THREE.Mesh(atmoGeo, atmoMat);
    atmosphere.layers.set(1); // Excluded from raycasting
    atmosphere.name = 'atmosphere';
    scene.add(atmosphere);

    // --- Clouds Layer ---
    let clouds = null;
    if (textures.clouds) {
        const cloudGeo = new THREE.SphereGeometry(GLOBE_RADIUS * 1.008, 64, 32);
        const cloudMat = new THREE.MeshPhongMaterial({
            map: textures.clouds,
            transparent: true,
            opacity: 0.28,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
        });
        clouds = new THREE.Mesh(cloudGeo, cloudMat);
        clouds.layers.set(1);
        clouds.name = 'clouds';
        scene.add(clouds);
    }

    // --- Lighting ---
    const sunLight = new THREE.DirectionalLight(0xffffff, 1.8);
    sunLight.position.set(5, 1, 3);
    scene.add(sunLight);

    const ambient = new THREE.AmbientLight(0x222244, 0.3);
    scene.add(ambient);

    // --- Stars Background ---
    const starsGeo = new THREE.BufferGeometry();
    const starCount = 6000;
    const starPositions = new Float32Array(starCount * 3);
    const starSizes = new Float32Array(starCount);
    const rng = mulberry32(1337);
    for (let i = 0; i < starCount; i++) {
        const r = 50 + rng() * 50;
        const theta = rng() * Math.PI * 2;
        const phi = Math.acos(2 * rng() - 1);
        starPositions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
        starPositions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
        starPositions[i * 3 + 2] = r * Math.cos(phi);
        starSizes[i] = 0.3 + rng() * 1.5;
    }
    starsGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    starsGeo.setAttribute('size', new THREE.BufferAttribute(starSizes, 1));
    const starsMat = new THREE.PointsMaterial({
        color: 0xeeeeff,
        size: 0.15,
        sizeAttenuation: true,
        transparent: true,
        opacity: 0.85,
    });
    const stars = new THREE.Points(starsGeo, starsMat);
    stars.layers.set(1);
    scene.add(stars);

    return { earth, atmosphere, clouds, sunLight, stars };
}

export function updateGlobe(globeObjects, time, sunAngle, lightingMode = 0) {
    const { clouds, sunLight, earth } = globeObjects;

    // Rotate clouds slowly
    if (clouds) {
        clouds.rotation.y = time * 0.01;
    }

    // Update sun position based on slider angle
    const rad = (sunAngle || 180) * (Math.PI / 180);
    const sunDir = new THREE.Vector3(
        Math.cos(rad),
        0.15,
        Math.sin(rad)
    ).normalize();

    sunLight.position.copy(sunDir.clone().multiplyScalar(5));

    // Update shader uniform
    if (earth.material.uniforms) {
        earth.material.uniforms.sunDirection.value.copy(sunDir);
        earth.material.uniforms.lightingMode.value = lightingMode;
    }
}

export async function changeEarthTexture(globeObjects, textureType) {
    const { earth } = globeObjects;
    if (!earth || !earth.material.uniforms) return;

    let url = TEXTURE_URLS.day; // default satellite
    if (textureType === 'dark') {
        url = 'https://unpkg.com/three-globe/example/img/earth-dark.jpg';
    } else if (textureType === 'classic') {
        url = 'https://unpkg.com/three-globe/example/img/earth-day.jpg';
    }

    try {
        let tex;
        if (textureType === 'hologram') {
            tex = await createHologramTexture();
        } else if (textureType === 'tectonic') {
            tex = await createTectonicTexture();
        } else {
            tex = await loadTexture(url);
        }
        
        // Replace the day texture uniform
        if (earth.material.uniforms.dayTexture.value) {
            earth.material.uniforms.dayTexture.value.dispose(); // clean up old texture
        }
        earth.material.uniforms.dayTexture.value = tex;
    } catch (err) {
        console.error('Failed to change texture', err);
    }
}
