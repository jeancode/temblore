// ============================================
// app.js — Main Entry Point (CesiumJS)
// ============================================
import { EarthquakeManager } from './earthquakes.js?v=2.11';
import { setupUI, showLoading, hideLoading, updateStats, showQuakeInfo, hideQuakeInfo, updateQuakeList, selectQuakeInList, showTooltip, hideTooltip } from './ui.js?v=2.11';
import { LiveMonitorManager } from './liveMonitor.js?v=2.11';

// --- State ---
let viewer;
let quakeManager = null;
let liveMonitor = null;
let bordersLayer = null;
let labelsLayer = null;
let roadsLayer = null;
let realtimeInterval = null;
let lastKnownQuakeId = null;

// --- Initialize ---
async function init() {
    showLoading('Inicializando motor CesiumJS...');

    // Initialize Cesium Viewer
    // We disable all the default widgets for a clean look
    viewer = new Cesium.Viewer('cesiumContainer', {
        animation: false,
        baseLayerPicker: false,
        fullscreenButton: false,
        geocoder: false,
        homeButton: false,
        infoBox: false,
        sceneModePicker: false,
        selectionIndicator: false,
        timeline: false,
        navigationHelpButton: false,
        navigationInstructionsInitiallyVisible: false,
        scene3DOnly: true,
        skyAtmosphere: new Cesium.SkyAtmosphere(),
        baseLayer: Cesium.ImageryLayer.fromProviderAsync(
            Cesium.ArcGisMapServerImageryProvider.fromUrl(
                'https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer'
            )
        )
    });

    // Remove the default Cesium logo/credits
    viewer.cesiumWidget.creditContainer.style.display = 'none';

    // Optimize camera for a good initial view over Mexico & Americas
    viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(-102, 23, 6000000), // View over Mexico
        orientation: {
            heading: Cesium.Math.toRadians(0),
            pitch: Cesium.Math.toRadians(-90),
            roll: 0.0
        },
        duration: 0
    });

    // Earthquake Manager
    quakeManager = new EarthquakeManager(viewer);

    // Live Country Monitor Manager (Default: México)
    // onQuakeFocus moves camera, onQuakeSelect opens info and highlights without moving camera
    liveMonitor = new LiveMonitorManager(viewer, onQuakeFocus, onQuakeSelect);
    liveMonitor.start();

    // UI
    setupUI(
        // onFilterChange
        async (min, max, period) => {
            showLoading('Cargando sismos...');
            const quakes = await quakeManager.loadData(min, max, period);
            updateStats(quakes);
            updateQuakeList(quakes, onQuakeFocus);
            hideLoading();
        },
        // onRefresh
        async () => {
            const min = parseFloat(document.getElementById('filter-mag-min').value);
            const max = parseFloat(document.getElementById('filter-mag-max').value);
            const period = document.getElementById('filter-period').value;
            showLoading('Actualizando datos...');
            const quakes = await quakeManager.loadData(min, max, period);
            updateStats(quakes);
            updateQuakeList(quakes, onQuakeFocus);
            hideLoading();
        },
        // onLightChange
        (mode) => {
            if (mode == 3) {
                viewer.scene.globe.enableLighting = false;
            } else {
                viewer.scene.globe.enableLighting = true;
            }
        },
        // onToggleBorders
        async (visible) => {
            if (visible) {
                await loadBorders();
            } else {
                if (bordersLayer) bordersLayer.show = false;
            }
        },
        // onRealTimeToggle
        (active) => {
            if (active) {
                if (realtimeInterval) clearInterval(realtimeInterval);
                realtimeInterval = setInterval(checkRealtimeUpdates, 60000);
            } else {
                if (realtimeInterval) clearInterval(realtimeInterval);
                realtimeInterval = null;
            }
        },
        // onToggleLabels
        (active) => {
            if (active) {
                if (!labelsLayer) {
                    labelsLayer = viewer.imageryLayers.addImageryProvider(new Cesium.UrlTemplateImageryProvider({
                        url: 'https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}.png',
                        subdomains: ['a', 'b', 'c', 'd'],
                        maximumLevel: 10
                    }));
                } else {
                    labelsLayer.show = true;
                }
            } else {
                if (labelsLayer) labelsLayer.show = false;
            }
        },
        // onToggleRoads
        async (active) => {
            if (active) {
                if (!roadsLayer) {
                    showLoading('Cargando carreteras...');
                    try {
                        const roadsProvider = await Cesium.ArcGisMapServerImageryProvider.fromUrl(
                            'https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer'
                        );
                        roadsLayer = viewer.imageryLayers.addImageryProvider(roadsProvider);
                    } catch (e) {
                        console.error('Error loading roads:', e);
                    }
                    hideLoading();
                } else {
                    roadsLayer.show = true;
                }
            } else {
                if (roadsLayer) roadsLayer.show = false;
            }
        }
    );

    // Initial check for borders toggle
    const toggleBorders = document.getElementById('toggle-borders');
    if (toggleBorders && toggleBorders.checked) {
        await loadBorders();
    }

    // Setup Cesium Picking (Raycasting equivalent) for tooltips
    const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
    
    // Hover event for tooltips
    handler.setInputAction(function (movement) {
        const pickedObject = viewer.scene.pick(movement.endPosition);
        if (Cesium.defined(pickedObject) && pickedObject.id && typeof pickedObject.id.id === 'string') {
            const entityId = pickedObject.id.id;
            const feature = quakeManager.quakeData.find(f => f.id === entityId);
            if (feature) {
                const mag = feature.properties.mag?.toFixed(1) || '?';
                const place = feature.properties.place || 'Desconocido';
                showTooltip(movement.endPosition.x, movement.endPosition.y, `M${mag} — ${place}`);
            }
        } else {
            hideTooltip();
        }
    }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

    // Click event on globe markers
    handler.setInputAction(function (movement) {
        const pickedObject = viewer.scene.pick(movement.position);
        if (Cesium.defined(pickedObject) && pickedObject.id && typeof pickedObject.id.id === 'string') {
            const entityId = pickedObject.id.id;
            const feature = quakeManager.quakeData.find(f => f.id === entityId);
            if (feature) {
                onQuakeSelect(feature);
            }
        }
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

    // Load initial earthquake data
    showLoading('Cargando datos sísmicos del USGS...');
    const quakes = await quakeManager.loadData(2.5, 10.0, 'week');
    if (quakes.length > 0) {
        lastKnownQuakeId = quakes[0].id; // The USGS feed usually sorts newest first
    }
    updateStats(quakes);
    updateQuakeList(quakes, onQuakeFocus);

    // Hide loading
    hideLoading();
}

async function loadBorders() {
    if (!bordersLayer) {
        showLoading('Cargando fronteras...');
        try {
            const provider = await Cesium.ArcGisMapServerImageryProvider.fromUrl(
                'https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer'
            );
            bordersLayer = viewer.imageryLayers.addImageryProvider(provider);
        } catch (e) {
            console.error('Error loading borders:', e);
        }
        hideLoading();
    } else {
        bordersLayer.show = true;
    }
}

async function checkRealtimeUpdates() {
    const min = parseFloat(document.getElementById('filter-mag-min').value);
    const max = parseFloat(document.getElementById('filter-mag-max').value);
    const period = document.getElementById('filter-period').value;
    
    // Fetch silently
    const quakes = await quakeManager.loadData(min, max, period);
    updateStats(quakes);
    updateQuakeList(quakes, onQuakeFocus);
    
    if (quakes.length > 0) {
        const newestQuake = quakes[0]; // Assuming index 0 is newest (USGS format)
        if (lastKnownQuakeId && newestQuake.id !== lastKnownQuakeId) {
            // New earthquake detected!
            lastKnownQuakeId = newestQuake.id;
            
            // Auto fly and show info
            onQuakeFocus(newestQuake);
        } else {
            lastKnownQuakeId = newestQuake.id;
        }
    }
}

// Select quake: shows info, highlights in list and creates target beacon on 3D globe (WITHOUT camera flight)
export function onQuakeSelect(feature) {
    if (!feature || !feature.geometry || !feature.geometry.coordinates) return;

    // Show sidebar info
    showQuakeInfo(feature);

    // Highlight target on 3D globe with high-tech crosshair beacon & pulsing radar rings
    quakeManager.highlightQuake(feature);

    // Highlight item in the recent earthquake list
    selectQuakeInList(feature, onQuakeFocus);
}

// Focus quake: calls onQuakeSelect AND flies camera top-down directly over the epicenter
export function onQuakeFocus(feature) {
    if (!feature || !feature.geometry || !feature.geometry.coordinates) return;

    onQuakeSelect(feature);

    // Fly camera directly above the earthquake epicenter looking straight down
    const [lng, lat] = feature.geometry.coordinates;
    viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(lng, lat, 1200000), // 1200km altitude
        orientation: {
            heading: Cesium.Math.toRadians(0),
            pitch: Cesium.Math.toRadians(-90), // Look straight down at the ground
            roll: 0.0
        },
        duration: 1.5
    });
}

// --- Start ---
init().catch(err => {
    console.error('Error initializing Temblore:', err);
    const status = document.getElementById('loading-status');
    if (status) {
        status.textContent = `Error: ${err.message}`;
        status.style.color = '#ef4444';
    }
});
