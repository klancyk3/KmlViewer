/**
 * KML Canvas Viewer Application
 * with OpenStreetMap Background
 */

// App Logic
const loadingOverlay = document.getElementById('loadingOverlay');
const progressBar = document.getElementById('progressBar');
const dropZone = document.getElementById('dropZone');
const parser = new KMLParser();
const gpxParser = new GPXParser();
const renderer = new MapRenderer('mapCanvas');
const trailLayerController = new TrailLayerController({ renderer, gpxParser });

// Drag & Drop
window.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.remove('hidden');
});

window.addEventListener('dragleave', (e) => {
    if (e.relatedTarget === null) {
        dropZone.classList.add('hidden');
    }
});

window.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.add('hidden');
    const files = e.dataTransfer.files;
    if (files.length > 0) handleFiles(files);
});

dropZone.addEventListener('dragleave', () => {
    dropZone.classList.add('hidden');
});

function handleFiles(files) {
    for (const file of files) {
        const lowerName = file.name.toLowerCase();

        if (lowerName.endsWith('.kml') || lowerName.endsWith('.gpx')) {
            const reader = new FileReader();
            reader.onload = (e) => {
                const content = e.target.result;
                const features = lowerName.endsWith('.gpx')
                    ? gpxParser.parse(content, file.name)
                    : parser.parse(content);
                console.log(`Parsed ${features.length} features from ${file.name}`);
                if (features.length > 0) {
                    renderer.addFeatures(features, true);
                }
            };
            reader.readAsText(file);
        }
    }
}

async function loadSavedGpxFiles() {
    try {
        const response = await fetch('/gpx-files');
        if (!response.ok) return;

        const files = await response.json();
        const allFeatures = [];

        files.forEach(file => {
            const features = gpxParser.parse(file.content, file.filename);
            allFeatures.push(...features);
        });

        if (allFeatures.length > 0) {
            console.log(`Loaded ${allFeatures.length} GPX features from saved files`);
            renderer.addFeatures(allFeatures, false);
        }
    } catch (err) {
        console.debug('Saved GPX files are not available:', err);
        // Saved GPX storage is optional during local development.
    }
}

// Controls
const zoomSlider = document.getElementById('zoomSlider');
const zoomValue = document.getElementById('zoomValue');
const tileZoomSelect = document.getElementById('tileZoomSelect');

function syncZoomControls() {
    if (zoomSlider) zoomSlider.value = String(renderer.zoom);
    if (zoomValue) zoomValue.textContent = renderer.zoom.toFixed(1);
}

renderer.onZoomChanged = syncZoomControls;
syncZoomControls();

document.getElementById('zoomInBtn').addEventListener('click', () => {
    renderer.setZoom(renderer.zoom + 1);
});

document.getElementById('zoomOutBtn').addEventListener('click', () => {
    renderer.setZoom(renderer.zoom - 1);
});

if (zoomSlider) {
    zoomSlider.addEventListener('input', (e) => {
        renderer.setZoom(e.target.value);
    });
}

if (tileZoomSelect) {
    tileZoomSelect.addEventListener('change', (e) => {
        renderer.setSelectedTileZoom(e.target.value);
    });
}

document.getElementById('resetViewBtn').addEventListener('click', () => {
    renderer.fitToData();
});

// Path Calculation Logic
let pathPoints = [];
let pathSelectionMode = false;
const calcPathBtn = document.getElementById('calcPathBtn');

renderer.onClick = (geo) => {
    if (renderer.selectedTileZoom !== null) {
        renderer.setSelectedTileFromGeo(geo);
    }

    if (!pathSelectionMode) return;

    if (pathPoints.length >= 2) {
        pathPoints = [];
        renderer.features = renderer.features.filter(f => f.type !== 'user_path_element');
        renderer.requestUpdate();
        document.getElementById('pathDistance').textContent = '-';
    }

    pathPoints.push(geo);

    const ptFeature = {
        name: 'Path Point',
        type: 'user_path_element',
        geometries: [{
            type: 'Point',
            coordinates: geo
        }]
    };
    renderer.addFeatures([ptFeature], false);
};

calcPathBtn.addEventListener('click', () => {
    if (!pathSelectionMode) {
        pathSelectionMode = true;
        calcPathBtn.classList.add('active');
        pathPoints = [];
        renderer.features = renderer.features.filter(f => f.type !== 'user_path_element');
        renderer.requestUpdate();
        document.getElementById('pathDistance').textContent = 'Kliknij 2 punkty';
        return;
    }

    if (pathPoints.length < 2) {
        alert("Please click two points on the map first.");
        return;
    }

    const straightDistanceKm = GeoUtils.distanceBetweenKm(pathPoints[0], pathPoints[1]);
    document.getElementById('pathDistance').textContent = `${straightDistanceKm.toFixed(2)} km (Straight)`;

    const lineFeature = {
        name: 'User Path Line Straight',
        type: 'user_path_element',
        geometries: [{
            type: 'LineString',
            coordinates: [pathPoints[0], pathPoints[1]]
        }],
        style: {
            strokeColor: '#ef4444',
            strokeWidth: 4
        }
    };
    renderer.addFeatures([lineFeature], false);

    pathSelectionMode = false;
    calcPathBtn.classList.remove('active');
});

