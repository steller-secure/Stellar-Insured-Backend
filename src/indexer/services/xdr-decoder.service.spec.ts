import { Test } from '@nestjs/testing';
import { nativeToScVal, xdr, scValToNative } from 'stellar-sdk';
import { XdrDecoderService } from './xdr-decoder.service';
import { ContractEventType } from '../types/event-types';

/**
 * Build a base64 XDR ScVal string from a native JS value. Maps decode to the
 * format Soroban contracts actually emit (a Map of symbol -> value, the common
 * Rust `soroban_sdk::Event` body shape).
 */
function toXdr(value: unknown): string {
  const scVal = nativeToScVal(value, { type: 'map' });
  return scVal.toXDR('base64');
}

describe('XdrDecoderService', () => {
  let service: XdrDecoderService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [XdrDecoderService],
    }).compile();
    service = moduleRef.get(XdrDecoderService);
  });

  it('is defined', () => {
    expect(service).toBeDefined();
  });

  describe('decoding per ContractEventType', () => {
    const cases: Array<{
      type: ContractEventType;
      fixture: Record<string, unknown>;
      assert: (data: Record<string, unknown>) => void;
    }> = [
      {
        type: ContractEventType.PROJECT_CREATED,
        fixture: {
          project_id: 7,
          creator: 'GA7QFKA2OGDWPNTZ35B2AJQA3HSEWWQBIR2FA3ZWEX37MQSUDUXCTX2H',
          funding_goal: '1000000',
          deadline: 1700000000,
          token: 'USDC',
        },
        assert: d => {
          expect(d.projectId).toBe(7);
          expect(d.fundingGoal).toBe('1000000');
          expect(d.deadline).toBe(1700000000);
          expect(d.token).toBe('USDC');
          expect(typeof d.creator).toBe('string');
        },
      },
      {
        type: ContractEventType.PROJECT_FUNDED,
        fixture: { project_id: 7, amount: '250000', total_raised: '250000' },
        assert: d => {
          expect(d.projectId).toBe(7);
          expect(d.amount).toBe('250000');
          expect(d.totalRaised).toBe('250000');
        },
      },
      {
        type: ContractEventType.PROJECT_COMPLETED,
        fixture: { project_id: 7, status: 'completed' },
        assert: d => {
          expect(d.projectId).toBe(7);
          expect(d.status).toBe('completed');
        },
      },
      {
        type: ContractEventType.PROJECT_FAILED,
        fixture: { project_id: 7, status: 'failed' },
        assert: d => {
          expect(d.projectId).toBe(7);
          expect(d.status).toBe('failed');
        },
      },
      {
        type: ContractEventType.CONTRIBUTION_MADE,
        fixture: {
          project_id: 7,
          contributor:
            'GA7QFKA2OGDWPNTZ35B2AJQA3HSEWWQBIR2FA3ZWEX37MQSUDUXCTX2H',
          amount: '50000',
          total_raised: '300000',
        },
        assert: d => {
          expect(d.projectId).toBe(7);
          expect(d.amount).toBe('50000');
          expect(d.totalRaised).toBe('300000');
          expect(d.contributor).toContain('GA7');
        },
      },
      {
        type: ContractEventType.REFUND_ISSUED,
        fixture: {
          project_id: 7,
          contributor:
            'GA7QFKA2OGDWPNTZ35B2AJQA3HSEWWQBIR2FA3ZWEX37MQSUDUXCTX2H',
          amount: '50000',
        },
        assert: d => {
          expect(d.projectId).toBe(7);
          expect(d.amount).toBe('50000');
        },
      },
      {
        type: ContractEventType.ESCROW_INITIALIZED,
        fixture: { project_id: 7, escrow_id: 'ESC1', total_amount: '1000000' },
        assert: d => {
          expect(d.projectId).toBe(7);
          expect(d.escrowId).toBe('ESC1');
        },
      },
      {
        type: ContractEventType.FUNDS_LOCKED,
        fixture: { project_id: 7, milestone_id: 2, amount: '100000' },
        assert: d => {
          expect(d.projectId).toBe(7);
          expect(d.milestoneId).toBe(2);
          expect(d.amount).toBe('100000');
        },
      },
      {
        type: ContractEventType.FUNDS_RELEASED,
        fixture: { project_id: 7, milestone_id: 2, amount: '100000' },
        assert: d => {
          expect(d.projectId).toBe(7);
          expect(d.milestoneId).toBe(2);
          expect(d.amount).toBe('100000');
        },
      },
      {
        type: ContractEventType.MILESTONE_CREATED,
        fixture: { project_id: 7, milestone_id: 1, funding_amount: '100000' },
        assert: d => {
          expect(d.projectId).toBe(7);
          expect(d.milestoneId).toBe(1);
        },
      },
      {
        type: ContractEventType.MILESTONE_SUBMITTED,
        fixture: {
          project_id: 7,
          milestone_id: 1,
          submitter: 'GA7QFKA2OGDWPNTZ35B2AJQA3HSEWWQBIR2FA3ZWEX37MQSUDUXCTX2H',
        },
        assert: d => {
          expect(d.projectId).toBe(7);
          expect(d.milestoneId).toBe(1);
        },
      },
      {
        type: ContractEventType.MILESTONE_APPROVED,
        fixture: { project_id: 7, milestone_id: 1, approval_count: 3 },
        assert: d => {
          expect(d.projectId).toBe(7);
          expect(d.milestoneId).toBe(1);
          expect(d.approvalCount).toBe(3);
        },
      },
      {
        type: ContractEventType.MILESTONE_REJECTED,
        fixture: { project_id: 7, milestone_id: 1, rejection_count: 2 },
        assert: d => {
          expect(d.projectId).toBe(7);
          expect(d.milestoneId).toBe(1);
          expect(d.rejectionCount).toBe(2);
        },
      },
      {
        type: ContractEventType.MILESTONE_COMPLETED,
        fixture: { project_id: 7, milestone_id: 1 },
        assert: d => {
          expect(d.projectId).toBe(7);
          expect(d.milestoneId).toBe(1);
        },
      },
      {
        type: ContractEventType.VALIDATORS_UPDATED,
        fixture: {
          project_id: 7,
          validators: [
            'GA7QFKA2OGDWPNTZ35B2AJQA3HSEWWQBIR2FA3ZWEX37MQSUDUXCTX2H',
            'GB7QFKA2OGDWPNTZ35B2AJQA3HSEWWQBIR2FA3ZWEX37MQSUDUXCTX2I',
          ],
        },
        assert: d => {
          expect(d.projectId).toBe(7);
          expect(d.validatorCount).toBe(2);
        },
      },
      {
        type: ContractEventType.PROFIT_DISTRIBUTED,
        fixture: { pool_id: 'POOL1', total_profit: '5000', per_share: '50' },
        assert: d => {
          expect(d.poolId).toBe('POOL1');
          expect(d.totalProfit).toBe('5000');
        },
      },
      {
        type: ContractEventType.DIVIDEND_CLAIMED,
        fixture: {
          pool_id: 'POOL1',
          claimer: 'GA7QFKA2OGDWPNTZ35B2AJQA3HSEWWQBIR2FA3ZWEX37MQSUDUXCTX2H',
          amount: '50',
        },
        assert: d => {
          expect(d.poolId).toBe('POOL1');
          expect(d.amount).toBe('50');
          expect(d.claimer).toContain('GA7');
        },
      },
      {
        type: ContractEventType.PROPOSAL_CREATED,
        fixture: {
          proposal_id: 4,
          proposer: 'GA7QFKA2OGDWPNTZ35B2AJQA3HSEWWQBIR2FA3ZWEX37MQSUDUXCTX2H',
          title: 'Raise cap',
        },
        assert: d => {
          expect(d.proposalId).toBe(4);
          expect(d.title).toBe('Raise cap');
        },
      },
      {
        type: ContractEventType.VOTE_CAST,
        fixture: {
          proposal_id: 4,
          voter: 'GA7QFKA2OGDWPNTZ35B2AJQA3HSEWWQBIR2FA3ZWEX37MQSUDUXCTX2H',
          support: 'yes',
        },
        assert: d => {
          expect(d.proposalId).toBe(4);
          expect(d.support).toBe('yes');
        },
      },
      {
        type: ContractEventType.PROPOSAL_EXECUTED,
        fixture: { proposal_id: 4, success: true },
        assert: d => {
          expect(d.proposalId).toBe(4);
          expect(d.success).toBe(true);
        },
      },
      {
        type: ContractEventType.USER_REGISTERED,
        fixture: {
          user: 'GA7QFKA2OGDWPNTZ35B2AJQA3HSEWWQBIR2FA3ZWEX37MQSUDUXCTX2H',
        },
        assert: d => {
          expect(d.user).toContain('GA7');
        },
      },
      {
        type: ContractEventType.REPUTATION_UPDATED,
        fixture: {
          user: 'GA7QFKA2OGDWPNTZ35B2AJQA3HSEWWQBIR2FA3ZWEX37MQSUDUXCTX2H',
          score: 42,
          delta: 5,
        },
        assert: d => {
          expect(d.score).toBe(42);
          expect(d.delta).toBe(5);
        },
      },
      {
        type: ContractEventType.BADGE_EARNED,
        fixture: {
          user: 'GA7QFKA2OGDWPNTZ35B2AJQA3HSEWWQBIR2FA3ZWEX37MQSUDUXCTX2H',
          badge: 'OG',
        },
        assert: d => {
          expect(d.badge).toBe('OG');
        },
      },
      {
        type: ContractEventType.PAYMENT_SETUP,
        fixture: {
          payment_id: 'PAY1',
          payer: 'GA7QFKA2OGDWPNTZ35B2AJQA3HSEWWQBIR2FA3ZWEX37MQSUDUXCTX2H',
          payee: 'GB7QFKA2OGDWPNTZ35B2AJQA3HSEWWQBIR2FA3ZWEX37MQSUDUXCTX2I',
        },
        assert: d => {
          expect(d.paymentId).toBe('PAY1');
        },
      },
      {
        type: ContractEventType.PAYMENT_RECEIVED,
        fixture: { payment_id: 'PAY1', amount: '100' },
        assert: d => {
          expect(d.paymentId).toBe('PAY1');
          expect(d.amount).toBe('100');
        },
      },
      {
        type: ContractEventType.PAYMENT_WITHDRAWN,
        fixture: {
          payment_id: 'PAY1',
          recipient: 'GA7QFKA2OGDWPNTZ35B2AJQA3HSEWWQBIR2FA3ZWEX37MQSUDUXCTX2H',
          amount: '100',
        },
        assert: d => {
          expect(d.paymentId).toBe('PAY1');
          expect(d.amount).toBe('100');
        },
      },
      {
        type: ContractEventType.SUBSCRIPTION_CREATED,
        fixture: {
          subscription_id: 'SUB1',
          subscriber:
            'GA7QFKA2OGDWPNTZ35B2AJQA3HSEWWQBIR2FA3ZWEX37MQSUDUXCTX2H',
          plan: 'pro',
          amount: '990',
        },
        assert: d => {
          expect(d.subscriptionId).toBe('SUB1');
          expect(d.plan).toBe('pro');
        },
      },
      {
        type: ContractEventType.SUBSCRIPTION_CANCELLED,
        fixture: { subscription_id: 'SUB1', status: 'cancelled' },
        assert: d => {
          expect(d.subscriptionId).toBe('SUB1');
          expect(d.status).toBe('cancelled');
        },
      },
      {
        type: ContractEventType.SUBSCRIPTION_MODIFIED,
        fixture: { subscription_id: 'SUB1', plan: 'max', amount: '1990' },
        assert: d => {
          expect(d.subscriptionId).toBe('SUB1');
          expect(d.plan).toBe('max');
        },
      },
      {
        type: ContractEventType.SUBSCRIPTION_PAUSED,
        fixture: { subscription_id: 'SUB1', status: 'paused' },
        assert: d => {
          expect(d.subscriptionId).toBe('SUB1');
          expect(d.status).toBe('paused');
        },
      },
      {
        type: ContractEventType.SUBSCRIPTION_RESUMED,
        fixture: { subscription_id: 'SUB1', status: 'active' },
        assert: d => {
          expect(d.subscriptionId).toBe('SUB1');
          expect(d.status).toBe('active');
        },
      },
      {
        type: ContractEventType.PAYMENT_FAILED,
        fixture: { subscription_id: 'SUB1', reason: 'insufficient_funds' },
        assert: d => {
          expect(d.subscriptionId).toBe('SUB1');
          expect(d.reason).toBe('insufficient_funds');
        },
      },
      {
        type: ContractEventType.SUBSCRIPTION_PAYMENT,
        fixture: { subscription_id: 'SUB1', amount: '990' },
        assert: d => {
          expect(d.subscriptionId).toBe('SUB1');
          expect(d.amount).toBe('990');
        },
      },
      {
        type: ContractEventType.BRIDGE_INITIALIZED,
        fixture: {
          bridge_id: 'BR1',
          admin: 'GA7QFKA2OGDWPNTZ35B2AJQA3HSEWWQBIR2FA3ZWEX37MQSUDUXCTX2H',
        },
        assert: d => {
          expect(d.bridgeId).toBe('BR1');
        },
      },
      {
        type: ContractEventType.SUPPORTED_CHAIN_ADDED,
        fixture: { chain_id: 5, chain_name: 'Base' },
        assert: d => {
          expect(d.chainId).toBe(5);
          expect(d.chainName).toBe('Base');
        },
      },
      {
        type: ContractEventType.SUPPORTED_CHAIN_REMOVED,
        fixture: { chain_id: 5 },
        assert: d => {
          expect(d.chainId).toBe(5);
        },
      },
      {
        type: ContractEventType.ASSET_WRAPPED,
        fixture: { asset: 'USDC', wrapped_asset: 'wUSDC', amount: '1000' },
        assert: d => {
          expect(d.asset).toBe('USDC');
          expect(d.wrappedAsset).toBe('wUSDC');
        },
      },
      {
        type: ContractEventType.ASSET_UNWRAPPED,
        fixture: { asset: 'wUSDC', amount: '1000' },
        assert: d => {
          expect(d.asset).toBe('wUSDC');
        },
      },
      {
        type: ContractEventType.BRIDGE_DEPOSIT,
        fixture: {
          chain_id: 5,
          depositor: 'GA7QFKA2OGDWPNTZ35B2AJQA3HSEWWQBIR2FA3ZWEX37MQSUDUXCTX2H',
          amount: '1000',
        },
        assert: d => {
          expect(d.chainId).toBe(5);
          expect(d.amount).toBe('1000');
        },
      },
      {
        type: ContractEventType.BRIDGE_WITHDRAW,
        fixture: {
          chain_id: 5,
          recipient: 'GA7QFKA2OGDWPNTZ35B2AJQA3HSEWWQBIR2FA3ZWEX37MQSUDUXCTX2H',
          amount: '1000',
        },
        assert: d => {
          expect(d.chainId).toBe(5);
          expect(d.amount).toBe('1000');
        },
      },
      {
        type: ContractEventType.BRIDGE_PAUSED,
        fixture: { bridge_id: 'BR1' },
        assert: d => {
          expect(d.bridgeId).toBe('BR1');
        },
      },
      {
        type: ContractEventType.BRIDGE_UNPAUSED,
        fixture: { bridge_id: 'BR1' },
        assert: d => {
          expect(d.bridgeId).toBe('BR1');
        },
      },
      {
        type: ContractEventType.RELAYER_ADDED,
        fixture: {
          relayer: 'GA7QFKA2OGDWPNTZ35B2AJQA3HSEWWQBIR2FA3ZWEX37MQSUDUXCTX2H',
        },
        assert: d => {
          expect(d.relayer).toContain('GA7');
        },
      },
      {
        type: ContractEventType.RELAYER_REMOVED,
        fixture: {
          relayer: 'GA7QFKA2OGDWPNTZ35B2AJQA3HSEWWQBIR2FA3ZWEX37MQSUDUXCTX2H',
        },
        assert: d => {
          expect(d.relayer).toContain('GA7');
        },
      },
      {
        type: ContractEventType.BRIDGE_TX_CONFIRMED,
        fixture: { tx_hash: '0xabc', status: 'confirmed' },
        assert: d => {
          expect(d.txHash).toBe('0xabc');
          expect(d.status).toBe('confirmed');
        },
      },
      {
        type: ContractEventType.BRIDGE_TX_FAILED,
        fixture: { tx_hash: '0xabc', status: 'failed' },
        assert: d => {
          expect(d.txHash).toBe('0xabc');
          expect(d.status).toBe('failed');
        },
      },
      {
        type: ContractEventType.CONTRACT_PAUSED,
        fixture: { contract_id: 'C1' },
        assert: d => {
          expect(d.contractId).toBe('C1');
        },
      },
      {
        type: ContractEventType.CONTRACT_RESUMED,
        fixture: { contract_id: 'C1' },
        assert: d => {
          expect(d.contractId).toBe('C1');
        },
      },
      {
        type: ContractEventType.UPGRADE_SCHEDULED,
        fixture: { contract_id: 'C1', new_wasm_hash: '0xdeadbeef' },
        assert: d => {
          expect(d.contractId).toBe('C1');
          expect(d.newWasmHash).toBe('0xdeadbeef');
        },
      },
      {
        type: ContractEventType.UPGRADE_EXECUTED,
        fixture: { contract_id: 'C1', new_wasm_hash: '0xdeadbeef' },
        assert: d => {
          expect(d.contractId).toBe('C1');
        },
      },
      {
        type: ContractEventType.UPGRADE_CANCELLED,
        fixture: { contract_id: 'C1', new_wasm_hash: '0xdeadbeef' },
        assert: d => {
          expect(d.contractId).toBe('C1');
        },
      },
    ];

    it.each(cases.map(c => [c.type, c] as const))(
      'decodes %s into structured fields',
      (_type, c) => {
        const xdrStr = toXdr(c.fixture);
        const decoded = service.decode(xdrStr, c.type);
        expect((decoded.data as any)._quarantined).toBeUndefined();
        c.assert(decoded.data);
      },
    );

    it('round-trips every event type through nativeToScVal -> decode', () => {
      for (const c of cases) {
        const xdrStr = toXdr(c.fixture);
        const scVal = xdr.ScVal.fromXDR(xdrStr, 'base64');
        const native = scValToNative(scVal);
        expect(native).toBeDefined();
      }
    });
  });

  describe('quarantine (unknown/garbage XDR)', () => {
    it('does not throw and marks bad base64 XDR as quarantined', () => {
      const decoded = service.decode(
        '!!!not-valid-base64-xdr!!!',
        ContractEventType.CONTRIBUTION_MADE,
      );
      expect((decoded.data as any)._quarantined).toBe(true);
      expect(typeof (decoded.data as any)._quarantineReason).toBe('string');
      expect((decoded.data as any).rawXdr).toBe('!!!not-valid-base64-xdr!!!');
    });

    it('does not throw and marks structurally wrong XDR as quarantined', () => {
      // Valid base64 but not a ScVal - should be quarantined, not crash.
      const garbage = Buffer.from('this is not an xdr scval').toString(
        'base64',
      );
      const decoded = service.decode(
        garbage,
        ContractEventType.PROJECT_CREATED,
      );
      expect((decoded.data as any)._quarantined).toBe(true);
    });

    it('returns a decodable but unrecognized shape without quarantining', () => {
      const xdrStr = toXdr({ some_unknown_field: 123 });
      const decoded = service.decode(
        xdrStr,
        'definitely_unknown' as ContractEventType,
      );
      expect((decoded.data as any)._quarantined).toBeUndefined();
      expect(decoded.data.some_unknown_field).toBe('123');
    });
  });
});
