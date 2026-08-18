const SUPPORTED_TRAIL_TYPES = ['foot', 'hiking'];
const USER_ROUTE_REGION_KEY = 'user-routes';
const USER_ROUTE_TRAIL_TYPE = 'user';

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

    async getFeatures(regionKeys, trailTypes, bounds = null) {
        if (!this.database.isConfigured()) return {
            features: [],
            sourceCount: 0,
            totalKm: 0
        };

        const params = [regionKeys, trailTypes];
        const boundsClause = bounds
            ? `
              AND ST_Intersects(
                    geom,
                    ST_MakeEnvelope($3, $4, $5, $6, 4326)
                  )`
            : '';

        if (bounds) {
            params.push(bounds.minLon, bounds.minLat, bounds.maxLon, bounds.maxLat);
        }

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
                metadata,
                ST_AsGeoJSON(geom)::json AS geometry
            FROM gpx_trails
            WHERE region_key = ANY($1)
              AND trail_type = ANY($2)
              ${boundsClause}
            ORDER BY region_name, trail_type, source_file, segment_index
        `, params);

        const sourceFiles = new Set();
        let totalKm = 0;
        const features = result.rows.map(row => {
            sourceFiles.add(row.source_file);
            totalKm += Number(row.length_m || 0) / 1000;

            return {
                trailId: row.id,
                type: 'trail_gpx',
                name: `${row.region_name} ${row.trail_type}: ${row.track_name || row.source_file_name}`,
                trailRegion: row.region_key,
                trailType: row.trail_type,
                sourceFile: row.source_file,
                sourceFileName: row.source_file_name,
                segmentIndex: row.segment_index,
                lengthKm: Number(row.length_m || 0) / 1000,
                metadata: row.metadata || {},
                geometries: [{
                    type: 'LineString',
                    coordinates: row.geometry.coordinates.map(([lon, lat]) => ({ lon, lat }))
                }],
                style: {
                    strokeColor: this.colorNameToCss(row.colour) || this.getFallbackColor(row.trail_type),
                    strokeWidth: row.trail_type === USER_ROUTE_TRAIL_TYPE ? 4 : row.trail_type === 'hiking' ? 3 : 2,
                    fillColor: this.colorNameToCss(row.colour) || this.getFallbackColor(row.trail_type),
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

    async getUserRoutes() {
        return this.getFeatures([USER_ROUTE_REGION_KEY], [USER_ROUTE_TRAIL_TYPE]);
    }

    async getUserRoutesInBounds(bounds) {
        return this.getFeatures([USER_ROUTE_REGION_KEY], [USER_ROUTE_TRAIL_TYPE], bounds);
    }

    getFallbackColor(trailType) {
        if (trailType === USER_ROUTE_TRAIL_TYPE) return '#38bdf8';
        return trailType === 'hiking' ? '#22c55e' : '#f97316';
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

module.exports = {
    SUPPORTED_TRAIL_TYPES,
    USER_ROUTE_REGION_KEY,
    USER_ROUTE_TRAIL_TYPE,
    PostgisTrailRepository
};
