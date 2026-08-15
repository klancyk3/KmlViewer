class TrailLayerController {
    constructor({ renderer, gpxParser, documentRef = document, fetchRef = fetch }) {
        this.renderer = renderer;
        this.gpxParser = gpxParser;
        this.document = documentRef;
        this.fetch = fetchRef;
        this.abortController = null;
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
            this.setRegionPlaceholder('Zrestartuj serwer KmlViewer');
            this.setStatus('Endpoint /trail-regions niedostępny');
        }

        [controls.enabled, controls.regionSelect, controls.foot, controls.hiking].forEach(el => {
            el.addEventListener('change', () => this.update());
        });

        if (controls.enabled.checked) {
            this.update();
        }
    }

    async update() {
        const controls = this.getControls();
        if (!controls.enabled || !controls.enabled.checked) {
            this.abortCurrentLoad();
            this.removeTrailFeatures();
            this.setDistance(0);
            this.setStatus('Szlaki wyłączone');
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

        this.abortCurrentLoad();
        this.abortController = new AbortController();
        this.setStatus('Ładowanie szlaków...');

        try {
            const params = new URLSearchParams({
                regions: regions.join(','),
                types: types.join(',')
            });
            const response = await this.fetch(`/trail-gpx?${params}`, {
                signal: this.abortController.signal
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
            this.setStatus(`Załadowano ${features.length} obiektów z ${sourceCount} plików`);
        } catch (err) {
            if (err.name === 'AbortError') return;

            console.error('Could not load trail GPX files:', err);
            this.setStatus('Nie udało się załadować szlaków');
        } finally {
            this.abortController = null;
        }
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

    abortCurrentLoad() {
        if (this.abortController) {
            this.abortController.abort();
            this.abortController = null;
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
            hiking: this.document.getElementById('trailTypeHiking')
        };
    }
}
