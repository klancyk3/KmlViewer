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

CREATE TABLE IF NOT EXISTS app_users (
    id UUID PRIMARY KEY,
    display_name TEXT,
    first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    first_ip INET,
    last_ip INET,
    first_user_agent TEXT,
    last_user_agent TEXT
);

CREATE TABLE IF NOT EXISTS app_activity_events (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES app_users(id),
    action TEXT NOT NULL,
    from_ip INET,
    user_agent TEXT,
    path TEXT,
    method TEXT,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_app_activity_events_user_created ON app_activity_events (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_app_activity_events_action_created ON app_activity_events (action, created_at DESC);
