-- Link audit logs to the request-scoped correlation ID (see
-- src/common/tracing/tracing-context.ts) so a single trace ID can be used to
-- pull up every audit record written during a request, on-chain event, or
-- background job, alongside the log lines.
ALTER TABLE "audit_logs" ADD COLUMN "correlation_id" TEXT;

CREATE INDEX "audit_logs_correlation_id_idx" ON "audit_logs"("correlation_id");
