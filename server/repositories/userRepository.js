class UserRepository {
    constructor(database) {
        this.database = database;
    }

    async upsertUser(context) {
        if (!this.database.isConfigured()) return null;

        await this.database.query(
            `INSERT INTO app_users (
                id,
                first_ip,
                last_ip,
                first_user_agent,
                last_user_agent
             )
             VALUES ($1, $2::inet, $2::inet, $3, $3)
             ON CONFLICT (id)
             DO UPDATE SET
                last_seen_at = NOW(),
                last_ip = EXCLUDED.last_ip,
                last_user_agent = EXCLUDED.last_user_agent`,
            [context.userId, context.ipAddress, context.userAgent]
        );

        return context.userId;
    }

    async logEvent(context, action, metadata = {}) {
        if (!this.database.isConfigured()) return;

        await this.database.query(
            `INSERT INTO app_activity_events (
                user_id,
                action,
                from_ip,
                user_agent,
                path,
                method,
                metadata
             )
             VALUES ($1, $2, $3::inet, $4, $5, $6, $7::jsonb)`,
            [
                context.userId,
                action,
                context.ipAddress,
                context.userAgent,
                context.path,
                context.method,
                JSON.stringify(metadata)
            ]
        );
    }
}

module.exports = { UserRepository };
