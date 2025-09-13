-- Create slot_search_logs table for logging search operations
CREATE TABLE IF NOT EXISTS slot_search_logs (
  id SERIAL PRIMARY KEY,
  level VARCHAR(10) NOT NULL CHECK (level IN ('DEBUG', 'INFO', 'WARN', 'ERROR')),
  message TEXT NOT NULL,
  context VARCHAR(100),
  meta JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_slot_search_logs_level ON slot_search_logs(level);
CREATE INDEX IF NOT EXISTS idx_slot_search_logs_created_at ON slot_search_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_slot_search_logs_user_id ON slot_search_logs USING GIN ((meta->>'userId'));
CREATE INDEX IF NOT EXISTS idx_slot_search_logs_task_id ON slot_search_logs USING GIN ((meta->>'taskId'));
CREATE INDEX IF NOT EXISTS idx_slot_search_logs_run_id ON slot_search_logs USING GIN ((meta->>'runId'));

-- Create a function to clean up old logs (older than 30 days)
CREATE OR REPLACE FUNCTION cleanup_old_logs()
RETURNS void AS $$
BEGIN
  DELETE FROM slot_search_logs 
  WHERE created_at < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql;

-- Create a scheduled job to clean up old logs (if pg_cron is available)
-- SELECT cron.schedule('cleanup-logs', '0 2 * * *', 'SELECT cleanup_old_logs();');
