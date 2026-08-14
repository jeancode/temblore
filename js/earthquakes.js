// ============================================
// earthquakes.js — USGS Data, Markers & Shockwaves (CesiumJS)
// ============================================

// --- Constants ---
const USGS_BASE = 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/';
const WAVE_DURATION = 2.5; // seconds per wave cycle

// --- Magnitude → Color ---
export function getMagnitudeColor(mag) {
    if (mag < 2.5) return Cesium.Color.fromCssColorString('#4ade80');
    if (mag < 4.0) return Cesium.Color.fromCssColorString('#facc15');
    if (mag < 5.5) return Cesium.Color.fromCssColorString('#f97316');
    if (mag < 7.0) return Cesium.Color.fromCssColorString('#ef4444');
    return Cesium.Color.fromCssColorString('#c026d3');
}

export function getMagnitudeClass(mag) {
    if (mag < 2.5) return 'mag-low';
    if (mag < 4.0) return 'mag-medium';
    if (mag < 5.5) return 'mag-high';
    if (mag < 7.0) return 'mag-severe';
    return 'mag-extreme';
}

// --- Earthquake Manager ---
export class EarthquakeManager {
    constructor(viewer) {
        this.viewer = viewer;
        this.quakeData = [];      // raw GeoJSON features
        
        // Data source for markers
        this.dataSource = new Cesium.CustomDataSource('earthquakes');
        this.viewer.dataSources.add(this.dataSource);

        // Data source for active highlighted earthquake (Crosshair beacon & radar pulse rings)
        this.highlightSource = new Cesium.CustomDataSource('quakeHighlight');
        this.viewer.dataSources.add(this.highlightSource);
        
        // Active animated shockwaves
        this.activeWaves = [];
        
        // Hook into the render loop for wave cleanup
        this.viewer.scene.preUpdate.addEventListener(this.updateWaves.bind(this));
    }

    // --- Fetch Data ---
    async loadData(minMagnitude, maxMagnitude = 10.0, period = 'week') {
        const url = `${USGS_BASE}all_${period}.geojson`;

        try {
            const res = await fetch(url);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            
            // Filter locally
            const features = data.features || [];
            this.quakeData = features.filter(f => {
                const m = f.properties.mag || 0;
                return m >= minMagnitude && m <= maxMagnitude;
            });
            
            this.createMarkers();
            return this.quakeData;
        } catch (err) {
            console.error('Error loading earthquake data:', err);
            return [];
        }
    }

    // --- Create Markers ---
    createMarkers() {
        this.dataSource.entities.removeAll();

        // Limit to 800 markers
        const quakes = this.quakeData.slice(0, 800);

        quakes.forEach((feature) => {
            const [lng, lat, depth] = feature.geometry.coordinates;
            const mag = feature.properties.mag || 1;
            const color = getMagnitudeColor(mag);
            
            // Marker scale
            const pixelSize = Math.max(4, Math.min(15, mag * 2));

            const entity = this.dataSource.entities.add({
                id: feature.id, // USGS provides a unique string ID
                position: Cesium.Cartesian3.fromDegrees(lng, lat, 0),
                point: {
                    pixelSize: pixelSize,
                    color: color.withAlpha(0.9),
                    outlineColor: Cesium.Color.BLACK,
                    outlineWidth: 1
                }
            });

            // Trigger initial waves for recent large quakes
            const ageHours = (Date.now() - feature.properties.time) / 3600000;
            if (ageHours < 24 && mag >= 3.0) {
                this.triggerWaves(feature.id);
            }
        });
    }

    // --- Shockwaves (Cesium Ellipses) ---
    triggerWaves(featureOrId) {
        let feature;
        if (typeof featureOrId === 'object' && featureOrId && featureOrId.geometry) {
            feature = featureOrId;
        } else {
            feature = this.quakeData.find(f => f.id === featureOrId);
        }
        if (!feature || !feature.geometry || !feature.geometry.coordinates) return;
        const [lng, lat] = feature.geometry.coordinates;
        const mag = feature.properties.mag || 1;
        const color = getMagnitudeColor(mag);
        
        // Base max radius based on magnitude (e.g. 500km for mag 7)
        const maxRadiusMeters = Math.max(50000, mag * 100000); 
        const waveCount = mag >= 5 ? 3 : 1;
        
        for (let i = 0; i < waveCount; i++) {
            const delay = i * 0.8;
            this.createSingleWave(lng, lat, maxRadiusMeters, color, delay);
        }
    }

