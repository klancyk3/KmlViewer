const { Squadrat, TILE_ZOOM } = require('./squadrat');

describe('Squadrat', () => {
    test('builds z17 tile bounds from indexes', () => {
        const squadrat = Squadrat.fromTile(44799, 69058, TILE_ZOOM);

        expect(squadrat.index_ne).toBe(44799);
        expect(squadrat.index_we).toBe(69058);
        expect(squadrat.min_lon).toBeLessThan(squadrat.max_lon);
        expect(squadrat.min_lat).toBeLessThan(squadrat.max_lat);
    });

    test('collects a unique set of tiles for a linestring', () => {
        const squadrats = Squadrat.collectForLineString([
            { lon: 19.94, lat: 50.06 },
            { lon: 19.95, lat: 50.065 },
            { lon: 19.96, lat: 50.07 }
        ]);

        expect(squadrats.length).toBeGreaterThan(0);

        const uniqueKeys = new Set(squadrats.map(s => `${s.index_ne}:${s.index_we}`));
        expect(uniqueKeys.size).toBe(squadrats.length);
    });

    test('includes tiles crossed between distant points without intermediate vertices', () => {
        const squadrats = Squadrat.collectForLineString([
            { lon: 19.9, lat: 50.05 },
            { lon: 20.1, lat: 50.2 }
        ]);

        expect(squadrats.length).toBeGreaterThan(1);
    });
});
