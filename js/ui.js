// ============================================
// ui.js — Panel Lateral, Filtros, Estadísticas
// ============================================
import { getMagnitudeClass } from './earthquakes.js';

// --- DOM References ---
const $ = (id) => document.getElementById(id);

let elements = {};

function initElements() {
    elements = {
        loadingOverlay: $('loading-overlay'),
        loadingStatus: $('loading-status'),
        statTotal: $('stat-total'),
        statMaxMag: $('stat-max-mag'),
        statAvgMag: $('stat-avg-mag'),
        filterMagMin: $('filter-mag-min'),
        filterMagMax: $('filter-mag-max'),
        filterPeriod: $('filter-period'),
        filterLight: $('filter-light'),
        magValDisplay: $('mag-val-display'),
        toggleBorders: $('toggle-borders'),
        toggleRealtime: $('toggle-realtime'),
        toggleLabels: $('toggle-labels'),
        toggleRoads: $('toggle-roads'),
        btnRefresh: $('btn-refresh'),
        btnSettings: $('btn-settings'),
        btnSettingsClose: $('btn-settings-close'),
        settingsModal: $('settings-modal'),
        sidebar: $('sidebar'),
        sidebarClose: $('sidebar-close'),
        detailMag: $('detail-magnitude'),
        detailMagType: $('detail-mag-type'),
        detailPlace: $('detail-place'),
        detailCoords: $('detail-coords'),
        detailDepth: $('detail-depth'),
        detailTime: $('detail-time'),
        detailFelt: $('detail-felt'),
        detailLink: $('detail-link'),
        quakeList: $('quake-list'),
        quakeListCount: $('quake-list-count'),
        tooltip: $('tooltip'),
    };
}

// --- Setup UI ---
export function setupUI(onFilterChange, onRefresh, onLightChange, onToggleBorders, onRealTimeToggle, onToggleLabels, onToggleRoads) {
    initElements();

    // Setup filter listeners
    const triggerFilter = () => {
        let min = parseFloat(elements.filterMagMin.value);
        let max = parseFloat(elements.filterMagMax.value);
        
        // Ensure min doesn't exceed max
        if (min > max) {
            min = max;
            elements.filterMagMin.value = min;
        }

        elements.magValDisplay.textContent = `${min.toFixed(1)} - ${max.toFixed(1)}`;
        onFilterChange(min, max, elements.filterPeriod.value);
    };

    elements.filterMagMin.addEventListener('change', triggerFilter);
    elements.filterMagMax.addEventListener('change', triggerFilter);
    elements.filterPeriod.addEventListener('change', triggerFilter);

    // Settings Modal
    if (elements.btnSettings) {
        elements.btnSettings.addEventListener('click', (e) => {
            e.stopPropagation();
            elements.settingsModal.classList.toggle('hidden');
        });
    }
    if (elements.btnSettingsClose) {
        elements.btnSettingsClose.addEventListener('click', () => {
            elements.settingsModal.classList.add('hidden');
        });
    }

    // Light Mode Select
    if (elements.filterLight) {
        elements.filterLight.addEventListener('change', (e) => {
            if (onLightChange) onLightChange(parseInt(e.target.value));
        });
    }

    // Toggle Borders
    if (elements.toggleBorders) {
        elements.toggleBorders.addEventListener('change', (e) => {
            if (setupUI.onToggleBorders === true) return; // ignore fake initial trigger if any
            if (onToggleBorders) onToggleBorders(e.target.checked);
        });
    }
    
    // Toggle Realtime
    if (elements.toggleRealtime) {
        elements.toggleRealtime.addEventListener('change', (e) => {
            if (onRealTimeToggle) onRealTimeToggle(e.target.checked);
        });
    }

    // Toggle Labels
    if (elements.toggleLabels) {
        elements.toggleLabels.addEventListener('change', (e) => {
            if (onToggleLabels) onToggleLabels(e.target.checked);
        });
    }

    // Toggle Roads & States
    if (elements.toggleRoads) {
        elements.toggleRoads.addEventListener('change', (e) => {
            if (onToggleRoads) onToggleRoads(e.target.checked);
        });
    }

    // Refresh button
    elements.btnRefresh.addEventListener('click', () => {
        elements.btnRefresh.classList.add('spinning');
        setTimeout(() => elements.btnRefresh.classList.remove('spinning'), 1000);
        if (onRefresh) onRefresh();
    });

    // Sidebar close
    elements.sidebarClose.addEventListener('click', () => {
        hideQuakeInfo();
    });

    // Sun slider
    if (elements.sunSlider) {
        elements.sunSlider.addEventListener('input', (e) => {
            if (onSunChange) onSunChange(parseFloat(e.target.value));
        });
    }
}

// --- Loading ---
export function showLoading(message) {
    if (elements.loadingOverlay) {
        elements.loadingOverlay.classList.remove('fade-out');
    }
    if (elements.loadingStatus && message) {
        elements.loadingStatus.textContent = message;
    }
}

