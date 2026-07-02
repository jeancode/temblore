// ============================================
// controls.js — OrbitControls & Raycasting
// ============================================
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

let controls = null;
let raycaster = null;
let mouse = new THREE.Vector2();
let hoveredMarker = null;
let onHoverCallback = null;
let onClickCallback = null;
let markersRef = [];
let cameraRef = null;
let canvasRef = null;

export function setupControls(camera, domElement) {
    cameraRef = camera;
    canvasRef = domElement;

    controls = new OrbitControls(camera, domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.rotateSpeed = 0.45;
    controls.zoomSpeed = 0.8;
    controls.minDistance = 1.4;
    controls.maxDistance = 6;
    controls.enablePan = false;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.3;

    return controls;
}

export function setupRaycaster(camera, getMarkers, onHover, onClick) {
    raycaster = new THREE.Raycaster();
    raycaster.layers.set(0); // Only intersect layer 0 (earth + markers)
    onHoverCallback = onHover;
    onClickCallback = onClick;
    cameraRef = camera;

    // Store getter for markers
    const canvas = canvasRef;

    const onMouseMove = (event) => {
        const rect = canvas.getBoundingClientRect();
        mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

        raycaster.setFromCamera(mouse, cameraRef);
        const markers = getMarkers();
        const intersects = raycaster.intersectObjects(markers, false);

        if (intersects.length > 0) {
            const marker = intersects[0].object;
            if (hoveredMarker !== marker) {
                // Un-hover previous
                if (hoveredMarker) {
                    hoveredMarker.scale.setScalar(hoveredMarker.userData.baseScale);
                    hoveredMarker.material.opacity = 0.9;
                }
                hoveredMarker = marker;
                canvas.style.cursor = 'pointer';
                if (onHoverCallback) {
                    onHoverCallback(marker.userData.feature, event.clientX, event.clientY);
                }
            }
        } else {
            if (hoveredMarker) {
                hoveredMarker.scale.setScalar(hoveredMarker.userData.baseScale);
                hoveredMarker.material.opacity = 0.9;
                hoveredMarker = null;
                canvas.style.cursor = 'grab';
                if (onHoverCallback) onHoverCallback(null);
            }
        }
    };

    const onClickEvent = (event) => {
        if (!raycaster) return;

        const rect = canvas.getBoundingClientRect();
        mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

        raycaster.setFromCamera(mouse, cameraRef);
        const markers = getMarkers();
        const intersects = raycaster.intersectObjects(markers, false);

        if (intersects.length > 0) {
            const marker = intersects[0].object;
            if (onClickCallback) {
                onClickCallback(marker.userData.feature);
            }
            // Stop auto rotation when user clicks a quake
            controls.autoRotate = false;
        }
    };

    canvas.addEventListener('mousemove', onMouseMove, false);
    canvas.addEventListener('click', onClickEvent, false);

    // Re-enable auto-rotation after inactivity
    let inactivityTimer = null;
    canvas.addEventListener('pointerup', () => {
        clearTimeout(inactivityTimer);
        inactivityTimer = setTimeout(() => {
            controls.autoRotate = true;
        }, 15000); // Resume after 15s of inactivity
    });
}

export function updateControls() {
    if (controls) {
        controls.update();
    }
}

export function getControls() {
    return controls;
}
