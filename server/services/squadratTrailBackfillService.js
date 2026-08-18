const { Squadrat } = require('../domain/squadrat');

class SquadratTrailBackfillService {
    constructor(squadratRepository) {
        this.squadratRepository = squadratRepository;
    }

    async backfill() {
        const trails = await this.squadratRepository.getTrailGeometries();
        let processedTrails = 0;
        let linkedSquadrats = 0;

        for (const trail of trails) {
            const squadrats = this.collectSquadratsForGeometry(trail.geometry);
            await this.squadratRepository.saveTrailSquadrats(trail.id, squadrats);
            processedTrails += 1;
            linkedSquadrats += squadrats.length;
        }

        return {
            processedTrails,
            linkedSquadrats
        };
    }

    collectSquadratsForGeometry(geometry) {
        if (!geometry) return [];
        if (geometry.type === 'LineString') {
            return Squadrat.collectForLineString(
                geometry.coordinates.map(([lon, lat]) => ({ lon, lat }))
            );
        }

        if (geometry.type === 'MultiLineString') {
            const unique = new Map();

            geometry.coordinates.forEach(line => {
                Squadrat.collectForLineString(line.map(([lon, lat]) => ({ lon, lat }))).forEach(squadrat => {
                    unique.set(`${squadrat.index_ne}:${squadrat.index_we}`, squadrat);
                });
            });

            return Array.from(unique.values()).sort(
                (a, b) => a.index_ne - b.index_ne || a.index_we - b.index_we
            );
        }

        return [];
    }
}

module.exports = { SquadratTrailBackfillService };