export function hideLoading() {
    if (elements.loadingOverlay) {
        elements.loadingOverlay.classList.add('fade-out');
    }
}

// --- Stats ---
export function updateStats(quakes) {
    if (!quakes || quakes.length === 0) {
        elements.statTotal.textContent = '0';
        elements.statMaxMag.textContent = '—';
        elements.statAvgMag.textContent = '—';
        return;
    }

    const mags = quakes.map(q => q.properties.mag || 0);
    const total = quakes.length;
    const maxMag = Math.max(...mags);
    const avgMag = mags.reduce((a, b) => a + b, 0) / total;

    // Animate numbers
    animateValue(elements.statTotal, total);
    elements.statMaxMag.textContent = maxMag.toFixed(1);
    elements.statAvgMag.textContent = avgMag.toFixed(1);

    // Color-code max magnitude
    const magColor = getMagnitudeColorCSS(maxMag);
    elements.statMaxMag.style.color = magColor;
}

function animateValue(el, target) {
    const current = parseInt(el.textContent) || 0;
    if (current === target) return;

    const duration = 600;
    const start = performance.now();
    const diff = target - current;

    function step(time) {
        const progress = Math.min((time - start) / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
        el.textContent = Math.round(current + diff * eased);
        if (progress < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
}

// --- Earthquake Info Sidebar ---
export function showQuakeInfo(feature) {
    const props = feature.properties;
    const [lng, lat, depth] = feature.geometry.coordinates;
    const mag = props.mag || 0;

    elements.detailMag.textContent = mag.toFixed(1);
    elements.detailMagType.textContent = props.magType || 'M';
    elements.detailPlace.textContent = props.place || 'Ubicación desconocida';
    elements.detailCoords.textContent = `${lat.toFixed(3)}°, ${lng.toFixed(3)}°`;
    elements.detailDepth.textContent = `${(depth || 0).toFixed(1)} km`;
    elements.detailFelt.textContent = props.felt ? `${props.felt} reportes` : 'Sin reportes';

    // Format date
    const date = new Date(props.time);
    elements.detailTime.textContent = date.toLocaleString('es-MX', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
    });

    // USGS link
    elements.detailLink.href = props.url || '#';

    // Color the magnitude display
    const color = getMagnitudeColorCSS(mag);
    elements.detailMag.style.color = color;

    // Show sidebar
    elements.sidebar.classList.remove('hidden');
}

export function hideQuakeInfo() {
    elements.sidebar.classList.add('hidden');
}

// --- Earthquake List ---
export function updateQuakeList(quakes, onItemClick) {
    const list = elements.quakeList;
    const count = elements.quakeListCount;

    list.innerHTML = '';
    count.textContent = `${quakes.length} encontrados`;

    // Show max 50 in the list
    const displayQuakes = quakes.slice(0, 50);

    displayQuakes.forEach((feature, idx) => {
        const props = feature.properties;
        const mag = props.mag || 0;
        const magClass = getMagnitudeClass(mag);

        const item = document.createElement('div');
        item.className = 'quake-item';
        item.setAttribute('data-index', idx);

        const timeAgo = getTimeAgo(props.time);

        item.innerHTML = `
            <div class="quake-item-mag ${magClass}">${mag.toFixed(1)}</div>
            <div class="quake-item-info">
                <div class="quake-item-place">${props.place || 'Desconocido'}</div>
                <div class="quake-item-time">${timeAgo}</div>
            </div>
        `;

        item.addEventListener('click', () => {
            // Remove active class from all
            list.querySelectorAll('.quake-item').forEach(el => el.classList.remove('active'));
            item.classList.add('active');
            if (onItemClick) onItemClick(feature);
        });

        list.appendChild(item);
    });
}

// --- Tooltip ---
export function showTooltip(x, y, text) {
    const tt = elements.tooltip;
    tt.textContent = text;
    tt.classList.remove('hidden');

    // Position near cursor but avoid edge overflow
    const pad = 15;
    const ttRect = tt.getBoundingClientRect();
    let left = x + pad;
    let top = y - 10;

    if (left + ttRect.width > window.innerWidth - 10) {
        left = x - ttRect.width - pad;
    }
    if (top < 10) top = 10;

    tt.style.left = `${left}px`;
    tt.style.top = `${top}px`;
}

export function hideTooltip() {
    elements.tooltip.classList.add('hidden');
}

// --- Helpers ---
function getMagnitudeColorCSS(mag) {
    if (mag < 2.5) return '#22c55e'; // mag-green
    if (mag < 4.0) return '#eab308'; // mag-yellow
    if (mag < 5.5) return '#f97316'; // mag-orange
    if (mag < 7.0) return '#ef4444'; // mag-red
    return '#a855f7';                // mag-purple
}

function getTimeAgo(timestamp) {
    const diff = Date.now() - timestamp;
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (mins < 1) return 'Justo ahora';
    if (mins < 60) return `Hace ${mins} min`;
    if (hours < 24) return `Hace ${hours}h`;
    if (days < 7) return `Hace ${days} d`;
    return new Date(timestamp).toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit' });
}
