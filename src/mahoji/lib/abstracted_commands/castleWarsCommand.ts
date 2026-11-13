import { Time } from '@oldschoolgg/toolkit';

import type { MinigameActivityTaskOptionsWithNoChanges } from '@/lib/types/minions.js';
import { calcDurationAndQuantity, formatTripDuration } from '@/lib/util/minionUtils.js';

export async function castleWarsStartCommand(user: MUser, channelId: string, durationInput?: string) {
	if (await user.minionIsBusy()) return `${user.minionName} is busy.`;
	const gameLength = Time.Minute * 18;
	const res = calcDurationAndQuantity({
		durationInput,
		singleTime: gameLength,
		maxTripLength: await user.calcMaxTripLength('CastleWars')
	});
	if (typeof res === 'string') return res;
	const { quantity, duration } = res;

	await ActivityManager.startTrip<MinigameActivityTaskOptionsWithNoChanges>({
		userID: user.id,
		channelId,
		duration,
		type: 'CastleWars',
		quantity,
		minigameID: 'castle_wars'
	});

	return `${
		user.minionName
	} is now doing ${quantity} games of Castle Wars. The trip will return in about around ${formatTripDuration(user, duration)}.`;
}
export async function castleWarsStatsCommand(user: MUser) {
	const { bank } = user;
	const kc = await user.fetchMinigameScore('castle_wars');
	return `You have **${bank.amount('Castle wars ticket')}** Castle wars tickets.
You have played ${kc} Castle Wars games.`;
}
