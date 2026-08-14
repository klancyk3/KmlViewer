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
    }
}

let trailLoadAbortController = null;

function removeTrailFeatures() {
    renderer.features = renderer.features.filter(feature => feature.type !== 'trail_gpx');
    renderer.updateStats();
    renderer.requestUpdate();
}

function setTrailDistance(kilometers) {
    const distanceEl = document.getElementById('trailDistance');
    if (distanceEl) distanceEl.textContent = `${kilometers.toFixed(1)} km`;
}

function calculateLineDistanceKm(coordinates) {
    let total = 0;

    for (let i = 1; i < coordinates.length; i++) {
        total += distanceBetweenKm(coordinates[i - 1], coordinates[i]);
    }

    return total;
}

function distanceBetweenKm(p1, p2) {
    const earthRadiusKm = 6371.0088;
    const toRad = degrees => degrees * Math.PI / 180;
    const dLat = toRad(p2.lat - p1.lat);
    const dLon = toRad(p2.lon - p1.lon);
    const lat1 = toRad(p1.lat);
    const lat2 = toRad(p2.lat);
    const a = Math.sin(dLat / 2) ** 2
        + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;

    return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function getSelectedTrailTypes() {
    const types = [];
    const footEl = document.getElementById('trailTypeFoot');
    const hikingEl = document.getElementById('trailTypeHiking');

    if (footEl && footEl.checked) types.push('foot');
    if (hikingEl && hikingEl.checked) types.push('hiking');

    return types;
}

function getSelectedTrailRegions() {
    const select = document.getElementById('trailRegionSelect');
    if (!select) return [];

    return Array.from(select.selectedOptions).map(option => option.value);
}

function setTrailStatus(text) {
    const statusEl = document.getElementById('trailLayerStatus');
    if (statusEl) statusEl.textContent = text;
}

function setTrailRegionPlaceholder(text) {
    const regionSelect = document.getElementById('trailRegionSelect');
    if (!regionSelect) return;

    regionSelect.innerHTML = '';

    const option = document.createElement('option');
    option.textContent = text;
    option.disabled = true;
    regionSelect.appendChild(option);
}

async function initializeTrailLayer() {
    const enabledEl = document.getElementById('trailsLayerEnabled');
    const regionSelect = document.getElementById('trailRegionSelect');
    const footEl = document.getElementById('trailTypeFoot');
    const hikingEl = document.getElementById('trailTypeHiking');

    if (!enabledEl || !regionSelect || !footEl || !hikingEl) return;

    try {
        const response = await fetch('/trail-regions');
        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const regions = await response.json();
        regionSelect.innerHTML = '';

        if (regions.length === 0) {
            setTrailRegionPlaceholder('Brak województw');
            setTrailStatus('Brak katalogu D:\\Maps\\Gpx');
            return;
        }

        regions.forEach((region, index) => {
            const option = document.createElement('option');
            option.value = region.key;
            option.textContent = region.name;
            option.selected = true;
            regionSelect.appendChild(option);
        });

        setTrailStatus('Ładowanie szlaków...');
    } catch (err) {
        console.error('Could not load trail regions:', err);
        setTrailRegionPlaceholder('Zrestartuj serwer KmlViewer');
        setTrailStatus('Endpoint /trail-regions niedostępny');
    }

    [enabledEl, regionSelect, footEl, hikingEl].forEach(el => {
        el.addEventListener('change', updateTrailLayer);
    });

    if (enabledEl.checked) {
        updateTrailLayer();
    }
}

async function updateTrailLayer() {
    const enabledEl = document.getElementById('trailsLayerEnabled');
    if (!enabledEl || !enabledEl.checked) {
        if (trailLoadAbortController) {
            trailLoadAbortController.abort();
            trailLoadAbortController = null;
        }
        removeTrailFeatures();
        setTrailDistance(0);
        setTrailStatus('Szlaki wyłączone');
        return;
    }

    const regions = getSelectedTrailRegions();
    const types = getSelectedTrailTypes();

    removeTrailFeatures();

    if (regions.length === 0) {
        setTrailDistance(0);
        setTrailStatus('Wybierz przynajmniej jedno województwo');
        return;
    }

    if (types.length === 0) {
        setTrailDistance(0);
        setTrailStatus('Wybierz foot lub hiking');
        return;
    }

    if (trailLoadAbortController) {
        trailLoadAbortController.abort();
    }

    trailLoadAbortController = new AbortController();
    setTrailStatus('Ładowanie szlaków...');

    try {
        const params = new URLSearchParams({
            regions: regions.join(','),
            types: types.join(',')
        });
        const response = await fetch(`/trail-gpx?${params}`, {
            signal: trailLoadAbortController.signal
        });

        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const files = await response.json();
        const features = [];
        let totalTrailKm = 0;

        files.forEach(file => {
            const parsed = gpxParser.parse(file.content, file.filename);
            parsed.forEach(feature => {
                feature.type = 'trail_gpx';
                feature.name = `${file.regionName} ${file.trailType}: ${feature.name}`;
                feature.trailRegion = file.region;
                feature.trailType = file.trailType;
                const style = feature.style || {};
                feature.style = {
                    ...style,
                    strokeColor: style.strokeColor || (file.trailType === 'hiking' ? '#22c55e' : '#f97316'),
                    strokeWidth: file.trailType === 'hiking' ? 3 : 2,
                    fillColor: style.fillColor || style.strokeColor || (file.trailType === 'hiking' ? '#22c55e' : '#f97316'),
                    radius: 3
                };

                feature.geometries.forEach(geometry => {
                    if (geometry.type === 'LineString' && geometry.coordinates) {
                        totalTrailKm += calculateLineDistanceKm(geometry.coordinates);
                    }
                });
            });
            features.push(...parsed);
        });

        if (features.length > 0) {
            renderer.addFeatures(features, false);
        } else {
            renderer.updateStats();
        }

        setTrailDistance(totalTrailKm);
        setTrailStatus(`Załadowano ${features.length} obiektów z ${files.length} plików`);
    } catch (err) {
        if (err.name === 'AbortError') return;

        console.error('Could not load trail GPX files:', err);
        setTrailStatus('Nie udało się załadować szlaków');
    } finally {
        trailLoadAbortController = null;
    }
}

// Controls
document.getElementById('zoomInBtn').addEventListener('click', () => {
    renderer.zoom = Math.min(renderer.zoom + 1, 22);
    renderer.requestUpdate();
});

document.getElementById('zoomOutBtn').addEventListener('click', () => {
    renderer.zoom = Math.max(renderer.zoom - 1, 1);
    renderer.requestUpdate();
});

document.getElementById('resetViewBtn').addEventListener('click', () => {
    renderer.fitToData();
});

// Path Calculation Logic
let pathPoints = [];

renderer.onClick = (geo) => {
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

document.getElementById('calcPathBtn').addEventListener('click', () => {
    if (pathPoints.length < 2) {
        alert("Please click two points on the map first.");
        return;
    }

    if (!window.google || !window.google.maps || !window.google.maps.DirectionsService) {
        alert("Google Maps API is not loaded.");
        return;
    }

    const p1 = new google.maps.LatLng(pathPoints[0].lat, pathPoints[0].lon);
    const p2 = new google.maps.LatLng(pathPoints[1].lat, pathPoints[1].lon);

    const ds = new google.maps.DirectionsService();
    ds.route({
        origin: p1,
        destination: p2,
        travelMode: google.maps.TravelMode.DRIVING
    }, (response, status) => {
        if (status === 'OK') {
            const leg = response.routes[0].legs[0];
            document.getElementById('pathDistance').textContent = leg.distance.text;

            const path = response.routes[0].overview_path;
            const lineFeature = {
                name: 'User Path Line',
                type: 'user_path_element',
                geometries: [{
                    type: 'LineString',
                    coordinates: path.map(ll => ({ lat: ll.lat(), lon: ll.lng() }))
                }],
                style: {
                    strokeColor: '#f59e0b',
                    strokeWidth: 4
                }
            };
            renderer.addFeatures([lineFeature], false);
        } else {
            const distMeters = google.maps.geometry.spherical.computeDistanceBetween(p1, p2);
            document.getElementById('pathDistance').textContent = (distMeters / 1000).toFixed(2) + ' km (Straight)';

            const lineFeature = {
                name: 'User Path Line Straight',
                type: 'user_path_element',
                geometries: [{
                    type: 'LineString',
                    coordinates: [ pathPoints[0], pathPoints[1] ]
                }],
                style: {
                    strokeColor: '#ef4444',
                    strokeWidth: 4
                }
            };
            renderer.addFeatures([lineFeature], false);
        }
    });
});

// Layers Handlers
const layersPanel = document.getElementById('layersPanel');
document.getElementById('layersBtn').addEventListener('click', () => {
    layersPanel.classList.toggle('hidden');
    document.getElementById('layersBtn').classList.toggle('active');
});

['Squadrats', 'Squadrathinos', 'Ubersquadrat', 'Ubersquadratinho'].forEach(key => {
    const id = 'layer' + key;
    const el = document.getElementById(id);
    if (el) {
        el.addEventListener('change', (e) => {
            renderer.layers[key.toLowerCase()] = e.target.checked;
            renderer.requestUpdate();
        });
    }
});

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
                            renderer.zoom = 6;
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
initializeTrailLayer();
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
