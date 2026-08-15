const { PostgresDatabase } = require('./postgresDatabase');

describe('PostgresDatabase', () => {
    test('reports unconfigured state without connection string', async () => {
        const database = new PostgresDatabase(null);

        await expect(database.getHealth()).resolves.toEqual({
            configured: false,
            connected: false,
            postgisVersion: null
        });
    });

    test('throws clear error when querying without configuration', () => {
        const database = new PostgresDatabase(null);

        expect(() => database.query('SELECT 1')).toThrow('Database is not configured');
    });
});
