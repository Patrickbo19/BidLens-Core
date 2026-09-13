const spendVault = require('./earn-spend-vault.cjs');

const ALLOWED_EVIDENCE = new Set(['PROVEN', 'VALIDATED']);

function positiveNumber(value, name) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) throw new Error(`${name} must be positive`);
  return n;
}

async function evaluate(input = {}) {
  const opportunityId = String(input.opportunity_id || '').trim();
  const evidenceTier = String(input.evidence_tier || '').trim().toUpperCase();
  const evidenceRef = String(input.evidence_ref || '').trim();
  const payoutVerified = input.payout_verified === true;
  const payoutFloorUsdc = positiveNumber(input.payout_floor_usdc, 'payout_floor_usdc');
  const maxCostUsdc = positiveNumber(input.max_cost_usdc, 'max_cost_usdc');

  if (!opportunityId) throw new Error('opportunity_id is required');
  if (!ALLOWED_EVIDENCE.has(evidenceTier)) throw new Error('requires PROVEN or VALIDATED evidence');
  if (!payoutVerified) throw new Error('payout_verified must be true');
  if (evidenceRef.length < 8) throw new Error('evidence_ref is required');
  if (maxCostUsdc > spendVault.constants.defaultPerActionCapUsdc) throw new Error('per-action cap exceeded');
  if (payoutFloorUsdc < maxCostUsdc) throw new Error('verified payout floor must cover maximum spend');

  const wallet = await spendVault.status();
  if (!wallet.connected || !wallet.signerReady) throw new Error('spend wallet not ready');
  if (wallet.onchainUsdcBalance == null) throw new Error('wallet balance could not be verified');

  const eligible = wallet.onchainUsdcBalance >= maxCostUsdc && wallet.remainingUsdc >= maxCostUsdc;
  return {
    eligible,
    decision: eligible ? 'EXECUTION_READY' : 'HOLD',
    opportunityId,
    evidenceTier,
    evidenceRef,
    payoutVerified,
    economics: {
      maxCostUsdc,
      verifiedPayoutFloorUsdc: payoutFloorUsdc,
      minimumGrossSurplusUsdc: payoutFloorUsdc - maxCostUsdc,
    },
    wallet: {
      address: wallet.address,
      onchainUsdcBalance: wallet.onchainUsdcBalance,
      remainingUsdc: wallet.remainingUsdc,
      ownerCapUsdc: wallet.ownerCapUsdc,
      defaultPerActionCapUsdc: wallet.defaultPerActionCapUsdc,
    },
  };
}

module.exports = { evaluate };
