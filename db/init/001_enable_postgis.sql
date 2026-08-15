CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS postgis_topology;

CREATE TABLE IF NOT EXISTS gpx_import_runs (
    id BIGSERIAL PRIMARY KEY,
    source_dir TEXT NOT NULL,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    finished_at TIMESTAMPTZ,
    files_seen INTEGER NOT NULL DEFAULT 0,
    files_imported INTEGER NOT NULL DEFAULT 0,
    segments_imported INTEGER NOT NULL DEFAULT 0,
    error TEXT
);

CREATE TABLE IF NOT EXISTS gpx_trails (
    id BIGSERIAL PRIMARY KEY,
    source_file TEXT NOT NULL,
    source_file_name TEXT NOT NULL,
    region_key TEXT,
    region_name TEXT,
    trail_type TEXT,
    track_name TEXT,
    segment_index INTEGER NOT NULL,
    point_count INTEGER NOT NULL,
    length_m DOUBLE PRECISION NOT NULL,
    colour TEXT,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    geom geometry(LineString, 4326) NOT NULL,
    imported_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_gpx_trails_source_segment UNIQUE (source_file, segment_index)
);

CREATE INDEX IF NOT EXISTS idx_gpx_trails_geom ON gpx_trails USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_gpx_trails_region_type ON gpx_trails (region_key, trail_type);