// Layers Handlers
const layersPanel = document.getElementById('layersPanel');
document.getElementById('layersBtn').addEventListener('click', () => {
    layersPanel.classList.toggle('hidden');
    document.getElementById('layersBtn').classList.toggle('active');
});

document.querySelectorAll('.menu-group-toggle').forEach(toggle => {
    toggle.addEventListener('click', () => {
        const group = toggle.closest('.menu-group');
        const icon = toggle.querySelector('.menu-group-icon');
        if (!group || !icon) return;

        group.classList.toggle('collapsed');
        icon.textContent = group.classList.contains('collapsed') ? '+' : '−';
    });
});

[
    ['layerSquadrats', 'squadrats'],
    ['layerSquadrathinos', 'squadrathinos'],
    ['layerTile17', 'tile17'],
    ['layerUbersquadrat', 'ubersquadrat'],
    ['layerUbersquadratinho', 'ubersquadratinho']
].forEach(([id, layerKey]) => {
    const el = document.getElementById(id);
    if (el) {
        el.addEventListener('change', (e) => {
            renderer.layers[layerKey] = e.target.checked;
            if (layerKey === 'tile17') {
                refreshTile17Layer(true);
            }
            renderer.requestUpdate();
        });
    }
});

let lastTile17BoundsKey = null;
let tile17RequestId = 0;

async function refreshTile17Layer(force = false) {
    if (!renderer.layers.tile17) {
        renderer.setTile17Records([]);
        lastTile17BoundsKey = null;
        return;
    }

    const bounds = renderer.getViewportBounds();
    const boundsKey = [
        bounds.minLon.toFixed(4),
        bounds.minLat.toFixed(4),
        bounds.maxLon.toFixed(4),
        bounds.maxLat.toFixed(4)
    ].join('|');

    if (!force && boundsKey === lastTile17BoundsKey) {
        return;
    }

    lastTile17BoundsKey = boundsKey;
    const requestId = ++tile17RequestId;

    try {
        const params = new URLSearchParams({
            minLon: String(bounds.minLon),
            minLat: String(bounds.minLat),
            maxLon: String(bounds.maxLon),
            maxLat: String(bounds.maxLat)
        });
        const response = await fetch(`/tile17?${params.toString()}`);
        if (!response.ok) {
            throw new Error(`Tile17 request failed with status ${response.status}`);
        }

        const payload = await response.json();
        if (requestId !== tile17RequestId) {
            return;
        }

        renderer.setTile17Records(payload.records || []);
    } catch (err) {
        console.error('Failed to load Tile17 records:', err);
        if (requestId === tile17RequestId) {
            renderer.setTile17Records([]);
        }
    }
}

renderer.onViewportChanged = () => {
    refreshTile17Layer();
};

// Location Tracking Logic
let trackingWatchId = null;
let currentTrackPoints = [];
const trackCheckbox = document.getElementById('trackLocation');
const trackBtn = document.getElementById('trackBtn');

if (trackCheckbox) {
    trackCheckbox.addEventListener('change', (e) => {
        const active = e.target.checked;
        if (trackBtn) trackBtn.classList.toggle('active', active);
        if (active) {
            startTracking();
        } else {
            stopTracking();
        }
    });

    if (trackBtn) {
        trackBtn.addEventListener('click', () => {
            trackCheckbox.click(); // Trigger the same logic
        });
    }
}

function startTracking() {
    if (!navigator.geolocation) {
        alert("Geolocation is not supported by your browser.");
        trackCheckbox.checked = false;
        return;
    }

    currentTrackPoints = [];
    console.log("Starting location tracking...");

    trackingWatchId = navigator.geolocation.watchPosition(
        (position) => {
            const { latitude, longitude, altitude, speed } = position.coords;
            const time = new Date(position.timestamp).toISOString();

            const pt = { lat: latitude, lon: longitude, alt: altitude, time };
            currentTrackPoints.push(pt);

            // Add point to map for visualization
            const traceFeature = {
                name: 'Live Trace',
                type: 'user_track_element',
                geometries: [{
                    type: 'Point',
                    coordinates: { lat: latitude, lon: longitude }
                }],
                style: {
                    fillColor: '#3b82f6',
                    radius: 4
                }
            };
            renderer.addFeatures([traceFeature], false);

            // Optimization: Only redraw if enough distance moved or every few points
            renderer.requestUpdate();
        },
        (error) => {
            console.error("Tracking error:", error);
            alert(`Error tracking location: ${error.message}`);
            if (trackCheckbox) trackCheckbox.checked = false;
            if (trackBtn) trackBtn.classList.remove('active');
            stopTracking();
        },
        {
            enableHighAccuracy: true,
            maximumAge: 1000,
            timeout: 5000
        }
    );
}

