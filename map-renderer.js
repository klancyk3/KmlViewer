class TileSystem {
    constructor() {
        this.cache = new Map();
        this.tileSize = 256;
        this.urlTemplate = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
        this.apiKey = '';
    }

    setTemplate(template, apiKey = '') {
        if (this.urlTemplate !== template || this.apiKey !== apiKey) {
            this.urlTemplate = template;
            this.apiKey = apiKey;
            this.cache.clear();
        }
    }

    getTile(x, y, z) {
        let url = this.urlTemplate
            .replace('{z}', z)
            .replace('{x}', x)
            .replace('{y}', y);
        
        if (this.apiKey) url += (url.includes('?') ? '&' : '?') + `apikey=${this.apiKey}`;

        if (this.cache.has(url)) {
            return this.cache.get(url);
        }

        const img = new Image();
        img.crossOrigin = "Anonymous";
        img.src = url;

        const entry = {
            image: img,
            loaded: false
        };

        img.onload = () => {
            entry.loaded = true;
        };

        this.cache.set(url, entry);
        return entry;
    }

    // Web Mercator helpers (already in TileSystem, but useful to expose)
    lon2tile(lon, zoom) { return (lon + 180) / 360 * Math.pow(2, zoom); }
    lat2tile(lat, zoom) { return (1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * Math.pow(2, zoom); }
    tile2lon(x, z) { return (x / Math.pow(2, z) * 360 - 180); }
    tile2lat(y, z) {
        const n = Math.PI - 2 * Math.PI * y / Math.pow(2, z);
        return (180 / Math.PI * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n))));
    }
}

class YardCalculator {
    constructor() {
        this.tileSystem = new TileSystem();
    }

    // Rasterize features to a Set of "x,y" tile coordinates at given zoom
    getVisitedTiles(features, zoom) {
        const visited = new Set();

        // Helper to add tile
        const add = (lon, lat) => {
            const x = Math.floor(this.tileSystem.lon2tile(lon, zoom));
            const y = Math.floor(this.tileSystem.lat2tile(lat, zoom));
            visited.add(`${x},${y}`);
        };

        features.forEach(feature => {
            feature.geometries.forEach(geom => {
                if (geom.type === 'Point') {
                    add(geom.coordinates.lon, geom.coordinates.lat);
                } else if (geom.type === 'LineString') {
                    const coords = geom.coordinates;
                    if (coords.length < 2) return;

                    for (let i = 0; i < coords.length - 1; i++) {
                        const p1 = coords[i];
                        const p2 = coords[i + 1];

                        // Simple interpolation
                        // Calculate distance in tiles
                        const x1 = this.tileSystem.lon2tile(p1.lon, zoom);
                        const y1 = this.tileSystem.lat2tile(p1.lat, zoom);
                        const x2 = this.tileSystem.lon2tile(p2.lon, zoom);
                        const y2 = this.tileSystem.lat2tile(p2.lat, zoom);

                        const dist = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
                        const steps = Math.ceil(dist * 2); // 2 steps per tile approx

                        for (let s = 0; s <= steps; s++) {
                            const t = steps === 0 ? 0 : s / steps;
                            const lon = p1.lon + (p2.lon - p1.lon) * t;
                            const lat = p1.lat + (p2.lat - p1.lat) * t;
                            add(lon, lat);
                        }
                    }
                } else if (geom.type === 'Polygon') {
                    // Process outer rings
                    if (geom.outerRings) {
                        geom.outerRings.forEach(ring => {
                            if (ring.length < 2) return;

                            for (let i = 0; i < ring.length - 1; i++) {
                                const p1 = ring[i];
                                const p2 = ring[i + 1];

                                const x1 = this.tileSystem.lon2tile(p1.lon, zoom);
                                const y1 = this.tileSystem.lat2tile(p1.lat, zoom);
                                const x2 = this.tileSystem.lon2tile(p2.lon, zoom);
                                const y2 = this.tileSystem.lat2tile(p2.lat, zoom);

                                const dist = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
                                const steps = Math.ceil(dist * 2);

                                for (let s = 0; s <= steps; s++) {
                                    const t = steps === 0 ? 0 : s / steps;
                                    const lon = p1.lon + (p2.lon - p1.lon) * t;
                                    const lat = p1.lat + (p2.lat - p1.lat) * t;
                                    add(lon, lat);
                                }
                            }
                        });
                    }

                    // Process inner rings
                    if (geom.innerRings) {
                        geom.innerRings.forEach(ring => {
                            if (ring.length < 2) return;

                            for (let i = 0; i < ring.length - 1; i++) {
                                const p1 = ring[i];
                                const p2 = ring[i + 1];

                                const x1 = this.tileSystem.lon2tile(p1.lon, zoom);
                                const y1 = this.tileSystem.lat2tile(p1.lat, zoom);
                                const x2 = this.tileSystem.lon2tile(p2.lon, zoom);
                                const y2 = this.tileSystem.lat2tile(p2.lat, zoom);

                                const dist = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
                                const steps = Math.ceil(dist * 2);

                                for (let s = 0; s <= steps; s++) {
                                    const t = steps === 0 ? 0 : s / steps;
                                    const lon = p1.lon + (p2.lon - p1.lon) * t;
                                    const lat = p1.lat + (p2.lat - p1.lat) * t;
                                    add(lon, lat);
                                }
                            }
                        });
                    }
                }
            });
        });

        return visited;
    }


}