    createSingleWave(lng, lat, maxRadiusMeters, color, delaySec) {
        const startTime = performance.now() / 1000 + delaySec;
        const duration = WAVE_DURATION;
        
        // We use CallbackProperty to animate size and opacity over time
        const radiusCallback = new Cesium.CallbackProperty((time, result) => {
            const now = performance.now() / 1000;
            const elapsed = now - startTime;
            if (elapsed < 0) return 1.0; // Before start
            
            // Loop progress
            const progress = (elapsed % duration) / duration;
            // Radius expands outward
            return Math.max(1.0, progress * maxRadiusMeters);
        }, false);

        const materialCallback = new Cesium.ColorMaterialProperty(
            new Cesium.CallbackProperty((time, result) => {
                const now = performance.now() / 1000;
                const elapsed = now - startTime;
                if (elapsed < 0) return color.withAlpha(0); // Invisible before start
                
                const progress = (elapsed % duration) / duration;
                // Fade out as it expands
                const alpha = Math.max(0, 0.8 * (1 - Math.pow(progress, 1.5)));
                return color.withAlpha(alpha);
            }, false)
        );

        const waveEntity = this.dataSource.entities.add({
            position: Cesium.Cartesian3.fromDegrees(lng, lat, 1000), // slightly above ground
            ellipse: {
                semiMinorAxis: radiusCallback,
                semiMajorAxis: radiusCallback,
                material: materialCallback,
                outline: true,
                outlineColor: materialCallback,
                outlineWidth: 2,
                height: 1000
            }
        });

        // Track to clean up later if needed (though infinite loop is fine)
        this.activeWaves.push({
            entity: waveEntity,
            startTime: startTime,
            duration: duration,
            loops: 2, // run 2 times then die
            loopCount: 0
        });
    }

    updateWaves() {
        const now = performance.now() / 1000;
        for (let i = this.activeWaves.length - 1; i >= 0; i--) {
            const wave = this.activeWaves[i];
            const elapsed = now - wave.startTime;
            if (elapsed > wave.duration) {
                wave.loopCount++;
                if (wave.loopCount >= wave.loops) {
                    this.dataSource.entities.remove(wave.entity);
                    this.activeWaves.splice(i, 1);
                } else {
                    // Reset start time for next loop
                    wave.startTime = now;
                }
            }
        }
    }

    // --- Helpers ---
    getEntityById(featureId) {
        return this.dataSource.entities.getById(featureId);
    }

    // --- Highlight Active Earthquake (Target Beacon & Radiating Rings) ---
    highlightQuake(featureOrId) {
        let feature;
        if (typeof featureOrId === 'object' && featureOrId && featureOrId.geometry) {
            feature = featureOrId;
        } else {
            feature = this.quakeData.find(f => f.id === featureOrId);
        }
        if (!feature || !feature.geometry || !feature.geometry.coordinates) return;

        this.highlightSource.entities.removeAll();

        const [lng, lat] = feature.geometry.coordinates;
        const mag = feature.properties.mag || 1;
        const color = getMagnitudeColor(mag);
        const colorCss = color.toCssColorString();

        // 1. High-Tech Target Crosshair Marker Billboard (always on top)
        const targetCanvas = createTargetCanvas(colorCss);
        this.highlightSource.entities.add({
            position: Cesium.Cartesian3.fromDegrees(lng, lat, 2000),
            billboard: {
                image: targetCanvas,
                width: 52,
                height: 52,
                verticalOrigin: Cesium.VerticalOrigin.CENTER,
                horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
                disableDepthTestDistance: Number.POSITIVE_INFINITY
            }
        });

        // 2. Animated Radiating Sonar/Beacon Rings
        const beaconDuration = 2.0;
        const maxRadius = Math.max(80000, mag * 120000);

        for (let i = 0; i < 2; i++) {
            const delay = i * 1.0;
            const startTime = performance.now() / 1000 + delay;

            const radiusCb = new Cesium.CallbackProperty(() => {
                const now = performance.now() / 1000;
                const elapsed = now - startTime;
                if (elapsed < 0) return 1.0;
                const progress = (elapsed % beaconDuration) / beaconDuration;
                return Math.max(1.0, progress * maxRadius);
            }, false);

            const matCb = new Cesium.ColorMaterialProperty(
                new Cesium.CallbackProperty(() => {
                    const now = performance.now() / 1000;
                    const elapsed = now - startTime;
                    if (elapsed < 0) return color.withAlpha(0);
                    const progress = (elapsed % beaconDuration) / beaconDuration;
                    const alpha = Math.max(0, 0.75 * (1 - progress));
                    return color.withAlpha(alpha);
                }, false)
            );

            this.highlightSource.entities.add({
                position: Cesium.Cartesian3.fromDegrees(lng, lat, 1500),
                ellipse: {
                    semiMinorAxis: radiusCb,
                    semiMajorAxis: radiusCb,
                    material: matCb,
                    outline: true,
                    outlineColor: matCb,
                    outlineWidth: 3,
                    height: 1500
                }
            });
        }

        // Also trigger one-shot shockwave burst
        this.triggerWaves(feature);
    }
}

// Generate Target Crosshair Canvas for 3D Marker
function createTargetCanvas(colorHex = '#ef4444') {
    const canvas = document.createElement('canvas');
    canvas.width = 96;
    canvas.height = 96;
    const ctx = canvas.getContext('2d');

    // Outer glow ring
    ctx.strokeStyle = colorHex;
    ctx.lineWidth = 4;
    ctx.shadowColor = colorHex;
    ctx.shadowBlur = 12;

    ctx.beginPath();
    ctx.arc(48, 48, 34, 0, Math.PI * 2);
    ctx.stroke();

    // Crosshairs
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(48, 6); ctx.lineTo(48, 22);
    ctx.moveTo(48, 74); ctx.lineTo(48, 90);
    ctx.moveTo(6, 48); ctx.lineTo(22, 48);
    ctx.moveTo(74, 48); ctx.lineTo(90, 48);
    ctx.stroke();

    // Inner bright core
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = '#ffffff';
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(48, 48, 9, 0, Math.PI * 2);
    ctx.fill();

    return canvas;
}
