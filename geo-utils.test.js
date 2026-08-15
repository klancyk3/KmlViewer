const fs = require('fs');
const path = require('path');

const source = fs.readFileSync(path.join(__dirname, 'geo-utils.js'), 'utf8');
const GeoUtils = new Function(`${source}\nreturn GeoUtils;`)();

describe('GeoUtils', () => {
    test('calculates zero distance for a single point', () => {
        expect(GeoUtils.calculateLineDistanceKm([{ lat: 50, lon: 19 }])).toBe(0);
    });

    test('calculates approximate distance between two coordinates', () => {
        const distance = GeoUtils.distanceBetweenKm(
            { lat: 52.2297, lon: 21.0122 },
            { lat: 50.0647, lon: 19.9450 }
        );

        expect(distance).toBeGreaterThan(250);
        expect(distance).toBeLessThan(260);
    });
});