class MapRenderer {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.features = [];
        this.tileSystem = new TileSystem();
        this.yardCalc = new YardCalculator();

        // View state
        this.center = { lon: 20, lat: 50 };
        this.zoom = 8; // Zoom level (float)

        this.isDragging = false;
        this.lastMouse = { x: 0, y: 0 };
        this.lastTouchDistance = 0;
        this.lastTapTime = 0;
        this.isPinching = false;
        this.selectedRouteFeature = null;
        this.routeInfoPopup = document.getElementById('routeInfoPopup');

        this.mapSources = {
            standard: {
                url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                attribution: 'Tiles © <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> contributors'
            },
            cycle: {
                url: 'https://tile.thunderforest.com/cycle/{z}/{x}/{y}.png',
                attribution: 'Tiles © <a href="https://www.thunderforest.com/" target="_blank">Thunderforest</a>, Map data © <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a>'
            },
            satellite: {
                url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
                attribution: 'Tiles © <a href="https://www.esri.com/" target="_blank">Esri</a>, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
            }
        };

        this.currentSource = 'standard';

        // Layer flags
        this.layers = {
            squadrats: false,      // Z14
            squadrathinos: false,  // Z17
            ubersquadrat: false,   // Z11
            ubersquadratinho: false // Z14 (Distinct)
        };

        // Rendering options
        this.renderOptions = {
            drawOuterBoundary: true,
            drawInnerBoundary: true
        };

        // Animation loop
        this.needsUpdate = true;

        this.initEvents();
        this.resize();
        window.addEventListener('resize', () => this.resize());

