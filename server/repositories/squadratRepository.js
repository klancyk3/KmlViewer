class SquadratRepository {
    constructor(database) {
        this.database = database;
    }

    async getTrailGeometries() {
        const result = await this.database.query(`
            SELECT
                id,
                ST_AsGeoJSON(geom)::json AS geometry
            FROM gpx_trails
            ORDER BY id
        `);

        return result.rows.map(row => ({
            id: row.id,
            geometry: row.geometry
        }));
    }

    async saveTrailSquadrats(trailId, squadrats) {
        await this.database.withTransaction(async client => {
            await client.query('DELETE FROM gpx_trail_squadrats WHERE trail_id = $1', [trailId]);

            for (const squadrat of squadrats) {
                const squadratResult = await client.query(
                    `INSERT INTO squadrats (
                        index_ne,
                        index_we,
                        min_lon,
                        max_lon,
                        min_lat,
                        max_lat
                    )
                    VALUES ($1, $2, $3, $4, $5, $6)
                    ON CONFLICT (index_ne, index_we)
                    DO UPDATE SET
                        min_lon = EXCLUDED.min_lon,
                        max_lon = EXCLUDED.max_lon,
                        min_lat = EXCLUDED.min_lat,
                        max_lat = EXCLUDED.max_lat
                    RETURNING id`,
                    [
                        squadrat.index_ne,
                        squadrat.index_we,
                        squadrat.min_lon,
                        squadrat.max_lon,
                        squadrat.min_lat,
                        squadrat.max_lat
                    ]
                );

                await client.query(
                    `INSERT INTO gpx_trail_squadrats (trail_id, squadrat_id)
                     VALUES ($1, $2)
                     ON CONFLICT (trail_id, squadrat_id) DO NOTHING`,
                    [trailId, squadratResult.rows[0].id]
                );
            }
        });
    }
}

module.exports = { SquadratRepository };
