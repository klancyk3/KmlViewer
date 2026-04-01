/**
 * KML Canvas Viewer Application
 * with OpenStreetMap Background
 */

// App Logic
const loadingOverlay = document.getElementById('loadingOverlay');
const progressBar = document.getElementById('progressBar');
const dropZone = document.getElementById('dropZone');
const parser = new KMLParser();
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
        if (file.name.toLowerCase().endsWith('.kml')) {
            const reader = new FileReader();
            reader.onload = (e) => {
                const content = e.target.result;
                const features = parser.parse(content);
                console.log(`Parsed ${features.length} features from ${file.name}`);
                renderer.addFeatures(features, true);
            };
            reader.readAsText(file);
        }
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
                            renderer.center = { lon: 18.9251, lat: 50.2094 };
                            renderer.zoom = 10;
                            renderer.requestUpdate();
                            loadingOverlay.classList.add('hidden'); // Hide the loading overlay
                        }, 500);
                    }, 50);
                } catch (e) {
                    console.error('Parse error:', e);
                    updateProgress(100, 'Error parsing KML');
                    setTimeout(() => loadingOverlay.classList.add('hidden'), 1000);
                }
            }, 50);
        } else {
            console.warn('Sample KML not found');
            loadingOverlay.classList.add('hidden');
        }
    };

    xhr.onerror = () => {
        console.error('Network error loading sample');
        loadingOverlay.classList.add('hidden');
    };

    xhr.send();
}

loadSample();
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
