const { PostgisTrailRepository } = require('./postgisTrailRepository');

function createDatabaseMock(rowsByQuery) {
    return {
        isConfigured: () => true,
        query: jest.fn(async sql => {
            const key = sql.includes('GROUP BY region_key') ? 'regions' : 'features';
            return { rows: rowsByQuery[key] || [] };
        })
    };
}

describe('PostgisTrailRepository', () => {
    test('returns regions from gpx_trails', async () => {
        const database = createDatabaseMock({
            regions: [{
                key: 'slaskie-260813',
                name: 'slaskie',
                types: ['foot', 'hiking']
            }]
        });
        const repository = new PostgisTrailRepository(database);

        await expect(repository.getRegions()).resolves.toEqual([{
            key: 'slaskie-260813',
            name: 'slaskie',
            types: ['foot', 'hiking']
        }]);
    });

    test('maps PostGIS rows to canvas features', async () => {
        const database = createDatabaseMock({
            features: [{
                source_file: 'slaskie-260813/hiking/a.gpx',
                source_file_name: 'a.gpx',
                region_key: 'slaskie-260813',
                region_name: 'slaskie',
                trail_type: 'hiking',
                track_name: 'Blue Trail',
                length_m: 1234,
                colour: 'blue',
                geometry: {
                    type: 'LineString',
                    coordinates: [[19, 50], [20, 51]]
                }
            }]
        });
        const repository = new PostgisTrailRepository(database);

        const result = await repository.getFeatures(['slaskie-260813'], ['hiking']);

        expect(result.sourceCount).toBe(1);
        expect(result.totalKm).toBe(1.234);
        expect(result.features[0]).toMatchObject({
            type: 'trail_gpx',
            name: 'slaskie hiking: Blue Trail',
            trailRegion: 'slaskie-260813',
            trailType: 'hiking',
            style: {
                strokeColor: '#2563eb',
                fillColor: '#2563eb'
            },
            geometries: [{
                type: 'LineString',
                coordinates: [{ lon: 19, lat: 50 }, { lon: 20, lat: 51 }]
            }]
        });
    });

    test('returns empty payload when database is not configured', async () => {
        const repository = new PostgisTrailRepository({ isConfigured: () => false });

        await expect(repository.getFeatures(['x'], ['hiking'])).resolves.toEqual({
            features: [],
            sourceCount: 0,
            totalKm: 0
        });
    });
});
