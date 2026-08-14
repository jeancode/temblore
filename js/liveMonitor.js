// ============================================
// liveMonitor.js — Real-Time Country Seismic Monitor
// ============================================
import { getMagnitudeClass } from './earthquakes.js?v=2.3';

export const COUNTRY_FILTERS = {
    'mexico': {
        name: 'México',
        flag: '🇲🇽',
        keywords: [
            'mexico', 'méxico', 'oaxaca', 'chiapas', 'guerrero', 'baja california',
            'michoacan', 'michoacán', 'colima', 'jalisco', 'puebla', 'veracruz',
            'gulf of california', 'golfo de california', 'sinaloa', 'sonora', 'hidalgo'
        ],
        bounds: { minLat: 13.5, maxLat: 33.5, minLng: -119.0, maxLng: -85.5 },
        center: [-100.0, 21.0, 3200000]
    },
    'chile': {
        name: 'Chile',
        flag: '🇨🇱',
        keywords: ['chile', 'antofagasta', 'coquimbo', 'valparaiso', 'santiago', 'tarapaca', 'atacama', 'maule', 'biobio'],
        bounds: { minLat: -56.0, maxLat: -17.5, minLng: -76.0, maxLng: -66.0 },
        center: [-71.0, -33.0, 3200000]
    },
    'peru': {
        name: 'Perú',
        flag: '🇵🇪',
        keywords: ['peru', 'perú', 'lima', 'arequipa', 'ica', 'cusco', 'tacna', 'piura', 'ancash'],
        bounds: { minLat: -18.5, maxLat: -0.0, minLng: -81.5, maxLng: -68.5 },
        center: [-75.0, -9.5, 2800000]
    },
    'colombia': {
        name: 'Colombia',
        flag: '🇨🇴',
        keywords: ['colombia', 'santander', 'antioquia', 'bogota', 'bogotá', 'cali', 'medellin', 'medellín', 'narino', 'nariño', 'choco', 'chocó', 'cundinamarca', 'valle del cauca'],
        bounds: { minLat: -4.5, maxLat: 13.5, minLng: -79.5, maxLng: -66.5 },
        center: [-74.0, 4.5, 2500000]
    },
    'ecuador': {
        name: 'Ecuador',
        flag: '🇪🇨',
        keywords: ['ecuador', 'guayas', 'manabi', 'manabí', 'pichincha', 'quito', 'guayaquil', 'esmeraldas'],
        bounds: { minLat: -5.5, maxLat: 2.0, minLng: -81.5, maxLng: -75.0 },
        center: [-78.5, -1.8, 2000000]
    },
    'guatemala': {
        name: 'Guatemala',
        flag: '🇬🇹',
        keywords: ['guatemala', 'escuintla', 'san marcos', 'quetzaltenango', 'guatemala city'],
        bounds: { minLat: 13.5, maxLat: 18.0, minLng: -92.5, maxLng: -88.0 },
        center: [-90.5, 15.5, 1500000]
    },
    'costa_rica': {
        name: 'Costa Rica',
        flag: '🇨🇷',
        keywords: ['costa rica', 'san jose', 'san josé', 'puntarenas', 'alajuela', 'heredia', 'guanacaste'],
        bounds: { minLat: 8.0, maxLat: 11.5, minLng: -86.0, maxLng: -82.5 },
        center: [-84.0, 10.0, 1200000]
    },
    'el_salvador': {
        name: 'El Salvador',
        flag: '🇸🇻',
        keywords: ['el salvador', 'san salvador', 'usulutan', 'usulután', 'sonsonate', 'la libertad'],
        bounds: { minLat: 13.0, maxLat: 14.5, minLng: -90.2, maxLng: -87.6 },
        center: [-88.9, 13.7, 1000000]
    },
    'argentina': {
        name: 'Argentina',
        flag: '🇦🇷',
        keywords: ['argentina', 'san juan', 'mendoza', 'jujuy', 'salta', 'neuquen', 'neuquén', 'cordoba', 'córdoba'],
        bounds: { minLat: -55.0, maxLat: -21.5, minLng: -74.0, maxLng: -53.0 },
        center: [-65.0, -38.0, 3800000]
    },
    'usa': {
        name: 'Estados Unidos',
        flag: '🇺🇸',
        keywords: ['california', 'alaska', 'hawaii', 'nevada', 'washington', 'oregon', 'texas', 'oklahoma', 'utah', 'idaho', 'montana', 'puerto rico', 'united states', 'usa'],
        bounds: { minLat: 17.5, maxLat: 72.0, minLng: -180.0, maxLng: -65.0 },
        center: [-98.5, 39.5, 5500000]
    },
    'japan': {
        name: 'Japón',
        flag: '🇯🇵',
        keywords: ['japan', 'tokyo', 'honshu', 'hokkaido', 'kyushu', 'shikoku', 'okinawa', 'fukushima', 'miyagi', 'ibaraki'],
        bounds: { minLat: 24.0, maxLat: 46.0, minLng: 122.0, maxLng: 154.0 },
        center: [138.0, 37.0, 3000000]
    },
    'all': {
        name: 'Todo el Mundo',
        flag: '🌐',
        keywords: [],
        bounds: null,
        center: [-90.0, 20.0, 20000000]
    }
};

