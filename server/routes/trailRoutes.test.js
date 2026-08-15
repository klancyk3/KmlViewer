const { parseCsv } = require('./trailRoutes');

describe('trail routes helpers', () => {
    test('parseCsv trims values and removes empty entries', () => {
        expect(parseCsv(' dolnoslaskie, ,hiking ')).toEqual(['dolnoslaskie', 'hiking']);
    });

    test('parseCsv handles missing values', () => {
        expect(parseCsv(undefined)).toEqual([]);
    });
});
