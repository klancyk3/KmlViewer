const { Pool } = require('pg');

class PostgresDatabase {
    constructor(connectionString) {
        this.connectionString = connectionString;
        this.pool = connectionString ? new Pool({ connectionString }) : null;
    }

    isConfigured() {
        return Boolean(this.pool);
    }

    async getHealth() {
        if (!this.pool) {
            return {
                configured: false,
                connected: false,
                postgisVersion: null
            };
        }

        const result = await this.pool.query(`
            SELECT
                version() AS postgres_version,
                postgis_full_version() AS postgis_version
        `);

        return {
            configured: true,
            connected: true,
            postgresVersion: result.rows[0].postgres_version,
            postgisVersion: result.rows[0].postgis_version
        };
    }

    query(sql, params = []) {
        if (!this.pool) {
            throw new Error('Database is not configured');
        }

        return this.pool.query(sql, params);
    }

    async withTransaction(callback) {
        if (!this.pool) {
            throw new Error('Database is not configured');
        }

        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');
            const result = await callback(client);
            await client.query('COMMIT');
            return result;
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }
}

module.exports = { PostgresDatabase };