export function isQuakeInCountry(feature, countryCode) {
    if (!countryCode || countryCode === 'all') return true;
    const config = COUNTRY_FILTERS[countryCode];
    if (!config) return true;

    const place = (feature.properties?.place || '').toLowerCase();
    
    // Check if place explicitly belongs to a known foreign state/region (e.g. US state like ", NV", ", Nevada")
    const isUSAEvent = place.endsWith(', nv') || place.endsWith(', nevada') ||
                       place.endsWith(', ca') || place.endsWith(', california') ||
                       place.endsWith(', ak') || place.endsWith(', alaska') ||
                       place.endsWith(', hawaii') || place.endsWith(', hi') ||
                       place.endsWith(', utah') || place.endsWith(', ut') ||
                       place.endsWith(', washington') || place.endsWith(', wa') ||
                       place.endsWith(', oregon') || place.endsWith(', or') ||
                       place.endsWith(', tx') || place.endsWith(', texas');

    if (countryCode !== 'usa' && isUSAEvent) {
        return false;
    }

    // 1. Strict whole-word boundary matching on place string
    for (const kw of config.keywords) {
        const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`\\b${escaped}\\b`, 'i');
        if (regex.test(place)) {
            return true;
        }
    }

    // 2. Check geographical bounding box coordinates
    if (config.bounds && feature.geometry && feature.geometry.coordinates) {
        const [lng, lat] = feature.geometry.coordinates;
        if (lat >= config.bounds.minLat && lat <= config.bounds.maxLat &&
            lng >= config.bounds.minLng && lng <= config.bounds.maxLng) {
            return true;
        }
    }

    return false;
}

export function playAlertBeep(magnitude = 4.0) {
    try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return;
        const ctx = new AudioCtx();
        if (ctx.state === 'suspended') {
            ctx.resume();
        }

        const now = ctx.currentTime;
        
        // Sonar Ping synthesizer
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(587.33, now); // D5
        osc.frequency.exponentialRampToValueAtTime(880.0, now + 0.12); // A5
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.6);

        if (magnitude >= 4.5) {
            const osc2 = ctx.createOscillator();
            const gain2 = ctx.createGain();
            osc2.type = 'triangle';
            osc2.frequency.setValueAtTime(440.0, now + 0.15);
            osc2.frequency.exponentialRampToValueAtTime(1174.66, now + 0.35);
            gain2.gain.setValueAtTime(0.25, now + 0.15);
            gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.75);
            osc2.connect(gain2);
            gain2.connect(ctx.destination);
            osc2.start(now + 0.15);
            osc2.stop(now + 0.75);
        }
    } catch (e) {
        console.warn('Audio feedback not available:', e);
    }
}

