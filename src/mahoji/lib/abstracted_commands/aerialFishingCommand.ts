import { Time } from '@oldschoolgg/toolkit';

import type { ActivityTaskOptionsWithQuantity } from '@/lib/types/minions.js';
import { calcDurationAndQuantity, formatTripDuration } from '@/lib/util/minionUtils.js';

export async function aerialFishingCommand({
	user,
	channelId,
	rng,
	durationInput
}: {
	user: MUser;
	channelId: string;
	rng: RNGProvider;
	durationInput?: string;
}) {
	if (user.skillsAsLevels.fishing < 43 || user.skillsAsLevels.hunter < 35) {
		return 'You need at least level 35 Hunter and 43 Fishing to do Aerial fishing.';
	}

	const timePerFish = rng.randomVariation(2, 7.5) * Time.Second;
	const res = calcDurationAndQuantity({
		durationInput,
		singleTime: timePerFish,
		maxTripLength: await user.calcMaxTripLength('AerialFishing')
	});
	if (typeof res === 'string') return res;
	const { quantity, duration } = res;

	await ActivityManager.startTrip<ActivityTaskOptionsWithQuantity>({
		userID: user.id,
		channelId,
		quantity,
		duration,
		type: 'AerialFishing'
	});

	return `${user.minionName} is now doing Aerial fishing, it will take around ${formatTripDuration(user, duration)} to finish.`;
}
