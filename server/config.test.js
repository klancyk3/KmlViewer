const { createConfig } = require('./config');

describe('createConfig', () => {
    test('reads database url from environment', () => {
        const config = createConfig({
            PORT: '9999',
            EXTERNAL_GPX_DIR: '/maps/gpx',
            DATABASE_URL: 'postgres://user:pass@host:5432/db'
        });

        expect(config.port).toBe('9999');
        expect(config.externalGpxDir).toBe('/maps/gpx');
        expect(config.databaseUrl).toBe('postgres://user:pass@host:5432/db');
    });

    test('keeps database optional for local non-docker runs', () => {
        expect(createConfig({}).databaseUrl).toBe(null);
    });
});