export class LiveMonitorManager {
    constructor(viewer, onFocusQuake, onSelectQuake) {
        this.viewer = viewer;
        this.onFocusQuake = onFocusQuake;
        this.onSelectQuake = onSelectQuake;
        this.currentCountry = 'mexico'; // Default country: México
        this.soundEnabled = true;
        this.autoFocusEnabled = true; // Auto-focus on new live quakes (toggleable in Settings)
        this.lastKnownId = null;
        this.latestQuake = null;
        this.pollIntervalMs = 15000; // 15 seconds
        this.intervalHandle = null;
        this.secondsRemaining = 15;
        this.timerHandle = null;

        this.initDOM();
    }

    initDOM() {
        this.countrySelect = document.getElementById('live-country-select');
        this.countryNameEl = document.getElementById('live-country-name');
        this.quakeCard = document.getElementById('live-quake-card');
        this.quakeMagEl = document.getElementById('live-quake-mag');
        this.quakePlaceEl = document.getElementById('live-quake-place');
        this.quakeTimeEl = document.getElementById('live-quake-time');
        this.quakeDepthEl = document.getElementById('live-quake-depth');
        this.quakeCountEl = document.getElementById('live-country-count');
        this.quakeMaxEl = document.getElementById('live-country-max');
        this.timerTextEl = document.getElementById('live-timer-text');
        this.soundBtn = document.getElementById('btn-sound-toggle');
        this.iconSoundOn = document.getElementById('icon-sound-on');
        this.iconSoundOff = document.getElementById('icon-sound-off');
        this.btnFocus = document.getElementById('btn-focus-live');
        this.alertToast = document.getElementById('live-alert-toast');
        this.toastTitle = document.getElementById('toast-title');
        this.toastDesc = document.getElementById('toast-desc');
        this.panelEl = document.getElementById('live-monitor-panel');
        this.toggleLivePanel = document.getElementById('toggle-live-panel');
        this.toggleAutoFocus = document.getElementById('toggle-autofocus');

        // Toggle Live Monitor Panel visibility
        if (this.toggleLivePanel && this.panelEl) {
            this.toggleLivePanel.checked = !this.panelEl.classList.contains('hidden');
            this.toggleLivePanel.addEventListener('change', (e) => {
                if (e.target.checked) {
                    this.panelEl.classList.remove('hidden');
                } else {
                    this.panelEl.classList.add('hidden');
                }
            });
        }

        // Country change listener
        if (this.countrySelect) {
            this.countrySelect.value = this.currentCountry;
            this.countrySelect.addEventListener('change', (e) => {
                this.setCountry(e.target.value, true);
            });
        }

        // Sound toggle listener
        if (this.soundBtn) {
            this.soundBtn.addEventListener('click', () => {
                this.soundEnabled = !this.soundEnabled;
                this.updateSoundIcon();
            });
        }

        // Auto-focus switch in settings modal
        if (this.toggleAutoFocus) {
            this.toggleAutoFocus.checked = this.autoFocusEnabled;
            this.toggleAutoFocus.addEventListener('change', (e) => {
                this.autoFocusEnabled = e.target.checked;
            });
        }

        // Live Quake Card Click -> Show details & highlight without camera flight
        if (this.quakeCard) {
            this.quakeCard.style.cursor = 'pointer';
            this.quakeCard.addEventListener('click', (e) => {
                if (e.target.closest('#btn-focus-live')) return;
                if (this.latestQuake) {
                    if (this.onSelectQuake) {
                        this.onSelectQuake(this.latestQuake);
                    } else if (this.onFocusQuake) {
                        this.onFocusQuake(this.latestQuake);
                    }
                }
            });
        }

        // Focus button listener -> Move camera to epicenter & highlight
        if (this.btnFocus) {
            this.btnFocus.addEventListener('click', (e) => {
                e.stopPropagation();
                if (this.latestQuake && this.onFocusQuake) {
                    this.onFocusQuake(this.latestQuake);
                }
            });
        }

        // Toast close
        if (this.toastClose) {
            this.toastClose.addEventListener('click', () => {
                this.hideToast();
            });
        }

        // Toast click to focus
        if (this.alertToast) {
            this.alertToast.addEventListener('click', (e) => {
                if (e.target !== this.toastClose && this.latestQuake && this.onFocusQuake) {
                    this.onFocusQuake(this.latestQuake);
                    this.hideToast();
                }
            });
        }

        this.startCountdown();
    }