function stopTracking() {
    if (trackingWatchId !== null) {
        navigator.geolocation.clearWatch(trackingWatchId);
        trackingWatchId = null;
        console.log("Stopped location tracking.");

        if (currentTrackPoints.length > 0) {
            saveGpx(currentTrackPoints);
        }
        
        // Ensure UI is in sync
        if (trackCheckbox) trackCheckbox.checked = false;
        if (trackBtn) trackBtn.classList.remove('active');

        // Cleanup live trace points from map
        renderer.features = renderer.features.filter(f => f.type !== 'user_track_element');
        renderer.requestUpdate();
    }
}

function generateGpx(points) {
    const time = new Date().toISOString();
    let xml = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="KML Canvas Viewer" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <time>${time}</time>
  </metadata>
  <trk>
    <name>Track ${new Date().toLocaleString()}</name>
    <trkseg>
`;

    points.forEach(p => {
        xml += `      <trkpt lat="${p.lat}" lon="${p.lon}">
        ${p.alt ? `<ele>${p.alt}</ele>` : ''}
        <time>${p.time}</time>
      </trkpt>\n`;
    });

    xml += `    </trkseg>
  </trk>
</gpx>`;
    return xml;
}

async function saveGpx(points) {
    const gpxContent = generateGpx(points);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `track-${timestamp}.gpx`;

    try {
        const response = await fetch('/save-gpx', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filename, content: gpxContent })
        });

        if (response.ok) {
            console.log("GPX saved successfully to folder gpxes");
            // Optional visual feedback
            alert(`Track saved: ${filename}`);
        } else {
            console.error("Failed to save GPX server-side, trying locally...");
            downloadLocally(filename, gpxContent);
        }
    } catch (err) {
        console.error("Error saving to server, trying locally:", err);
        downloadLocally(filename, gpxContent);
    }
}

function downloadLocally(filename, content) {
    const blob = new Blob([content], { type: 'application/gpx+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    alert(`Server unavailable. Downloaded locally: ${filename}\nPlease move it to 'gpxes' folder manually if needed.`);
}

// Info Panel Minimize Toggle
const infoPanel = document.getElementById('infoPanel');
const minimizeInfoBtn = document.getElementById('minimizeInfoBtn');
if (infoPanel && minimizeInfoBtn) {
    minimizeInfoBtn.addEventListener('click', () => {
        infoPanel.classList.toggle('minimized');
        minimizeInfoBtn.textContent = infoPanel.classList.contains('minimized') ? '+' : '−';
    });
}

function updateProgress(percent, text) {
    if (progressBar) progressBar.style.width = percent + '%';
    const textEl = document.querySelector('.loading-text');
    if (textEl && text) textEl.textContent = text;
}

// Load sample logic
function loadSample() {
    // Map Source Switcher
document.getElementById('mapSource').addEventListener('change', (e) => {
    renderer.setMapSource(e.target.value);
});

updateProgress(0, 'Initializing...');

    const xhr = new XMLHttpRequest();
    xhr.open('GET', 'sample.kml');

    xhr.onprogress = (event) => {
        if (event.lengthComputable) {
            // Download phase: 0% to 50%
            const percent = (event.loaded / event.total) * 50;
            updateProgress(Math.round(percent), `Downloading ${(event.loaded / 1024).toFixed(0)}KB...`);
        } else {
            updateProgress(30, 'Downloading...');
        }
    };

    xhr.onload = () => {
        if (xhr.status === 200) {
            updateProgress(50, 'Parsing structure...');

            // Allow UI to update before heavy parsing
            setTimeout(() => {
                try {
                    const content = xhr.responseText;
                    const features = parser.parse(content);

                    updateProgress(75, `Processing ${features.length} features...`);

                    // Allow UI to update before rendering
                    setTimeout(() => {
                        renderer.addFeatures(features, false); // false prevents map from recentering to features
                        updateProgress(100, 'Ready');

                        setTimeout(() => {
                            renderer.center = { lon: 19.1451, lat: 51.9194 };
                            renderer.setZoom(6);
                            renderer.requestUpdate();
                            loadingOverlay.classList.add('hidden'); // Hide the loading overlay
                            loadSavedGpxFiles();
                        }, 500);
                    }, 50);
                } catch (e) {
                    console.error('Parse error:', e);
                    updateProgress(100, 'Error parsing KML');
                    setTimeout(() => {
                        loadingOverlay.classList.add('hidden');
                        loadSavedGpxFiles();
                    }, 1000);
                }
            }, 50);
        } else {
            console.warn('Sample KML not found');
            loadingOverlay.classList.add('hidden');
            loadSavedGpxFiles();
        }
    };

    xhr.onerror = () => {
        console.error('Network error loading sample');
        loadingOverlay.classList.add('hidden');
        loadSavedGpxFiles();
    };

    xhr.send();
}

loadSample();
trailLayerController.initialize();
// Initialize empty map centered on Poland

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
            .then(registration => {
                console.log('ServiceWorker registration successful with scope: ', registration.scope);
            })
            .catch(err => {
                console.log('ServiceWorker registration failed: ', err);
            });
    });
}
