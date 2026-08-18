CREATE TABLE IF NOT EXISTS "Tiles17" (
    id BIGSERIAL PRIMARY KEY,
    index_ne INTEGER NOT NULL,
    index_we INTEGER NOT NULL,
    min_lon DOUBLE PRECISION NOT NULL,
    max_lon DOUBLE PRECISION NOT NULL,
    min_lat DOUBLE PRECISION NOT NULL,
    max_lat DOUBLE PRECISION NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_tiles17_indexes UNIQUE (index_ne, index_we)
);

CREATE TABLE IF NOT EXISTS "gpx_trail_Tiles17" (
    trail_id BIGINT NOT NULL REFERENCES gpx_trails(id) ON DELETE CASCADE,
    tile17_id BIGINT NOT NULL REFERENCES "Tiles17"(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (trail_id, tile17_id)
);

CREATE INDEX IF NOT EXISTS idx_gpx_trail_tiles17_tile17_id
    ON "gpx_trail_Tiles17" (tile17_id);
