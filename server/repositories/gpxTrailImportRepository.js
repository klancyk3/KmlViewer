const { Tile17 } = require('../domain/tile17');

class GpxTrailImportRepository {
    constructor(database, tile17Repository = null) {
        this.database = database;
        this.tile17Repository = tile17Repository;
    }

    async createRun(sourceDir) {
        const result = await this.database.query(
            'INSERT INTO gpx_import_runs (source_dir) VALUES ($1) RETURNING id',
            [sourceDir]
        );
        return result.rows[0].id;
    }

    async finishRun(runId, summary) {
        await this.database.query(
            `UPDATE gpx_import_runs
             SET finished_at = NOW(),
                 files_seen = $2,
                 files_imported = $3,
                 segments_imported = $4,
                 error = $5
             WHERE id = $1`,
            [
                runId,
                summary.filesSeen,
                summary.filesImported,
                summary.segmentsImported,
                summary.error || null
            ]
        );
    }

    async upsertTrailSegment(segment) {
        const result = await this.database.query(
            `INSERT INTO gpx_trails (
                source_file,
                source_file_name,
                region_key,
                region_name,
                trail_type,
                track_name,
                segment_index,
                point_count,
                length_m,
                colour,
                metadata,
                geom,
                imported_at
             )
             VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8,
                ST_Length(ST_GeomFromText($9, 4326)::geography),
                $10, $11::jsonb, ST_GeomFromText($9, 4326), NOW()
             )
             ON CONFLICT (source_file, segment_index)
             DO UPDATE SET
                source_file_name = EXCLUDED.source_file_name,
                region_key = EXCLUDED.region_key,
                region_name = EXCLUDED.region_name,
                trail_type = EXCLUDED.trail_type,
                track_name = EXCLUDED.track_name,
                point_count = EXCLUDED.point_count,
                length_m = EXCLUDED.length_m,
                colour = EXCLUDED.colour,
                metadata = EXCLUDED.metadata,
                geom = EXCLUDED.geom,
                imported_at = NOW()
             RETURNING id`,
            [
                segment.sourceFile,
                segment.sourceFileName,
                segment.regionKey,
                segment.regionName,
                segment.trailType,
                segment.trackName,
                segment.segmentIndex,
                segment.pointCount,
                segment.wkt,
                segment.colour,
                JSON.stringify(segment.metadata || {})
            ]
        );

        if (this.tile17Repository && Array.isArray(segment.coordinates) && segment.coordinates.length > 0) {
            await this.tile17Repository.saveTrailTiles17(
                result.rows[0].id,
                Tile17.collectForLineString(segment.coordinates, segment.trailType === 'user')
            );
        }

        return result.rows[0].id;
    }
}

module.exports = { GpxTrailImportRepository };