    updateSoundIcon() {
        if (this.iconSoundOn && this.iconSoundOff) {
            if (this.soundEnabled) {
                this.iconSoundOn.classList.remove('hidden');
                this.iconSoundOff.classList.add('hidden');
                this.soundBtn.title = 'Alerta Sonora: Activada';
                this.soundBtn.classList.remove('muted');
            } else {
                this.iconSoundOn.classList.add('hidden');
                this.iconSoundOff.classList.remove('hidden');
                this.soundBtn.title = 'Alerta Sonora: Silenciada';
                this.soundBtn.classList.add('muted');
            }
        }
    }

    setCountry(countryCode, flyToCountry = false) {
        if (!COUNTRY_FILTERS[countryCode]) return;
        this.currentCountry = countryCode;
        const config = COUNTRY_FILTERS[countryCode];
        
        if (this.countryNameEl) {
            this.countryNameEl.textContent = config.name;
        }

        if (flyToCountry && this.viewer && config.center) {
            const [lng, lat, height] = config.center;
            this.viewer.camera.flyTo({
                destination: Cesium.Cartesian3.fromDegrees(lng, lat, height),
                orientation: {
                    heading: Cesium.Math.toRadians(0),
                    pitch: Cesium.Math.toRadians(-90),
                    roll: 0.0
                },
                duration: 1.8
            });
        }

        // Trigger immediate update check
        this.pollUpdates();
    }

    startCountdown() {
        if (this.timerHandle) clearInterval(this.timerHandle);
        this.secondsRemaining = Math.floor(this.pollIntervalMs / 1000);
        
        this.timerHandle = setInterval(() => {
            this.secondsRemaining--;
            if (this.secondsRemaining <= 0) {
                this.secondsRemaining = Math.floor(this.pollIntervalMs / 1000);
            }
            if (this.timerTextEl) {
                this.timerTextEl.textContent = `🟢 En vivo (${this.secondsRemaining}s)`;
            }
        }, 1000);
    }

    async pollUpdates() {
        try {
            // Fetch the last 24 hours feed from USGS
            const res = await fetch('https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson');
            if (!res.ok) return;
            const data = await res.json();
            const features = data.features || [];

            this.processFeedData(features);
        } catch (e) {
            console.warn('Live monitor polling error:', e);
        }
    }

    processFeedData(features) {
        const countryConfig = COUNTRY_FILTERS[this.currentCountry] || COUNTRY_FILTERS['mexico'];
        
        // Filter quakes for current country
        const countryQuakes = features.filter(f => isQuakeInCountry(f, this.currentCountry));

        // Stats
        const count = countryQuakes.length;
        let maxMag = 0;
        countryQuakes.forEach(q => {
            const m = q.properties.mag || 0;
            if (m > maxMag) maxMag = m;
        });

        if (this.quakeCountEl) this.quakeCountEl.textContent = `${count}`;
        if (this.quakeMaxEl) this.quakeMaxEl.textContent = maxMag > 0 ? `M ${maxMag.toFixed(1)}` : 'M —';

        if (countryQuakes.length > 0) {
            const newest = countryQuakes[0];
            const isBrandNew = this.lastKnownId && this.lastKnownId !== newest.id;
            this.latestQuake = newest;
            this.lastKnownId = newest.id;

            this.updateCardUI(newest);

            if (isBrandNew) {
                this.triggerLiveAlert(newest, countryConfig.name);
            }
        } else {
            this.latestQuake = null;
            if (this.quakeMagEl) {
                this.quakeMagEl.textContent = '—';
                this.quakeMagEl.className = 'live-mag-badge mag-low';
            }
            if (this.quakePlaceEl) this.quakePlaceEl.textContent = `Sin sismos recientes en ${countryConfig.name}`;
            if (this.quakeTimeEl) this.quakeTimeEl.textContent = 'Sin reportes';
            if (this.quakeDepthEl) this.quakeDepthEl.textContent = 'Prof: —';
        }
    }

