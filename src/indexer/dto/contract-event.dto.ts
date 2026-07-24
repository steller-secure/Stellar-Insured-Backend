import { z } from 'zod';

/**
 * Zod schema for contract event data
 */
export const ContractEventSchema = z.object({
  eventId: z.string(),
  ledgerSeq: z.number(),
  ledgerClosedAt: z.coerce.date(),
  contractId: z.string(),
  eventType: z.string(),
  transactionHash: z.string(),
  data: z.record(z.string(), z.unknown()),
  quarantined: z.boolean().optional(),
  inSuccessfulContractCall: z.boolean(),
});

export type ContractEventDto = z.infer<typeof ContractEventSchema>;

/**
 * Zod schema for a quarantined (undecodable) event persisted for inspection.
 */
export const QuarantinedEventSchema = z.object({
  eventId: z.string(),
  network: z.string(),
  contractId: z.string(),
  eventType: z.string(),
  ledgerSeq: z.number(),
  transactionHash: z.string(),
  rawXdr: z.string(),
  reason: z.string(),
});

export type QuarantinedEventDto = z.infer<typeof QuarantinedEventSchema>;

/**
 * Zod schema for event query parameters
 */
export const EventQuerySchema = z.object({
  startLedger: z.number().optional(),
  endLedger: z.number().optional(),
  contractId: z.string().optional(),
  eventType: z.string().optional(),
  limit: z.number().optional(),
  cursor: z.string().optional(),
});

export type EventQueryDto = z.infer<typeof EventQuerySchema>;

/**
 * Zod schema for ledger cursor update
 */
export const UpdateLedgerCursorSchema = z.object({
  network: z.string(),
  lastLedgerSeq: z.number(),
  lastLedgerHash: z.string().optional(),
});

export type UpdateLedgerCursorDto = z.infer<typeof UpdateLedgerCursorSchema>;

/**
 * Zod schema for processed event tracking
 */
export const ProcessedEventSchema = z.object({
  eventId: z.string(),
  network: z.string(),
  ledgerSeq: z.number(),
  contractId: z.string(),
  eventType: z.string(),
  transactionHash: z.string(),
});

export type ProcessedEventDto = z.infer<typeof ProcessedEventSchema>;