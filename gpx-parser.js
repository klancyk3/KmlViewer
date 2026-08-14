class GPXParser {
    constructor() {
        this.parser = new DOMParser();
        this.trackColors = [
            '#ef4444',
            '#3b82f6',
            '#10b981',
            '#f59e0b',
            '#a855f7',
            '#06b6d4',
            '#f97316'
        ];
    }

    parse(xmlString, sourceName = 'GPX Track') {
        const xmlDoc = this.parser.parseFromString(xmlString, 'text/xml');
        const features = [];

        this.parseTracks(xmlDoc, sourceName, features);
        this.parseRoutes(xmlDoc, sourceName, features);
        this.parseWaypoints(xmlDoc, sourceName, features);

        return features;
    }

    parseTracks(xmlDoc, sourceName, features) {
        const tracks = this.getElements(xmlDoc, 'trk');

        tracks.forEach((track, trackIndex) => {
            const trackName = this.getNodeValue(track, 'name') || sourceName;
            const segments = this.getElements(track, 'trkseg');

            segments.forEach((segment, segmentIndex) => {
                const coordinates = this.getElements(segment, 'trkpt')
                    .map(point => this.parsePoint(point))
                    .filter(Boolean);

                if (coordinates.length === 0) return;

                features.push({
                    type: 'gpx',
                    name: segments.length > 1 ? `${trackName} (${segmentIndex + 1})` : trackName,
                    style: this.getTrackStyle(trackIndex + segmentIndex),
                    geometries: [{
                        type: coordinates.length === 1 ? 'Point' : 'LineString',
                        coordinates: coordinates.length === 1 ? coordinates[0] : coordinates
                    }]
                });
            });
        });
    }

    parseRoutes(xmlDoc, sourceName, features) {
        const routes = this.getElements(xmlDoc, 'rte');

        routes.forEach((route, routeIndex) => {
            const coordinates = this.getElements(route, 'rtept')
                .map(point => this.parsePoint(point))
                .filter(Boolean);

            if (coordinates.length === 0) return;

            features.push({
                type: 'gpx',
                name: this.getNodeValue(route, 'name') || `${sourceName} route`,
                style: this.getTrackStyle(routeIndex),
                geometries: [{
                    type: coordinates.length === 1 ? 'Point' : 'LineString',
                    coordinates: coordinates.length === 1 ? coordinates[0] : coordinates
                }]
            });
        });
    }

    parseWaypoints(xmlDoc, sourceName, features) {
        const waypoints = this.getElements(xmlDoc, 'wpt');

        waypoints.forEach((waypoint, waypointIndex) => {
            const coordinates = this.parsePoint(waypoint);
            if (!coordinates) return;

            features.push({
                type: 'gpx',
                name: this.getNodeValue(waypoint, 'name') || `${sourceName} waypoint ${waypointIndex + 1}`,
                style: {
                    fillColor: '#f97316',
                    strokeColor: '#ffffff',
                    strokeWidth: 2,
                    radius: 5
                },
                geometries: [{
                    type: 'Point',
                    coordinates
                }]
            });
        });
    }

    parsePoint(pointNode) {
        const lat = parseFloat(pointNode.getAttribute('lat'));
        const lon = parseFloat(pointNode.getAttribute('lon'));

        if (Number.isNaN(lat) || Number.isNaN(lon)) return null;

        const point = { lat, lon };
        const ele = this.getNodeValue(pointNode, 'ele');
        const time = this.getNodeValue(pointNode, 'time');

        if (ele !== null && !Number.isNaN(parseFloat(ele))) {
            point.alt = parseFloat(ele);
        }

        if (time) {
            point.time = time;
        }

        return point;
    }

    getTrackStyle(index) {
        return {
            strokeColor: this.trackColors[index % this.trackColors.length],
            strokeWidth: 4,
            fillColor: this.trackColors[index % this.trackColors.length],
            radius: 4
        };
    }

    getNodeValue(parent, tagName) {
        const node = this.getElements(parent, tagName)[0];
        return node ? node.textContent.trim() : null;
    }

    getElements(parent, tagName) {
        return Array.from(parent.getElementsByTagName('*'))
            .filter(node => node.localName === tagName || node.tagName === tagName);
    }
}
