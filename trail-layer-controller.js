class TrailLayerController {
    constructor({ renderer, gpxParser, documentRef = document, fetchRef = fetch }) {
        this.renderer = renderer;
        this.gpxParser = gpxParser;
        this.document = documentRef;
        this.fetch = (...args) => fetchRef.call(window, ...args);
        this.trailAbortController = null;
        this.userRouteAbortController = null;
        this.minimumTrailZoom = 10;
        this.viewportUpdateHandle = null;
        this.lastTrailQueryKey = null;
        this.lastUserRouteQueryKey = null;
    }

    async initialize() {
        const controls = this.getControls();
        if (!controls.enabled || !controls.regionSelect || !controls.foot || !controls.hiking) return;

        try {
            const response = await this.fetch('/trail-regions');
            if (!response.ok) throw new Error(`HTTP ${response.status}`);

            const regions = await response.json();
            controls.regionSelect.innerHTML = '';

            if (regions.length === 0) {
                this.setRegionPlaceholder('Brak województw');
                this.setStatus('Brak szlaków w bazie');
                return;
            }

            regions.forEach(region => {
                const option = this.document.createElement('option');
                option.value = region.key;
                option.textContent = region.name;
                option.selected = true;
                controls.regionSelect.appendChild(option);
            });

            this.setStatus('Ładowanie szlaków...');
        } catch (err) {
            console.error('Could not load trail regions:', err);
            this.setRegionPlaceholder('Nie udało się pobrać województw');
            this.setStatus('Endpoint /trail-regions niedostępny');
        }

        [controls.enabled, controls.regionSelect, controls.foot, controls.hiking].forEach(el => {
            if (el) el.addEventListener('change', () => this.updateTrails());
        });

        if (controls.userRoutes) {
            controls.userRoutes.addEventListener('change', () => this.updateUserRoutes());
        }

        if (controls.enabled && controls.enabled.checked) {
            this.updateTrails();
        }

        if (controls.userRoutes && controls.userRoutes.checked) {
            this.updateUserRoutes();
        }

        const previousViewportChanged = this.renderer.onViewportChanged;
        this.renderer.onViewportChanged = () => {
            if (typeof previousViewportChanged === 'function') {
                previousViewportChanged();
            }
            this.scheduleViewportRefresh();
        };
    }

    async update() {
        await Promise.all([this.updateTrails(), this.updateUserRoutes()]);
    }

    async updateTrails() {
        const controls = this.getControls();
        if (!controls.enabled || !controls.enabled.checked) {
            this.abortCurrentTrailLoad();
            this.removeTrailFeatures();
            this.setDistance(0);
            this.setStatus('Szlaki wyłączone');
            this.lastTrailQueryKey = null;
            return;
        }

        const regions = this.getSelectedRegions();
        const types = this.getSelectedTypes();

        this.removeTrailFeatures();

        if (regions.length === 0) {
            this.setDistance(0);
            this.setStatus('Wybierz przynajmniej jedno województwo');
            return;
        }

        if (types.length === 0) {
            this.setDistance(0);
            this.setStatus('Wybierz foot lub hiking');
            return;
        }

        if (this.renderer.zoom < this.minimumTrailZoom) {
            this.abortCurrentTrailLoad();
            this.removeTrailFeatures();
            this.setDistance(0);
            this.setStatus(`Przybliż mapę do zoom ${this.minimumTrailZoom}, aby wczytać szlaki`);
            this.lastTrailQueryKey = null;
            return;
        }

        this.abortCurrentTrailLoad();
        this.trailAbortController = new AbortController();
        const bounds = this.renderer.getViewportBounds();
        const queryKey = JSON.stringify({
            regions,
            types,
            bounds: roundBounds(bounds)
        });

        if (this.lastTrailQueryKey === queryKey) {
            this.trailAbortController = null;
            return;
        }

        this.lastTrailQueryKey = queryKey;
        this.setStatus('Ładowanie szlaków z widocznego obszaru...');

        try {
            const params = new URLSearchParams({
                regions: regions.join(','),
                types: types.join(','),
                minLon: String(bounds.minLon),
                minLat: String(bounds.minLat),
                maxLon: String(bounds.maxLon),
                maxLat: String(bounds.maxLat)
            });
            const response = await this.fetch(`/trail-gpx?${params}`, {
                signal: this.trailAbortController.signal
            });

            if (!response.ok) throw new Error(`HTTP ${response.status}`);

            const payload = await response.json();
            const { features, totalKm, sourceCount } = this.mapTrailResponseToFeatures(payload);

            if (features.length > 0) {
                this.renderer.addFeatures(features, false);
            } else {
                this.renderer.updateStats();
            }

            this.setDistance(totalKm);
            this.setStatus(`Załadowano ${features.length} obiektów z ${sourceCount} plików w widoku`);
        } catch (err) {
            if (err.name === 'AbortError') return;

            console.error('Could not load trail GPX files:', err);
            this.setStatus('Nie udało się załadować szlaków');
            this.lastTrailQueryKey = null;
        } finally {
            this.trailAbortController = null;
        }
    }

    async updateUserRoutes() {
        const controls = this.getControls();
        if (!controls.userRoutes || !controls.userRoutes.checked) {
            this.abortCurrentUserRouteLoad();
            this.removeUserRouteFeatures();
            this.setUserRouteDistance(0);
            this.setUserRouteStatus('Trasy użytkownika wyłączone');
            this.lastUserRouteQueryKey = null;
            return;
        }

        if (this.renderer.zoom < this.minimumTrailZoom) {
            this.abortCurrentUserRouteLoad();
            this.removeUserRouteFeatures();
            this.setUserRouteDistance(0);
            this.setUserRouteStatus(`Przybliż mapę do zoom ${this.minimumTrailZoom}, aby wczytać trasy użytkownika`);
            this.lastUserRouteQueryKey = null;
            return;
        }

        this.removeUserRouteFeatures();
        this.abortCurrentUserRouteLoad();
        this.userRouteAbortController = new AbortController();
        const bounds = this.renderer.getViewportBounds();
        const queryKey = JSON.stringify({
            bounds: roundBounds(bounds)
        });

        if (this.lastUserRouteQueryKey === queryKey) {
            this.userRouteAbortController = null;
            return;
        }

        this.lastUserRouteQueryKey = queryKey;
        this.setUserRouteStatus('Ładowanie tras użytkownika z widocznego obszaru...');

        try {
            const params = new URLSearchParams({
                minLon: String(bounds.minLon),
                minLat: String(bounds.minLat),
                maxLon: String(bounds.maxLon),
                maxLat: String(bounds.maxLat)
            });
            const response = await this.fetch(`/user-gpx?${params}`, {
                signal: this.userRouteAbortController.signal
            });

            if (!response.ok) throw new Error(`HTTP ${response.status}`);

            const { features, totalKm, sourceCount } = this.mapTrailResponseToFeatures(await response.json());

            features.forEach(feature => {
                feature.type = 'user_gpx';
                feature.style = {
                    ...feature.style,
                    strokeColor: feature.style?.strokeColor || '#38bdf8',
                    strokeWidth: Math.max(feature.style?.strokeWidth || 0, 4),
                    fillColor: feature.style?.fillColor || '#38bdf8'
                };
            });

            if (features.length > 0) {
                this.renderer.addFeatures(features, false);
            } else {
                this.renderer.updateStats();
            }

            this.setUserRouteDistance(totalKm);
            this.setUserRouteStatus(`Załadowano ${features.length} obiektów z ${sourceCount} plików w widoku`);
        } catch (err) {
            if (err.name === 'AbortError') return;

            console.error('Could not load user GPX routes:', err);
            this.setUserRouteStatus('Nie udało się załadować tras użytkownika');
            this.lastUserRouteQueryKey = null;
        } finally {
            this.userRouteAbortController = null;
        }
    }

    scheduleViewportRefresh() {
        clearTimeout(this.viewportUpdateHandle);
        this.viewportUpdateHandle = setTimeout(() => {
            this.update();
        }, 200);
    }

    mapTrailResponseToFeatures(payload) {
        if (Array.isArray(payload)) {
            return this.mapFilesToFeatures(payload);
        }

        return {
            features: payload.features || [],
            totalKm: payload.totalKm || 0,
            sourceCount: payload.sourceCount || 0
        };
    }

    mapFilesToFeatures(files) {
        const features = [];
        let totalKm = 0;

        files.forEach(file => {
            const parsed = this.gpxParser.parse(file.content, file.filename);
            parsed.forEach(feature => {
                this.decorateTrailFeature(feature, file);

                feature.geometries.forEach(geometry => {
                    if (geometry.type === 'LineString' && geometry.coordinates) {
                        totalKm += GeoUtils.calculateLineDistanceKm(geometry.coordinates);
                    }
                });
            });
            features.push(...parsed);
        });

        return { features, totalKm };
    }

    decorateTrailFeature(feature, file) {
        const style = feature.style || {};
        const fallbackColor = file.trailType === 'hiking' ? '#22c55e' : '#f97316';

        feature.type = 'trail_gpx';
        feature.name = `${file.regionName} ${file.trailType}: ${feature.name}`;
        feature.trailRegion = file.region;
        feature.trailType = file.trailType;
        feature.style = {
            ...style,
            strokeColor: style.strokeColor || fallbackColor,
            strokeWidth: file.trailType === 'hiking' ? 3 : 2,
            fillColor: style.fillColor || style.strokeColor || fallbackColor,
            radius: 3
        };
    }

    removeTrailFeatures() {
        this.renderer.features = this.renderer.features.filter(feature => feature.type !== 'trail_gpx');
        this.renderer.updateStats();
        this.renderer.requestUpdate();
    }

    removeUserRouteFeatures() {
        this.renderer.features = this.renderer.features.filter(feature => feature.type !== 'user_gpx');
        this.renderer.updateStats();
        this.renderer.requestUpdate();
    }

    abortCurrentTrailLoad() {
        if (this.trailAbortController) {
            this.trailAbortController.abort();
            this.trailAbortController = null;
        }
    }

    abortCurrentUserRouteLoad() {
        if (this.userRouteAbortController) {
            this.userRouteAbortController.abort();
            this.userRouteAbortController = null;
        }
    }

    getSelectedTypes() {
        const controls = this.getControls();
        const types = [];

        if (controls.foot && controls.foot.checked) types.push('foot');
        if (controls.hiking && controls.hiking.checked) types.push('hiking');

        return types;
    }

    getSelectedRegions() {
        const { regionSelect } = this.getControls();
        if (!regionSelect) return [];

        return Array.from(regionSelect.selectedOptions).map(option => option.value);
    }

    setStatus(text) {
        const statusEl = this.document.getElementById('trailLayerStatus');
        if (statusEl) statusEl.textContent = text;
    }

    setDistance(kilometers) {
        const distanceEl = this.document.getElementById('trailDistance');
        if (distanceEl) distanceEl.textContent = `${kilometers.toFixed(1)} km`;
    }

    setUserRouteStatus(text) {
        const statusEl = this.document.getElementById('userRouteLayerStatus');
        if (statusEl) statusEl.textContent = text;
    }

    setUserRouteDistance(kilometers) {
        const distanceEl = this.document.getElementById('userRouteDistance');
        if (distanceEl) distanceEl.textContent = `${kilometers.toFixed(1)} km`;
    }

    setRegionPlaceholder(text) {
        const { regionSelect } = this.getControls();
        if (!regionSelect) return;

        regionSelect.innerHTML = '';

        const option = this.document.createElement('option');
        option.textContent = text;
        option.disabled = true;
        regionSelect.appendChild(option);
    }

    getControls() {
        return {
            enabled: this.document.getElementById('trailsLayerEnabled'),
            regionSelect: this.document.getElementById('trailRegionSelect'),
            foot: this.document.getElementById('trailTypeFoot'),
            hiking: this.document.getElementById('trailTypeHiking'),
            userRoutes: this.document.getElementById('userRoutesLayerEnabled')
        };
    }
}

function roundBounds(bounds) {
    return {
        minLon: Number(bounds.minLon.toFixed(4)),
        minLat: Number(bounds.minLat.toFixed(4)),
        maxLon: Number(bounds.maxLon.toFixed(4)),
        maxLat: Number(bounds.maxLat.toFixed(4))
    };
}
