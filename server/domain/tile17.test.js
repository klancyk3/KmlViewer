const { Tile17, TILE_ZOOM } = require('./tile17');

describe('Tile17', () => {
    test('builds z17 tile bounds from indexes', () => {
        const tile17 = Tile17.fromTile(44799, 69058, TILE_ZOOM);

        expect(tile17.index_ne).toBe(44799);
        expect(tile17.index_we).toBe(69058);
        expect(tile17.min_lon).toBeLessThan(tile17.max_lon);
        expect(tile17.min_lat).toBeLessThan(tile17.max_lat);
    });

    test('collects a unique set of tiles for a linestring', () => {
        const tiles17 = Tile17.collectForLineString([
            { lon: 19.94, lat: 50.06 },
            { lon: 19.95, lat: 50.065 },
            { lon: 19.96, lat: 50.07 }
        ]);

        expect(tiles17.length).toBeGreaterThan(0);

        const uniqueKeys = new Set(tiles17.map(tile => `${tile.index_ne}:${tile.index_we}`));
        expect(uniqueKeys.size).toBe(tiles17.length);
    });

    test('includes tiles crossed between distant points without intermediate vertices', () => {
        const tiles17 = Tile17.collectForLineString([
            { lon: 19.9, lat: 50.05 },
            { lon: 20.1, lat: 50.2 }
        ]);

        expect(tiles17.length).toBeGreaterThan(1);
    });
});
