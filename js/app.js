// ============================================
// app.js — Main Entry Point (CesiumJS)
// ============================================
import { EarthquakeManager } from './earthquakes.js';
import { setupUI, showLoading, hideLoading, updateStats, showQuakeInfo, hideQuakeInfo, updateQuakeList, showTooltip, hideTooltip } from './ui.js';

// --- State ---
let viewer;
let quakeManager = null;
let bordersDataSource = null;
let labelsLayer = null;
let roadsLayer = null;
let statesLayer = null;
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

    // Optimize camera for a good initial view
    viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(-90, 20, 20000000), // View over Americas
        duration: 0
    });

    // Earthquake Manager
    quakeManager = new EarthquakeManager(viewer);

    // UI
    setupUI(
        // onFilterChange
        async (min, max, period) => {
            showLoading('Cargando sismos...');
            const quakes = await quakeManager.loadData(min, max, period);
            updateStats(quakes);
            updateQuakeList(quakes, onQuakeListItemClick);
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
            updateQuakeList(quakes, onQuakeListItemClick);
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
                if (!bordersDataSource) {
                    showLoading('Cargando fronteras...');
                    try {
                        bordersDataSource = await Cesium.GeoJsonDataSource.load(
                            'https://d2ad6b4ur7yvpq.cloudfront.net/naturalearth-3.3.0/ne_110m_admin_0_countries.geojson', {
                            stroke: Cesium.Color.fromCssColorString('rgba(255,255,255,0.4)'),
                            fill: Cesium.Color.TRANSPARENT,
                            strokeWidth: 2
                        });
                        viewer.dataSources.add(bordersDataSource);
                    } catch (e) {
                        console.error('Error loading borders:', e);
                    }
                    hideLoading();
                } else {
                    bordersDataSource.show = true;
                }
            } else {
                if (bordersDataSource) bordersDataSource.show = false;
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
                } else {
                    roadsLayer.show = true;
                }
                
                if (!statesLayer) {
                    try {
                        const statesProvider = await Cesium.ArcGisMapServerImageryProvider.fromUrl(
                            'https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer'
                        );
                        statesLayer = viewer.imageryLayers.addImageryProvider(statesProvider);
                    } catch (e) {
                        console.error('Error loading states:', e);
                    }
                    hideLoading();
                } else {
                    statesLayer.show = true;
                }
            } else {
                if (roadsLayer) roadsLayer.show = false;
                if (statesLayer) statesLayer.show = false;
            }
        }
    );

    // Initial check for borders toggle
    const toggleBorders = document.getElementById('toggle-borders');
    if (toggleBorders && toggleBorders.checked) {
        setupUI.onToggleBorders = true;
        document.getElementById('toggle-borders').dispatchEvent(new Event('change'));
        setupUI.onToggleBorders = false;
        
        // Let's actually load it right away since it's checked by default
        showLoading('Cargando fronteras...');
        try {
            bordersDataSource = await Cesium.GeoJsonDataSource.load(
                'https://d2ad6b4ur7yvpq.cloudfront.net/naturalearth-3.3.0/ne_110m_admin_0_countries.geojson', {
                stroke: Cesium.Color.fromCssColorString('rgba(255,255,255,0.4)'),
                fill: Cesium.Color.TRANSPARENT,
                strokeWidth: 2
            });
            viewer.dataSources.add(bordersDataSource);
        } catch (e) {
            console.error('Error loading borders:', e);
        }
        hideLoading();
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

    // Click event
    handler.setInputAction(function (movement) {
        const pickedObject = viewer.scene.pick(movement.position);
        if (Cesium.defined(pickedObject) && pickedObject.id && typeof pickedObject.id.id === 'string') {
            const entityId = pickedObject.id.id;
            const feature = quakeManager.quakeData.find(f => f.id === entityId);
            if (feature) {
                showQuakeInfo(feature);
                quakeManager.triggerWaves(entityId);
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
    updateQuakeList(quakes, onQuakeListItemClick);

    // Hide loading
    hideLoading();
}

async function checkRealtimeUpdates() {
    const min = parseFloat(document.getElementById('filter-mag-min').value);
    const max = parseFloat(document.getElementById('filter-mag-max').value);
    const period = document.getElementById('filter-period').value;
    
    // Fetch silently
    const quakes = await quakeManager.loadData(min, max, period);
    updateStats(quakes);
    updateQuakeList(quakes, onQuakeListItemClick);
    
    if (quakes.length > 0) {
        const newestQuake = quakes[0]; // Assuming index 0 is newest (USGS format)
        if (lastKnownQuakeId && newestQuake.id !== lastKnownQuakeId) {
            // New earthquake detected!
            lastKnownQuakeId = newestQuake.id;
            
            // Auto fly and show info
            onQuakeListItemClick(newestQuake);
            
            // Optionally show a mini notification? The info panel is enough.
        } else {
            lastKnownQuakeId = newestQuake.id;
        }
    }
}

function onQuakeListItemClick(feature) {
    showQuakeInfo(feature);
    
    // Trigger waves using the string ID
    quakeManager.triggerWaves(feature.id);
    
    // Fly camera to earthquake!
    const [lng, lat] = feature.geometry.coordinates;
    viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(lng, lat, 2000000), // 2000km high
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