        this.animate();
    }

    // Convert Lat/Lon to World Pixel Coordinates at current Zoom
    project(lon, lat) {
        const tileSize = this.tileSystem.tileSize;
        const scale = Math.pow(2, this.zoom);
        let x = (lon + 180) / 360 * scale * tileSize;
        const sinLat = Math.sin(lat * Math.PI / 180);
        const clampedSin = Math.max(Math.min(sinLat, 0.9999), -0.9999);
        const y = (0.5 - Math.log((1 + clampedSin) / (1 - clampedSin)) / (4 * Math.PI)) * scale * tileSize;
        return { x, y };
    }

    // Convert Screen X/Y to Lat/Lon
    unproject(screenX, screenY) {
        const tileSize = this.tileSystem.tileSize;
        const scale = Math.pow(2, this.zoom);
        const cx = this.canvas.width / 2;
        const cy = this.canvas.height / 2;
        const centerWorld = this.project(this.center.lon, this.center.lat);
        const worldX = centerWorld.x + (screenX - cx);
        const worldY = centerWorld.y + (screenY - cy);
        const normX = worldX / (tileSize * scale);
        const normY = worldY / (tileSize * scale);
        const lon = normX * 360 - 180;
        const n = Math.PI - 2 * Math.PI * normY;
        const lat = 180 / Math.PI * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
        return { lon, lat };
    }

    initEvents() {
        this.canvas.addEventListener('mousedown', (e) => {
            this.isDragging = true;
            this.lastMouse = { x: e.clientX, y: e.clientY };
            this.dragStart = { x: e.clientX, y: e.clientY };
        });

        window.addEventListener('mousemove', (e) => {
            const rect = this.canvas.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;
            const mouseGeo = this.unproject(mouseX, mouseY);

            const latEl = document.getElementById('mouseLat');
            const lonEl = document.getElementById('mouseLon');
            if (latEl && lonEl) {
                latEl.textContent = mouseGeo.lat.toFixed(5);
                lonEl.textContent = mouseGeo.lon.toFixed(5);
            }

            if (!this.isDragging) return;
            const dx = e.clientX - this.lastMouse.x;
            const dy = e.clientY - this.lastMouse.y;
            const newCenter = this.unproject(
                (this.canvas.width / 2) - dx,
                (this.canvas.height / 2) - dy
            );
            this.center = newCenter;
            this.lastMouse = { x: e.clientX, y: e.clientY };
            this.hideRoutePopup();
            this.requestUpdate();
        });

        window.addEventListener('mouseup', (e) => {
            if (this.isDragging && this.dragStart) {
                const dx = e.clientX - this.dragStart.x;
                const dy = e.clientY - this.dragStart.y;
                if (Math.abs(dx) < 3 && Math.abs(dy) < 3) {
                    const rect = this.canvas.getBoundingClientRect();
                    const mouseX = e.clientX - rect.left;
                    const mouseY = e.clientY - rect.top;
                    const mouseGeo = this.unproject(mouseX, mouseY);
                    if (this.selectNearestRoute(mouseX, mouseY, mouseGeo)) return;
                    if (this.onClick) {
                        this.onClick(mouseGeo);
                    }
                }
            }
            this.isDragging = false;
        });

        this.canvas.addEventListener('wheel', (e) => {
            e.preventDefault();

            const rect = this.canvas.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;
            const mouseGeo = this.unproject(mouseX, mouseY);

            this.zoom += (e.deltaY > 0 ? -0.1 : 0.1);
            this.zoom = Math.max(1, Math.min(22, this.zoom)); // Increased max zoom for squadrathinos

            const newMouseWorld = this.project(mouseGeo.lon, mouseGeo.lat);
            const cx = this.canvas.width / 2;
            const cy = this.canvas.height / 2;
            const newCenterWorldX = newMouseWorld.x - (mouseX - cx);
            const newCenterWorldY = newMouseWorld.y - (mouseY - cy);

            const tileSize = this.tileSystem.tileSize;
            const scale = Math.pow(2, this.zoom);
            const normX = newCenterWorldX / (tileSize * scale);
            const normY = newCenterWorldY / (tileSize * scale);

            const lon = normX * 360 - 180;
            const n = Math.PI - 2 * Math.PI * normY;
            const lat = 180 / Math.PI * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));

            this.center = { lon, lat };
            this.hideRoutePopup();
            this.requestUpdate();
        }, { passive: false });

        // --- Touch Events ---
        this.canvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            const now = Date.now();
            const rect = this.canvas.getBoundingClientRect();

            if (e.touches.length === 1) {
                // Double tap check
                if (now - this.lastTapTime < 300) {
                    const tx = e.touches[0].clientX - rect.left;
                    const ty = e.touches[0].clientY - rect.top;
                    this.handleDoubleTap(tx, ty);
                    this.lastTapTime = 0; // Reset to prevent triple tap
                    return;
                }
                this.lastTapTime = now;

                this.isDragging = true;
                this.isPinching = false;
                this.lastMouse = { x: e.touches[0].clientX, y: e.touches[0].clientY };
                this.dragStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };
            } else if (e.touches.length === 2) {
                this.isDragging = false;
                this.isPinching = true;
                const dx = e.touches[0].clientX - e.touches[1].clientX;
                const dy = e.touches[0].clientY - e.touches[1].clientY;
                this.lastTouchDistance = Math.sqrt(dx * dx + dy * dy);
            }
        }, { passive: false });

        this.canvas.addEventListener('touchmove', (e) => {
            e.preventDefault();
            const rect = this.canvas.getBoundingClientRect();

            if (e.touches.length === 1 && this.isDragging) {
                const dx = e.touches[0].clientX - this.lastMouse.x;
                const dy = e.touches[0].clientY - this.lastMouse.y;

                const newCenter = this.unproject(
                    (this.canvas.width / 2) - dx,
                    (this.canvas.height / 2) - dy
                );
                this.center = newCenter;
                this.lastMouse = { x: e.touches[0].clientX, y: e.touches[0].clientY };
                this.hideRoutePopup();
                this.requestUpdate();
            } else if (e.touches.length === 2 && this.isPinching) {
                const dx = e.touches[0].clientX - e.touches[1].clientX;
                const dy = e.touches[0].clientY - e.touches[1].clientY;
                const distance = Math.sqrt(dx * dx + dy * dy);

                if (distance > 10 && this.lastTouchDistance > 0) {
                    // Calculate pinch center in screen coords
                    const centerX = (e.touches[0].clientX + e.touches[1].clientX) / 2 - rect.left;
                    const centerY = (e.touches[0].clientY + e.touches[1].clientY) / 2 - rect.top;
                    const centerGeo = this.unproject(centerX, centerY);

                    // Use logarithmic zoom for smoother feel
                    const zoomDiff = Math.log2(distance / this.lastTouchDistance);
                    this.zoom = Math.max(1, Math.min(22, this.zoom + zoomDiff));

                    // Recenter after zoom to stay on pinch center
                    const newCenterWorld = this.project(centerGeo.lon, centerGeo.lat);
                    const cx = this.canvas.width / 2;
                    const cy = this.canvas.height / 2;
                    const newCenterWorldX = newCenterWorld.x - (centerX - cx);
                    const newCenterWorldY = newCenterWorld.y - (centerY - cy);

                    const tileSize = this.tileSystem.tileSize;
                    const scale = Math.pow(2, this.zoom);
                    const normX = newCenterWorldX / (tileSize * scale);
                    const normY = newCenterWorldY / (tileSize * scale);

                    const lon = normX * 360 - 180;
                    const n = Math.PI - 2 * Math.PI * normY;
                    const lat = 180 / Math.PI * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));

                    this.center = { lon, lat };
                    this.lastTouchDistance = distance;
                    this.hideRoutePopup();
                    this.requestUpdate();
                }
            }
        }, { passive: false });

        this.canvas.addEventListener('touchend', (e) => {
            if (this.isDragging && this.dragStart && e.changedTouches.length === 1) {
                const dx = e.changedTouches[0].clientX - this.dragStart.x;
                const dy = e.changedTouches[0].clientY - this.dragStart.y;
                if (Math.abs(dx) < 10 && Math.abs(dy) < 10) {
                    const rect = this.canvas.getBoundingClientRect();
                    const mouseX = e.changedTouches[0].clientX - rect.left;
                    const mouseY = e.changedTouches[0].clientY - rect.top;
                    const mouseGeo = this.unproject(mouseX, mouseY);
                    if (this.selectNearestRoute(mouseX, mouseY, mouseGeo)) return;
                    if (this.onClick) this.onClick(mouseGeo);
                }
            }
            this.isDragging = false;
            this.isPinching = false;
            this.lastTouchDistance = 0;
        });


    }

    handleDoubleTap(screenX, screenY) {
        const mouseGeo = this.unproject(screenX, screenY);
        const oldZoom = this.zoom;
        this.zoom = Math.min(22, Math.floor(this.zoom + 1));
        
        if (this.zoom !== oldZoom) {
            const newCenterWorld = this.project(mouseGeo.lon, mouseGeo.lat);
            const cx = this.canvas.width / 2;
            const cy = this.canvas.height / 2;
            
            const tileSize = this.tileSystem.tileSize;
            const scale = Math.pow(2, this.zoom);
            const normX = (newCenterWorld.x - (screenX - cx)) / (tileSize * scale);
            const normY = (newCenterWorld.y - (screenY - cy)) / (tileSize * scale);

            const lon = normX * 360 - 180;
            const n = Math.PI - 2 * Math.PI * normY;
            const lat = 180 / Math.PI * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));

            this.center = { lon, lat };
            this.hideRoutePopup();
            this.requestUpdate();
        }
    }

    selectNearestRoute(screenX, screenY, clickedGeo) {
        const hit = this.findNearestRoute(screenX, screenY);

        if (!hit) {
            this.selectedRouteFeature = null;
            this.hideRoutePopup();
            this.requestUpdate();
            return false;
        }

        this.selectedRouteFeature = hit.feature;
        this.showRoutePopup(hit, screenX, screenY, clickedGeo);
        this.requestUpdate();
        return true;
    }

    findNearestRoute(screenX, screenY) {
        const routeTypes = new Set(['trail_gpx', 'user_gpx']);
        const centerWorld = this.project(this.center.lon, this.center.lat);
        const cx = this.canvas.width / 2;
        const cy = this.canvas.height / 2;
        const hitThresholdPx = Math.max(10, Math.min(24, 18 - this.zoom * 0.35));
        let nearest = null;

        this.features.forEach(feature => {
            if (!routeTypes.has(feature.type)) return;

            feature.geometries.forEach(geom => {
                if (geom.type !== 'LineString' || !geom.coordinates || geom.coordinates.length < 2) return;

                for (let i = 0; i < geom.coordinates.length - 1; i++) {
                    const a = this.toScreenPoint(geom.coordinates[i], centerWorld, cx, cy);
                    const b = this.toScreenPoint(geom.coordinates[i + 1], centerWorld, cx, cy);

                    if (!this.segmentCouldBeVisible(a, b, hitThresholdPx)) continue;

                    const distancePx = this.distanceToSegment(screenX, screenY, a.x, a.y, b.x, b.y);
                    if (distancePx > hitThresholdPx) continue;

                    if (!nearest || distancePx < nearest.distancePx) {
                        nearest = { feature, distancePx };
                    }
                }
            });
        });

        return nearest;
    }

    toScreenPoint(coord, centerWorld, cx, cy) {
        const projected = this.project(coord.lon, coord.lat);
        return {
            x: projected.x - centerWorld.x + cx,
            y: projected.y - centerWorld.y + cy
        };
    }

    segmentCouldBeVisible(a, b, padding) {
        const minX = Math.min(a.x, b.x);
        const maxX = Math.max(a.x, b.x);
        const minY = Math.min(a.y, b.y);
        const maxY = Math.max(a.y, b.y);

        return maxX >= -padding
            && minX <= this.canvas.width + padding
            && maxY >= -padding
            && minY <= this.canvas.height + padding;
    }

    distanceToSegment(px, py, ax, ay, bx, by) {
        const dx = bx - ax;
        const dy = by - ay;
        const lengthSq = dx * dx + dy * dy;

        if (lengthSq === 0) {
            return Math.hypot(px - ax, py - ay);
        }

        const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lengthSq));
        const closestX = ax + t * dx;
        const closestY = ay + t * dy;
        return Math.hypot(px - closestX, py - closestY);
    }

    showRoutePopup(hit, screenX, screenY, clickedGeo) {
        if (!this.routeInfoPopup) return;

        const feature = hit.feature;
        const routeKind = feature.type === 'user_gpx' ? 'Trasa użytkownika' : 'Szlak';
        const distanceMeters = this.pixelDistanceToMeters(hit.distancePx, clickedGeo.lat);
        const rows = [
            ['Typ', routeKind],
            ['Rodzaj', feature.trailType || '-'],
            ['Plik', feature.sourceFileName || feature.sourceFile || '-'],
            ['Długość', feature.lengthKm ? `${feature.lengthKm.toFixed(2)} km` : '-'],
            ['Od kliknięcia', `${distanceMeters.toFixed(0)} m`]
        ];

        this.routeInfoPopup.innerHTML = `
            <button class="close-btn" type="button" aria-label="Zamknij">×</button>
            <h3>${this.escapeHtml(feature.name || routeKind)}</h3>
            <dl>${rows.map(([label, value]) => `<dt>${this.escapeHtml(label)}</dt><dd>${this.escapeHtml(String(value))}</dd>`).join('')}</dl>
        `;
        this.routeInfoPopup.querySelector('.close-btn').addEventListener('click', () => {
            this.selectedRouteFeature = null;
            this.hideRoutePopup();
            this.requestUpdate();
        });

        this.routeInfoPopup.classList.remove('hidden');
        this.positionRoutePopup(screenX, screenY);
    }

    positionRoutePopup(screenX, screenY) {
        if (!this.routeInfoPopup) return;

        const margin = 12;
        const offset = 14;
        const rect = this.routeInfoPopup.getBoundingClientRect();
        let left = screenX + offset;
        let top = screenY + offset;

        if (left + rect.width + margin > window.innerWidth) {
            left = screenX - rect.width - offset;
        }

        if (top + rect.height + margin > window.innerHeight) {
            top = screenY - rect.height - offset;
        }

        this.routeInfoPopup.style.left = `${Math.max(margin, left)}px`;
        this.routeInfoPopup.style.top = `${Math.max(margin, top)}px`;
    }

    hideRoutePopup() {
        if (this.routeInfoPopup) {
            this.routeInfoPopup.classList.add('hidden');
        }
    }

    pixelDistanceToMeters(distancePx, latitude) {
        const metersPerPixel = 156543.03392 * Math.cos(latitude * Math.PI / 180) / Math.pow(2, this.zoom);
        return distancePx * metersPerPixel;
    }

    escapeHtml(value) {
        return String(value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    setMapSource(sourceKey, apiKey = '') {
        if (this.mapSources[sourceKey]) {
            this.currentSource = sourceKey;
            const src = this.mapSources[sourceKey];
            this.tileSystem.setTemplate(src.url, apiKey);

            const attrEl = document.getElementById('mapAttribution');
            if (attrEl) {
                attrEl.innerHTML = src.attribution;
            }

            this.requestUpdate();
        }
    }

    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        this.requestUpdate();
    }

    requestUpdate() {
        this.needsUpdate = true;
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        if (!this.needsUpdate) return;
        this.draw();
        this.needsUpdate = false;
    }

    addFeatures(newFeatures, resetView = true) {
        this.features.push(...newFeatures);

        if (resetView) {
            this.fitToData();
        } else {
            this.requestUpdate();
        }
        this.updateStats();
    }

    updateStats() {
        let polys = 0, lines = 0, points = 0;
        this.features.forEach(f => {
            f.geometries.forEach(g => {
                if (g.type === 'Polygon') polys++;
                if (g.type === 'LineString') lines++;
                if (g.type === 'Point') points++;
            });
        });
        document.getElementById('polyCount').textContent = polys;
        document.getElementById('lineCount').textContent = lines;
        document.getElementById('pointCount').textContent = points;
    }

    calculateBounds() {
        let minLon = 180, minLat = 90, maxLon = -180, maxLat = -90;
        let hasData = false;

        this.features.forEach(feature => {
            feature.geometries.forEach(geom => {
                // Helper to process coordinates
                const processCoords = (coords) => {
                    coords.forEach(p => {
                        minLon = Math.min(minLon, p.lon);
                        minLat = Math.min(minLat, p.lat);
                        maxLon = Math.max(maxLon, p.lon);
                        maxLat = Math.max(maxLat, p.lat);
                        hasData = true;
                    });
                };

                // Handle Point
                if (geom.type === 'Point' && geom.coordinates) {
                    processCoords([geom.coordinates]);
                }

                // Handle LineString
                if (geom.type === 'LineString' && geom.coordinates) {
                    processCoords(geom.coordinates);
                }

                // Handle Polygon with new structure
                if (geom.type === 'Polygon') {
                    if (geom.outerRings) {
                        geom.outerRings.forEach(ring => processCoords(ring));
                    }
                    if (geom.innerRings) {
                        geom.innerRings.forEach(ring => processCoords(ring));
                    }
                }
            });
        });

        if (!hasData) return null;
        return { minLon, minLat, maxLon, maxLat };
    }

    fitToData() {
        const bounds = this.calculateBounds();
        if (!bounds) return;

        this.center = {
            lon: (bounds.minLon + bounds.maxLon) / 2,
            lat: (bounds.minLat + bounds.maxLat) / 2
        };

        const padding = 50;
        let dLon = bounds.maxLon - bounds.minLon;
        let dLat = bounds.maxLat - bounds.minLat;

        if (dLon === 0) dLon = 0.01;
        if (dLat === 0) dLat = 0.01;

        const zoomX = Math.log2((this.canvas.width - padding) / 256 * 360 / dLon);
        const zoomY = Math.log2((this.canvas.height - padding) / 256 * 180 / dLat);

        this.zoom = Math.min(zoomX, zoomY);
        this.zoom = Math.min(Math.max(this.zoom, 1), 18);
        this.requestUpdate();
    }

    draw() {
        // Clear background
        this.ctx.fillStyle = '#0f1115';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        const centerWorld = this.project(this.center.lon, this.center.lat);
        const cx = this.canvas.width / 2;
        const cy = this.canvas.height / 2;
        const tileSize = this.tileSystem.tileSize;

        // --- Draw Tiles ---
        const tileZoom = Math.floor(this.zoom);
        const scale = Math.pow(2, this.zoom - tileZoom);

        const centerTX = this.tileSystem.lon2tile(this.center.lon, tileZoom);
        const centerTY = this.tileSystem.lat2tile(this.center.lat, tileZoom);

        const tilesX = Math.ceil(this.canvas.width / (tileSize * scale)) + 1;
        const tilesY = Math.ceil(this.canvas.height / (tileSize * scale)) + 1;

        const minTX = Math.floor(centerTX - tilesX / 2);
        const maxTX = Math.floor(centerTX + tilesX / 2);
        const minTY = Math.floor(centerTY - tilesY / 2);
        const maxTY = Math.floor(centerTY + tilesY / 2);

        for (let x = minTX; x <= maxTX; x++) {
            for (let y = minTY; y <= maxTY; y++) {
                const normX = (x % Math.pow(2, tileZoom) + Math.pow(2, tileZoom)) % Math.pow(2, tileZoom);
                const tile = this.tileSystem.getTile(normX, y, tileZoom);

                if (tile.loaded) {
                    const tileScale = Math.pow(2, this.zoom - tileZoom);
                    // Standard tile drawing math
                    const wx = x * tileSize * tileScale;
                    const wy = y * tileSize * tileScale;
                    const sx = wx - centerWorld.x + cx;
                    const sy = wy - centerWorld.y + cy;
                    const sw = tileSize * tileScale;

                    this.ctx.drawImage(tile.image, sx, sy, sw, sw);
                } else if (!tile.requested) {
                    if (!this.pollHandle) {
                        this.pollHandle = setTimeout(() => { this.requestUpdate(); this.pollHandle = null; }, 100);
                    }
                }
            }
        }

        // --- Draw Visited Tiles (Overlay) ---
        const drawVisitedTiles = (visitedSet, targetZ, color) => {
            if (!visitedSet || visitedSet.size === 0) return;
            // Only draw if zoom is relatively close
            if (this.zoom < targetZ - 6) return;

            this.ctx.fillStyle = color;

            const tl = this.unproject(0, 0);
            const br = this.unproject(this.canvas.width, this.canvas.height);
            const vMinX = Math.floor(this.tileSystem.lon2tile(tl.lon, targetZ));
            const vMaxX = Math.floor(this.tileSystem.lon2tile(br.lon, targetZ));
            const vMinY = Math.floor(this.tileSystem.lat2tile(tl.lat, targetZ));
            const vMaxY = Math.floor(this.tileSystem.lat2tile(br.lat, targetZ));

            const visibleCount = (vMaxX - vMinX + 1) * (vMaxY - vMinY + 1);

            // Optimization: Iterate Set if sparse, or Iterate View if dense
            if (visibleCount < 5000) {
                for (let x = vMinX; x <= vMaxX; x++) {
                    for (let y = vMinY; y <= vMaxY; y++) {
                        if (visitedSet.has(`${x},${y}`)) {
                            const lon1 = this.tileSystem.tile2lon(x, targetZ);
                            const p1 = this.project(lon1, this.tileSystem.tile2lat(y, targetZ));
                            const p2 = this.project(this.tileSystem.tile2lon(x + 1, targetZ), this.tileSystem.tile2lat(y + 1, targetZ));

                            const sx = p1.x - centerWorld.x + cx;
                            const sy = p1.y - centerWorld.y + cy;
                            const w = p2.x - p1.x;
                            const h = p2.y - p1.y;

                            this.ctx.fillRect(Math.floor(sx), Math.floor(sy), Math.ceil(w), Math.ceil(h));
                        }
                    }
                }
            } else {
                visitedSet.forEach(key => {
                    const [x, y] = key.split(',').map(Number);
                    if (x >= vMinX && x <= vMaxX && y >= vMinY && y <= vMaxY) {
                        const lon1 = this.tileSystem.tile2lon(x, targetZ);
                        const p1 = this.project(lon1, this.tileSystem.tile2lat(y, targetZ));
                        const p2 = this.project(this.tileSystem.tile2lon(x + 1, targetZ), this.tileSystem.tile2lat(y + 1, targetZ));

                        const sx = p1.x - centerWorld.x + cx;
                        const sy = p1.y - centerWorld.y + cy;
                        const w = p2.x - p1.x;
                        const h = p2.y - p1.y;
                        this.ctx.fillRect(Math.floor(sx), Math.floor(sy), Math.ceil(w), Math.ceil(h));
                    }
                });
            }
        };

        // --- Draw Grid Overlays ---
        // Helper to draw grid for a specific target zoom Level Z
        const drawGridLayer = (targetZ, color, lineWidth = 1) => {
            // Check if visible
            // If targetZ is much higher than current zoom, don't draw (too dense)
            if (this.zoom < targetZ - 4) return; // Optimization

            this.ctx.beginPath();
            this.ctx.strokeStyle = color;
            this.ctx.lineWidth = lineWidth;

            // Determine loop range for TargetZ
            // We can iterate over the CURRENT screen bounds and find TargetZ lines

            // Current Screen Bounds in World Pixels for TargetZ
            // We need to map Screen (0,0) and (W,H) to TileCoords at TargetZ

            // Screen TL -> LatLon -> Tile(TargetZ)
            const tl = this.unproject(0, 0);
            const br = this.unproject(this.canvas.width, this.canvas.height);

            const minX = Math.floor(this.tileSystem.lon2tile(tl.lon, targetZ));
            const maxX = Math.floor(this.tileSystem.lon2tile(br.lon, targetZ));
            const minY = Math.floor(this.tileSystem.lat2tile(tl.lat, targetZ));
            const maxY = Math.floor(this.tileSystem.lat2tile(br.lat, targetZ));

            // Iterate and draw lines
            // We need to draw lines at x and y boundaries

            // Draw Vertical lines
            for (let x = minX; x <= maxX + 1; x++) {
                // x is tile index. Lon?
                // tile2lon returns Left edge of tile x
                const lon = this.tileSystem.tile2lon(x, targetZ);
                // Project to screen
                // We need 2 points: top and bottom of screen? 
                // Line is constant longitude.
                // Project (lon, maxLat) and (lon, minLat)
                // BUT projection is not linear Y.
                // However, vertical lines in WebMercator are vertical on screen.

                const p = this.project(lon, 0); // Lat doesn't matter for X
                const sx = p.x - centerWorld.x + cx;

                if (sx >= -50 && sx <= this.canvas.width + 50) {
                    this.ctx.moveTo(sx, 0);
                    this.ctx.lineTo(sx, this.canvas.height);
                }
            }

            // Draw Horizontal lines
            for (let y = minY; y <= maxY + 1; y++) {
                // tile2lat returns Top edge of tile y
                const lat = this.tileSystem.tile2lat(y, targetZ);

                // Horizontal lines in WebMercator are horizontal on screen
                const p = this.project(0, lat);
                const sy = p.y - centerWorld.y + cy;

                if (sy >= -50 && sy <= this.canvas.height + 50) {
                    this.ctx.moveTo(0, sy);
                    this.ctx.lineTo(this.canvas.width, sy);
                }
            }

            this.ctx.stroke();
        };

        if (this.layers.ubersquadrat) drawGridLayer(11, 'rgba(239, 68, 68, 0.5)', 2); // Red, thicker
        if (this.layers.squadrats) drawGridLayer(14, 'rgba(59, 130, 246, 0.4)', 1); // Blue
        if (this.layers.ubersquadratinho) drawGridLayer(14, 'rgba(245, 158, 11, 0.4)', 1); // Orange/Amber (Same Z14, distinct color)
        if (this.layers.squadrathinos) drawGridLayer(17, 'rgba(16, 185, 129, 0.3)', 1); // Green, thin

        // --- Draw Features (Filtered by Layer) ---
        this.ctx.save();
        this.features.forEach(feature => {
            // Determine visibility based on name and layers
            const name = (feature.name || '').toLowerCase();
            let isVisible = true; // Default to visible for generic tracks/points
            let matchedLayer = false;

            // Check specific types (Order matters for sub-matches)
            if (name.includes('ubersquadratinho')) {
                isVisible = this.layers.ubersquadratinho;
                matchedLayer = true;
            } else if (name.includes('ubersquadrat')) {
                isVisible = this.layers.ubersquadrat;
                matchedLayer = true;
            } else if (name.includes('squadrathinos') || name.includes('squadratinho')) {
                isVisible = this.layers.squadrathinos;
                matchedLayer = true;
            } else if (name.includes('squadrats') || name.includes('squadrat')) {
                isVisible = this.layers.squadrats;
                matchedLayer = true;
            }

            if (!isVisible) return;

            feature.geometries.forEach(geom => {
                if (geom.type === 'Polygon') {
                    const style = feature.style || {};

                    // Helper function to generate distinct colors for each ring
                    const generateRingColor = (index, total, isInner = false) => {
                        // Use HSL for better color distribution
                        const hue = (index * 360 / total) % 360;
                        const saturation = isInner ? 60 : 70;
                        const lightness = isInner ? 45 : 55;
                        const alpha = isInner ? 0.3 : 0.4;
                        return `hsla(${hue}, ${saturation}%, ${lightness}%, ${alpha})`;
                    };

                    const generateStrokeColor = (index, total, isInner = false) => {
                        const hue = (index * 360 / total) % 360;
                        const saturation = isInner ? 70 : 80;
                        const lightness = isInner ? 40 : 50;
                        return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
                    };

                    // Create single path for fill to allow transparent holes
                    if (style.fill !== false) {
                        this.ctx.beginPath();

                        // Add outer rings to fill path
                        if (this.renderOptions.drawOuterBoundary && geom.outerRings) {
                            geom.outerRings.forEach(ring => {
                                if (ring.length === 0) return;
                                const p0 = this.project(ring[0].lon, ring[0].lat);
                                this.ctx.moveTo(p0.x - centerWorld.x + cx, p0.y - centerWorld.y + cy);
                                for (let i = 1; i < ring.length; i++) {
                                    const p = this.project(ring[i].lon, ring[i].lat);
                                    this.ctx.lineTo(p.x - centerWorld.x + cx, p.y - centerWorld.y + cy);
                                }
                                this.ctx.closePath();
                            });
                        }

                        // Add inner rings to fill path
                        if (this.renderOptions.drawInnerBoundary && geom.innerRings) {
                            geom.innerRings.forEach(ring => {
                                if (ring.length === 0) return;
                                const p0 = this.project(ring[0].lon, ring[0].lat);
                                this.ctx.moveTo(p0.x - centerWorld.x + cx, p0.y - centerWorld.y + cy);
                                for (let i = 1; i < ring.length; i++) {
                                    const p = this.project(ring[i].lon, ring[i].lat);
                                    this.ctx.lineTo(p.x - centerWorld.x + cx, p.y - centerWorld.y + cy);
                                }
                                this.ctx.closePath();
                            });
                        }

                        const totalOuter = geom.outerRings ? geom.outerRings.length : 1;
                        this.ctx.fillStyle = style.fillColor || generateRingColor(0, totalOuter, false);
                        this.ctx.fill('evenodd');
                    }

                    // Stroke outer boundaries
                    if (this.renderOptions.drawOuterBoundary && geom.outerRings) {
                        const totalOuter = geom.outerRings.length;
                        geom.outerRings.forEach((ring, ringIndex) => {
                            if (ring.length === 0) return;

                            this.ctx.beginPath();
                            const p0 = this.project(ring[0].lon, ring[0].lat);
                            this.ctx.moveTo(p0.x - centerWorld.x + cx, p0.y - centerWorld.y + cy);

                            for (let i = 1; i < ring.length; i++) {
                                const p = this.project(ring[i].lon, ring[i].lat);
                                this.ctx.lineTo(p.x - centerWorld.x + cx, p.y - centerWorld.y + cy);
                            }
                            this.ctx.closePath();

                            if (style.outline !== false) {
                                this.ctx.strokeStyle = style.strokeColor || generateStrokeColor(ringIndex, totalOuter, false);
                                this.ctx.lineWidth = style.strokeWidth || 2;
                                this.ctx.stroke();
                            }
                        });
                    }

                    // Stroke inner boundaries
                    if (this.renderOptions.drawInnerBoundary && geom.innerRings) {
                        const totalOuter = geom.outerRings ? geom.outerRings.length : 1;
                        geom.innerRings.forEach((ring) => {
                            if (ring.length === 0) return;

                            this.ctx.beginPath();
                            const p0 = this.project(ring[0].lon, ring[0].lat);
                            this.ctx.moveTo(p0.x - centerWorld.x + cx, p0.y - centerWorld.y + cy);

                            for (let i = 1; i < ring.length; i++) {
                                const p = this.project(ring[i].lon, ring[i].lat);
                                this.ctx.lineTo(p.x - centerWorld.x + cx, p.y - centerWorld.y + cy);
                            }
                            this.ctx.closePath();

                            if (style.outline !== false) {
                                this.ctx.strokeStyle = style.strokeColor || generateStrokeColor(0, totalOuter, false);
                                this.ctx.lineWidth = style.strokeWidth || 2;
                                this.ctx.stroke();
                            }
                        });
                    }
                } else if (geom.type === 'LineString') {
                    const coords = geom.coordinates;
                    if (coords.length === 0) return;

                    this.ctx.beginPath();
                    const p0 = this.project(coords[0].lon, coords[0].lat);
                    let sx = p0.x - centerWorld.x + cx;
                    let sy = p0.y - centerWorld.y + cy;

                    this.ctx.moveTo(sx, sy);

                    for (let i = 1; i < coords.length; i++) {
                        const p = this.project(coords[i].lon, coords[i].lat);
                        sx = p.x - centerWorld.x + cx;
                        sy = p.y - centerWorld.y + cy;
                        this.ctx.lineTo(sx, sy);
                    }

                    const style = feature.style || {};
                    if (feature === this.selectedRouteFeature) {
                        this.ctx.save();
                        this.ctx.strokeStyle = '#facc15';
                        this.ctx.lineWidth = (style.strokeWidth || 3) + 7;
                        this.ctx.lineCap = 'round';
                        this.ctx.lineJoin = 'round';
                        this.ctx.stroke();
                        this.ctx.restore();
                    }

                    this.ctx.strokeStyle = style.strokeColor || '#3b82f6';
                    this.ctx.lineWidth = style.strokeWidth || 3;
                    this.ctx.lineCap = 'round';
                    this.ctx.lineJoin = 'round';
                    this.ctx.stroke();
                } else if (geom.type === 'Point') {
                    const p = this.project(geom.coordinates.lon, geom.coordinates.lat);
                    const sx = p.x - centerWorld.x + cx;
                    const sy = p.y - centerWorld.y + cy;

                    const style = feature.style || {};
                    this.ctx.fillStyle = style.fillColor || '#ef4444';
                    this.ctx.beginPath();
                    this.ctx.arc(sx, sy, style.radius || 5, 0, Math.PI * 2);
                    this.ctx.fill();
                    
                    if (style.outline !== false) {
                        this.ctx.strokeStyle = style.strokeColor || '#fff';
                        this.ctx.lineWidth = style.strokeWidth || 2;
                        this.ctx.stroke();
                    }
                }
            });
        });
        this.ctx.restore();
    }
}
