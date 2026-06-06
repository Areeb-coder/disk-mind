using Dapper;
using Microsoft.Data.Sqlite;

namespace DiskMind.Core.Data;

public static class DbSchema
{
    public static void Initialize(SqliteConnection conn)
    {
        conn.Execute(@"
            CREATE TABLE IF NOT EXISTS scan_sessions (
                id TEXT PRIMARY KEY,
                root_path TEXT NOT NULL,
                started_at TEXT NOT NULL,
                completed_at TEXT,
                status TEXT NOT NULL DEFAULT 'running',
                files_scanned INTEGER DEFAULT 0,
                folders_scanned INTEGER DEFAULT 0,
                total_bytes INTEGER DEFAULT 0,
                error_message TEXT
            );

            CREATE TABLE IF NOT EXISTS scanned_files (
                id TEXT PRIMARY KEY,
                session_id TEXT NOT NULL,
                full_path TEXT NOT NULL,
                file_name TEXT NOT NULL,
                extension TEXT,
                size_bytes INTEGER DEFAULT 0,
                last_modified TEXT,
                category TEXT,
                is_duplicate INTEGER DEFAULT 0,
                duplicate_hash TEXT,
                FOREIGN KEY(session_id) REFERENCES scan_sessions(id)
            );

            CREATE INDEX IF NOT EXISTS idx_files_session ON scanned_files(session_id);
            CREATE INDEX IF NOT EXISTS idx_files_hash ON scanned_files(duplicate_hash);
            CREATE INDEX IF NOT EXISTS idx_files_category ON scanned_files(session_id, category);
            CREATE INDEX IF NOT EXISTS idx_files_path ON scanned_files(full_path);

            CREATE TABLE IF NOT EXISTS developer_storage (
                id TEXT PRIMARY KEY,
                session_id TEXT NOT NULL,
                tool_type TEXT NOT NULL,
                name TEXT NOT NULL,
                path TEXT,
                size_bytes INTEGER DEFAULT 0,
                details TEXT
            );

            CREATE TABLE IF NOT EXISTS gaming_storage (
                id TEXT PRIMARY KEY,
                session_id TEXT NOT NULL,
                platform TEXT,
                name TEXT NOT NULL,
                path TEXT,
                size_bytes INTEGER DEFAULT 0
            );

            CREATE TABLE IF NOT EXISTS application_analysis (
                id TEXT PRIMARY KEY,
                session_id TEXT NOT NULL,
                app_name TEXT NOT NULL,
                install_path TEXT,
                total_size_bytes INTEGER DEFAULT 0,
                cache_size_bytes INTEGER DEFAULT 0,
                last_used TEXT,
                category TEXT
            );

            CREATE TABLE IF NOT EXISTS duplicate_groups (
                id TEXT PRIMARY KEY,
                session_id TEXT NOT NULL,
                file_hash TEXT NOT NULL,
                file_count INTEGER DEFAULT 0,
                total_wasted_bytes INTEGER DEFAULT 0,
                file_size_bytes INTEGER DEFAULT 0
            );

            CREATE TABLE IF NOT EXISTS cleanup_executions (
                id TEXT PRIMARY KEY,
                executed_at TEXT NOT NULL,
                session_id TEXT,
                files_deleted INTEGER DEFAULT 0,
                bytes_freed INTEGER DEFAULT 0,
                rollback_path TEXT,
                status TEXT DEFAULT 'completed'
            );

            CREATE TABLE IF NOT EXISTS cleanup_items (
                id TEXT PRIMARY KEY,
                execution_id TEXT NOT NULL,
                original_path TEXT NOT NULL,
                backup_path TEXT,
                size_bytes INTEGER DEFAULT 0,
                status TEXT DEFAULT 'deleted'
            );
        ");
    }
}
