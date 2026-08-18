CREATE TABLE IF NOT EXISTS squadrats (
    id BIGSERIAL PRIMARY KEY,
    index_ne INTEGER NOT NULL,
    index_we INTEGER NOT NULL,
    min_lon DOUBLE PRECISION NOT NULL,
    max_lon DOUBLE PRECISION NOT NULL,
    min_lat DOUBLE PRECISION NOT NULL,
    max_lat DOUBLE PRECISION NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_squadrats_indexes UNIQUE (index_ne, index_we)
);

CREATE TABLE IF NOT EXISTS gpx_trail_squadrats (
    trail_id BIGINT NOT NULL REFERENCES gpx_trails(id) ON DELETE CASCADE,
    squadrat_id BIGINT NOT NULL REFERENCES squadrats(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (trail_id, squadrat_id)
);

CREATE INDEX IF NOT EXISTS idx_gpx_trail_squadrats_squadrat_id
    ON gpx_trail_squadrats (squadrat_id);
