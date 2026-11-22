export type GamblingTransactionType = 'dice' | 'duel' | 'high_roller' | 'hot_cold' | 'lucky_pick' | 'slots';

export async function trackGamblingTransaction(
	{
		userID,
		type,
		amountStaked,
		pnl
	}: {
		userID: string;
		type: GamblingTransactionType;
		amountStaked: number;
		pnl: number;
	},
	client: Pick<typeof prisma, '$executeRaw'> = prisma
) {
	await client.$executeRaw`
INSERT INTO gambling_transaction (user_id, type, amount_staked, pnl)
VALUES (${BigInt(userID)}, ${type}, ${BigInt(Math.trunc(amountStaked))}, ${BigInt(Math.trunc(pnl))});
`;
}
