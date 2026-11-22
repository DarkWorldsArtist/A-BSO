import type { CATier } from '@/lib/combat_achievements/combatAchievements.js';

export function applyCAClueBoost(user: MUser | null | undefined, baseDenominator: number, tier: CATier): number {
	if (!user || typeof user.hasCompletedCATier !== 'function') return baseDenominator;
	if (!user.hasCompletedCATier(tier)) return baseDenominator;
	return Math.max(1, Math.floor(baseDenominator * 0.95));
}
