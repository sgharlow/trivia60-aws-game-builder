-- Create health_checks table
CREATE TABLE IF NOT EXISTS health_checks (
    id SERIAL PRIMARY KEY,
    service_name VARCHAR(50) NOT NULL,
    status VARCHAR(20) NOT NULL,
    details JSONB NOT NULL,
    checked_at TIMESTAMP WITH TIME ZONE NOT NULL
);

-- Create index on service_name and checked_at for faster queries
CREATE INDEX IF NOT EXISTS idx_health_checks_service_time 
ON health_checks(service_name, checked_at);

-- Create index on status for faster filtering
CREATE INDEX IF NOT EXISTS idx_health_checks_status 
ON health_checks(status);

-- Create view for uptime statistics
CREATE OR REPLACE VIEW service_uptime AS
WITH stats AS (
    SELECT 
        service_name,
        COUNT(*) as total_checks,
        COUNT(*) FILTER (WHERE status = 'healthy') as healthy_checks,
        MIN(checked_at) as first_check,
        MAX(checked_at) as last_check
    FROM health_checks
    WHERE checked_at >= NOW() - INTERVAL '24 hours'
    GROUP BY service_name
)
SELECT 
    service_name,
    total_checks,
    healthy_checks,
    ROUND((healthy_checks::float / total_checks::float * 100)::numeric, 2) as uptime_percentage,
    first_check,
    last_check
FROM stats;
