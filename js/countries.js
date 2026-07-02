// ============================================
// countries.js — Baked Canvas Texture for Borders & Names
// ============================================
import * as THREE from 'three';
import { GLOBE_RADIUS } from './globe.js';

const GEOJSON_URL = 'https://raw.githubusercontent.com/datasets/geo-countries/master/data/countries.geojson';

export class CountryManager {
    constructor(scene) {
        this.scene = scene;
        this.group = new THREE.Group();
        this.group.name = 'countries';
        this.group.visible = true; // Enabled by default
        this.scene.add(this.group);
    }

    async load() {
        try {
            const res = await fetch(GEOJSON_URL);
            if (!res.ok) throw new Error('Failed to load countries');
            const data = await res.json();
            
            // Create an ultra-high-res 8K canvas for crisp microscopic text
            const w = 8192;
            const h = 4096;
            const canvas = document.createElement('canvas');
            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext('2d');

            // Set up drawing styles
            ctx.strokeStyle = 'rgba(80, 150, 255, 0.4)';
            ctx.lineWidth = 3; // slightly thicker line for 8K
            
            ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
            ctx.font = 'bold 9px Inter, sans-serif'; // 9px on 8K is extremely small (equivalent to 4.5px on previous)
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            
            // Subtle shadow for text to pop over bright backgrounds
            ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
            ctx.shadowBlur = 5;

            data.features.forEach(feature => {
                // 1. Draw Borders
                if (feature.geometry.type === 'Polygon') {
                    this.drawPolygon(ctx, feature.geometry.coordinates, w, h);
                } else if (feature.geometry.type === 'MultiPolygon') {
                    feature.geometry.coordinates.forEach(polygon => {
                        this.drawPolygon(ctx, polygon, w, h);
                    });
                }

                // 2. Draw Labels
                const name = feature.properties.name;
                if (name && feature.geometry.coordinates.length > 0) {
                    const centroid = this.calculateCentroid(feature.geometry);
                    if (centroid) {
                        const [lat, lng] = centroid;
                        const x = ((lng + 180) / 360) * w;
                        const y = ((90 - lat) / 180) * h;
                        
                        // Don't draw labels that wrap across the edge
                        if (x > 50 && x < w - 50) {
                            ctx.fillText(name.toUpperCase(), x, y);
                        }
                    }
                }
            });

            // Create Texture and Mesh
            const texture = new THREE.CanvasTexture(canvas);
            texture.colorSpace = THREE.SRGBColorSpace;
            texture.minFilter = THREE.LinearFilter;
            
            const material = new THREE.MeshBasicMaterial({
                map: texture,
                transparent: true,
                depthWrite: false,
                side: THREE.FrontSide // FrontSide natively hides the back of the globe (perfect occlusion)
            });

            // Create sphere slightly larger than the Earth
            const geo = new THREE.SphereGeometry(GLOBE_RADIUS * 1.002, 64, 64);
            const mesh = new THREE.Mesh(geo, material);
            
            this.group.add(mesh);

        } catch (err) {
            console.error('Error rendering countries to canvas:', err);
        }
    }

    drawPolygon(ctx, coordinates, w, h) {
        const boundary = coordinates[0];
        if (!boundary || boundary.length === 0) return;

        ctx.beginPath();
        for (let i = 0; i < boundary.length; i++) {
            const [lng, lat] = boundary[i];
            const x = ((lng + 180) / 360) * w;
            const y = ((90 - lat) / 180) * h;

            if (i === 0) {
                ctx.moveTo(x, y);
            } else {
                // Avoid drawing long lines across the map (dateline wrap)
                const [prevLng] = boundary[i - 1];
                if (Math.abs(lng - prevLng) > 180) {
                    ctx.moveTo(x, y);
                } else {
                    ctx.lineTo(x, y);
                }
            }
        }
        ctx.stroke();
    }

    calculateCentroid(geometry) {
        let minLng = 180, maxLng = -180, minLat = 90, maxLat = -90;
        
        const coords = geometry.type === 'Polygon' ? geometry.coordinates[0] : geometry.coordinates[0][0];
        if (!coords) return null;
        
        coords.forEach(([lng, lat]) => {
            if (lng < minLng) minLng = lng;
            if (lng > maxLng) maxLng = lng;
            if (lat < minLat) minLat = lat;
            if (lat > maxLat) maxLat = lat;
        });
        
        // Minor tweak: move labels slightly up from raw bounding box center 
        // to avoid colliding with small south-heavy features
        return [(minLat + maxLat) / 2, (minLng + maxLng) / 2];
    }

    toggle(visible) {
        this.group.visible = visible;
    }
}
