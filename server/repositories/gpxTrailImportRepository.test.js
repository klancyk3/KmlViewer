const { GpxTrailImportRepository } = require('./gpxTrailImportRepository');

describe('GpxTrailImportRepository', () => {
    test('saves Tile17 records for imported segment when Tile17 repository is provided', async () => {
        const database = {
            query: jest.fn().mockResolvedValue({
                rows: [{ id: 123 }]
            })
        };
        const tile17Repository = {
            saveTrailTiles17: jest.fn().mockResolvedValue(undefined)
        };
        const repository = new GpxTrailImportRepository(database, tile17Repository);

        const segment = {
            sourceFile: 'user/2024/activity.tcx',
            sourceFileName: 'activity.tcx',
            regionKey: 'user-routes',
            regionName: 'Trasy użytkownika',
            trailType: 'user',
            trackName: 'run',
            segmentIndex: 0,
            pointCount: 2,
            coordinates: [
                { lon: 19.1, lat: 50.1 },
                { lon: 19.2, lat: 50.2 }
            ],
            wkt: 'LINESTRING(19.1 50.1,19.2 50.2)',
            colour: null,
            metadata: { sport: 'Running' }
        };

        await repository.upsertTrailSegment(segment);

        expect(database.query).toHaveBeenCalledTimes(1);
        expect(tile17Repository.saveTrailTiles17).toHaveBeenCalledTimes(1);
        expect(tile17Repository.saveTrailTiles17.mock.calls[0][0]).toBe(123);
        expect(tile17Repository.saveTrailTiles17.mock.calls[0][1].length).toBeGreaterThan(0);
    });
});
