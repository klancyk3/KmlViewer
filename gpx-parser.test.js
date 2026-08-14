if (typeof DOMParser === 'undefined') {
    global.DOMParser = require('xmldom').DOMParser;
}

describe('GPXParser', () => {
    let parser;

    beforeEach(() => {
        parser = new GPXParser();
    });

    test('parses track segments as line features', () => {
        const gpx = `<?xml version="1.0" encoding="UTF-8"?>
            <gpx version="1.1" xmlns="http://www.topografix.com/GPX/1/1">
                <trk>
                    <name>Morning Ride</name>
                    <trkseg>
                        <trkpt lat="50.1" lon="18.9"><ele>240</ele></trkpt>
                        <trkpt lat="50.2" lon="19.0"><time>2026-08-14T10:00:00Z</time></trkpt>
                    </trkseg>
                </trk>
            </gpx>`;

        const features = parser.parse(gpx, 'ride.gpx');

        expect(features).toHaveLength(1);
        expect(features[0].name).toBe('Morning Ride');
        expect(features[0].type).toBe('gpx');
        expect(features[0].geometries[0].type).toBe('LineString');
        expect(features[0].geometries[0].coordinates).toEqual([
            { lat: 50.1, lon: 18.9, alt: 240 },
            { lat: 50.2, lon: 19.0, time: '2026-08-14T10:00:00Z' }
        ]);
    });

    test('parses routes and waypoints', () => {
        const gpx = `<gpx>
            <rte>
                <name>Route A</name>
                <rtept lat="51" lon="20"></rtept>
                <rtept lat="52" lon="21"></rtept>
            </rte>
            <wpt lat="53" lon="22"><name>Stop</name></wpt>
        </gpx>`;

        const features = parser.parse(gpx, 'route.gpx');

        expect(features).toHaveLength(2);
        expect(features[0].name).toBe('Route A');
        expect(features[0].geometries[0].type).toBe('LineString');
        expect(features[1].name).toBe('Stop');
        expect(features[1].geometries[0]).toEqual({
            type: 'Point',
            coordinates: { lat: 53, lon: 22 }
        });
    });

    test('skips invalid GPX points', () => {
        const gpx = `<gpx>
            <trk>
                <trkseg>
                    <trkpt lat="bad" lon="18"></trkpt>
                    <trkpt lat="50" lon="19"></trkpt>
                </trkseg>
            </trk>
        </gpx>`;

        const features = parser.parse(gpx, 'partial.gpx');

        expect(features).toHaveLength(1);
        expect(features[0].geometries[0].type).toBe('Point');
        expect(features[0].geometries[0].coordinates).toEqual({ lat: 50, lon: 19 });
    });
});
