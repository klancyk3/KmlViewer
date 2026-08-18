const { parseBounds, parseCsv } = require('./trailRoutes');

describe('trail routes helpers', () => {
    test('parseCsv trims values and removes empty entries', () => {
        expect(parseCsv(' dolnoslaskie, ,hiking ')).toEqual(['dolnoslaskie', 'hiking']);
    });

    test('parseCsv handles missing values', () => {
        expect(parseCsv(undefined)).toEqual([]);
    });

    test('parseBounds returns null for incomplete bounds', () => {
        expect(parseBounds({ minLon: '19', minLat: '50', maxLon: '20' })).toBeNull();
    });

    test('parseBounds parses a valid bbox', () => {
        expect(parseBounds({
            minLon: '19.1',
            minLat: '49.9',
            maxLon: '20.2',
            maxLat: '50.3'
        })).toEqual({
            minLon: 19.1,
            minLat: 49.9,
            maxLon: 20.2,
            maxLat: 50.3
        });
    });

    test('parseBounds returns null for inverted bounds', () => {
        expect(parseBounds({
            minLon: '20.2',
            minLat: '50.3',
            maxLon: '19.1',
            maxLat: '49.9'
        })).toBeNull();
    });
});
