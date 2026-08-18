const { Tile17 } = require('../domain/tile17');

class Tile17BackfillService {
    constructor(tile17Repository) {
        this.tile17Repository = tile17Repository;
    }

    async backfill() {
        const trails = await this.tile17Repository.getTrailGeometries();
        let processedTrails = 0;
        let linkedTiles17 = 0;

        for (const trail of trails) {
            const tiles17 = this.collectTiles17ForGeometry(trail.geometry);
            await this.tile17Repository.saveTrailTiles17(trail.id, tiles17);
            processedTrails += 1;
            linkedTiles17 += tiles17.length;
        }

        return {
            processedTrails,
            linkedTiles17
        };
    }

    collectTiles17ForGeometry(geometry) {
        if (!geometry) return [];
        if (geometry.type === 'LineString') {
            return Tile17.collectForLineString(
                geometry.coordinates.map(([lon, lat]) => ({ lon, lat }))
            );
        }

        if (geometry.type === 'MultiLineString') {
            const unique = new Map();

            geometry.coordinates.forEach(line => {
                Tile17.collectForLineString(line.map(([lon, lat]) => ({ lon, lat }))).forEach(tile17 => {
                    unique.set(`${tile17.index_ne}:${tile17.index_we}`, tile17);
                });
            });

            return Array.from(unique.values()).sort(
                (a, b) => a.index_ne - b.index_ne || a.index_we - b.index_we
            );
        }

        return [];
    }
}

module.exports = { Tile17BackfillService };
