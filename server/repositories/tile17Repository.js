class Tile17Repository {
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

    async getTilesInBounds(bounds) {
        const result = await this.database.query(
            `SELECT
                t.id,
                t.index_ne,
                t.index_we,
                t.min_lon,
                t.max_lon,
                t.min_lat,
                t.max_lat,
                BOOL_OR(gt.trail_type = 'user') AS has_user_route,
                BOOL_OR(gt.trail_type <> 'user') AS has_trail_route
             FROM "Tiles17" t
             JOIN "gpx_trail_Tiles17" gt17 ON gt17.tile17_id = t.id
             JOIN gpx_trails gt ON gt.id = gt17.trail_id
             WHERE t.max_lon >= $1
               AND t.min_lon <= $2
               AND t.max_lat >= $3
               AND t.min_lat <= $4
             GROUP BY
                t.id,
                t.index_ne,
                t.index_we,
                t.min_lon,
                t.max_lon,
                t.min_lat,
                t.max_lat
             ORDER BY t.index_ne, t.index_we`,
            [bounds.minLon, bounds.maxLon, bounds.minLat, bounds.maxLat]
        );

        return result.rows;
    }

    async getTileDetails(indexWe, indexNe) {
        const result = await this.database.query(
            `SELECT
                gt.id AS trail_id,
                gt.trail_type,
                gt.track_name,
                gt.source_file_name,
                gt.imported_at,
                gt.colour,
                gt.metadata
             FROM "Tiles17" t
             JOIN "gpx_trail_Tiles17" gt17 ON gt17.tile17_id = t.id
             JOIN gpx_trails gt ON gt.id = gt17.trail_id
             WHERE t.index_we = $1
               AND t.index_ne = $2
             ORDER BY
                CASE WHEN gt.trail_type = 'user' THEN 1 ELSE 0 END,
                gt.track_name,
                gt.source_file_name`,
            [indexWe, indexNe]
        );

        const trails = [];
        const userRoutes = [];

        result.rows.forEach(row => {
            const metadata = row.metadata || {};

            if (row.trail_type === 'user') {
                userRoutes.push({
                    trailId: row.trail_id,
                    recordedAt: this.resolveRecordedAt(row.track_name, row.imported_at),
                    activityType: metadata.sport || metadata.activityType || metadata.activity_type || 'Unknown',
                    name: row.track_name || row.source_file_name
                });
                return;
            }

            trails.push({
                trailId: row.trail_id,
                name: row.track_name || row.source_file_name,
                color: this.resolveTrailColor(row.colour, metadata)
            });
        });

        return { trails, userRoutes };
    }

    async getTilesForTrail(trailId) {
        const result = await this.database.query(
            `SELECT
                t.id,
                t.index_ne,
                t.index_we,
                t.min_lon,
                t.max_lon,
                t.min_lat,
                t.max_lat
             FROM "Tiles17" t
             JOIN "gpx_trail_Tiles17" gt17 ON gt17.tile17_id = t.id
             WHERE gt17.trail_id = $1
             ORDER BY t.index_ne, t.index_we`,
            [trailId]
        );

        return result.rows;
    }

    resolveTrailColor(colour, metadata) {
        return colour || metadata.colour || metadata.color || '#94a3b8';
    }

    resolveRecordedAt(trackName, importedAt) {
        const parsedTrackName = Date.parse(trackName);
        if (Number.isFinite(parsedTrackName)) {
            return new Date(parsedTrackName).toISOString();
        }

        return importedAt ? new Date(importedAt).toISOString() : null;
    }

    async saveTrailTiles17(trailId, tiles17) {
        await this.database.withTransaction(async client => {
            await client.query('DELETE FROM "gpx_trail_Tiles17" WHERE trail_id = $1', [trailId]);

            for (const tile17 of tiles17) {
                const tile17Result = await client.query(
                    `INSERT INTO "Tiles17" (
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
                        tile17.index_ne,
                        tile17.index_we,
                        tile17.min_lon,
                        tile17.max_lon,
                        tile17.min_lat,
                        tile17.max_lat
                    ]
                );

                await client.query(
                    `INSERT INTO "gpx_trail_Tiles17" (trail_id, tile17_id)
                     VALUES ($1, $2)
                     ON CONFLICT (trail_id, tile17_id) DO NOTHING`,
                    [trailId, tile17Result.rows[0].id]
                );
            }
        });
    }
}

module.exports = { Tile17Repository };
