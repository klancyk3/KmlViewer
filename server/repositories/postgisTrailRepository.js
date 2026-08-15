const SUPPORTED_TRAIL_TYPES = ['foot', 'hiking'];

class PostgisTrailRepository {
    constructor(database) {
        this.database = database;
    }

    async getRegions() {
        if (!this.database.isConfigured()) return [];

        const result = await this.database.query(`
            SELECT
                region_key AS key,
                region_name AS name,
                ARRAY_AGG(DISTINCT trail_type ORDER BY trail_type) AS types
            FROM gpx_trails
            WHERE region_key IS NOT NULL
              AND trail_type = ANY($1)
            GROUP BY region_key, region_name
            ORDER BY region_name
        `, [SUPPORTED_TRAIL_TYPES]);

        return result.rows.map(row => ({
            key: row.key,
            name: row.name,
            types: row.types
        }));
    }

    async getFeatures(regionKeys, trailTypes) {
        if (!this.database.isConfigured()) return {
            features: [],
            sourceCount: 0,
            totalKm: 0
        };

        const result = await this.database.query(`
            SELECT
                id,
                source_file,
                source_file_name,
                region_key,
                region_name,
                trail_type,
                track_name,
                segment_index,
                length_m,
                colour,
                ST_AsGeoJSON(geom)::json AS geometry
            FROM gpx_trails
            WHERE region_key = ANY($1)
              AND trail_type = ANY($2)
            ORDER BY region_name, trail_type, source_file, segment_index
        `, [regionKeys, trailTypes]);

        const sourceFiles = new Set();
        let totalKm = 0;
        const features = result.rows.map(row => {
            sourceFiles.add(row.source_file);
            totalKm += Number(row.length_m || 0) / 1000;

            return {
                type: 'trail_gpx',
                name: `${row.region_name} ${row.trail_type}: ${row.track_name || row.source_file_name}`,
                trailRegion: row.region_key,
                trailType: row.trail_type,
                sourceFile: row.source_file,
                geometries: [{
                    type: 'LineString',
                    coordinates: row.geometry.coordinates.map(([lon, lat]) => ({ lon, lat }))
                }],
                style: {
                    strokeColor: this.colorNameToCss(row.colour) || (row.trail_type === 'hiking' ? '#22c55e' : '#f97316'),
                    strokeWidth: row.trail_type === 'hiking' ? 3 : 2,
                    fillColor: this.colorNameToCss(row.colour) || (row.trail_type === 'hiking' ? '#22c55e' : '#f97316'),
                    radius: 3
                }
            };
        });

        return {
            features,
            sourceCount: sourceFiles.size,
            totalKm
        };
    }

    colorNameToCss(value) {
        if (!value) return null;

        const normalized = value.trim().toLowerCase();
        const namedColors = {
            black: '#111827',
            blue: '#2563eb',
            brown: '#92400e',
            green: '#16a34a',
            grey: '#6b7280',
            gray: '#6b7280',
            orange: '#f97316',
            purple: '#9333ea',
            red: '#dc2626',
            violet: '#7c3aed',
            white: '#f8fafc',
            yellow: '#eab308'
        };

        if (/^#[0-9a-f]{3,8}$/i.test(normalized)) return normalized;

        return namedColors[normalized] || null;
    }
}

module.exports = { SUPPORTED_TRAIL_TYPES, PostgisTrailRepository };