    updateCardUI(feature) {
        const props = feature.properties;
        const mag = props.mag || 0;
        const [lng, lat, depth] = feature.geometry.coordinates;

        if (this.quakeMagEl) {
            this.quakeMagEl.textContent = `M ${mag.toFixed(1)}`;
            this.quakeMagEl.className = `live-mag-badge ${getMagnitudeClass(mag)}`;
        }

        if (this.quakePlaceEl) {
            this.quakePlaceEl.textContent = props.place || 'Ubicación desconocida';
            this.quakePlaceEl.title = props.place || '';
        }

        if (this.quakeTimeEl) {
            this.quakeTimeEl.textContent = this.formatRelativeTime(props.time);
        }

        if (this.quakeDepthEl) {
            this.quakeDepthEl.textContent = `Prof: ${(depth || 0).toFixed(0)} km`;
        }

        if (this.btnFocus) {
            this.btnFocus.disabled = false;
        }
    }

    triggerLiveAlert(feature, countryName) {
        const props = feature.properties;
        const mag = props.mag || 0;

        // Visual Flash on Card
        if (this.quakeCard) {
            this.quakeCard.classList.remove('live-card-alert');
            void this.quakeCard.offsetWidth; // trigger reflow
            this.quakeCard.classList.add('live-card-alert');
        }

        // Sound alert
        if (this.soundEnabled) {
            playAlertBeep(mag);
        }

        // Toast notification
        this.showToast(
            `🚨 ¡Nuevo sismo en ${countryName}!`,
            `M ${mag.toFixed(1)} — ${props.place || 'Epicentro detectado'}`
        );

        // Auto-focus camera on new quake if enabled in settings
        if (this.autoFocusEnabled && this.onFocusQuake) {
            this.onFocusQuake(feature);
        }
    }

    showToast(title, desc) {
        if (!this.alertToast) return;
        if (this.toastTitle) this.toastTitle.textContent = title;
        if (this.toastDesc) this.toastDesc.textContent = desc;

        this.alertToast.classList.remove('hidden');
        this.alertToast.classList.add('visible');

        if (this.toastTimeout) clearTimeout(this.toastTimeout);
        this.toastTimeout = setTimeout(() => {
            this.hideToast();
        }, 8000);
    }

    hideToast() {
        if (!this.alertToast) return;
        this.alertToast.classList.remove('visible');
        this.alertToast.classList.add('hidden');
    }

    formatRelativeTime(timestamp) {
        const diff = Date.now() - timestamp;
        const mins = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        if (mins < 1) return 'Justo ahora';
        if (mins < 60) return `Hace ${mins} min`;
        if (hours < 24) return `Hace ${hours} h`;
        return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    start() {
        this.pollUpdates();
        if (this.intervalHandle) clearInterval(this.intervalHandle);
        this.intervalHandle = setInterval(() => this.pollUpdates(), this.pollIntervalMs);
    }

    stop() {
        if (this.intervalHandle) clearInterval(this.intervalHandle);
        if (this.timerHandle) clearInterval(this.timerHandle);
    }
}
