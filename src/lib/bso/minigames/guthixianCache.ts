import { time } from '@oldschoolgg/discord';
import { formatDuration, Time } from '@oldschoolgg/toolkit';

import type { MinigameActivityTaskOptionsWithNoChanges } from '@/lib/types/minions.js';
import { getESTDateKey, getNextESTMidnight } from '@/lib/util/estTime.js';

export const getGuthixianCacheInterval = () => {
	const end = getNextESTMidnight();
	const start = new Date(end.getTime() - Time.Day);
	return { start, end, nextResetStr: `${time(end, 'R')} (midnight EST)` };
};

export async function userHasDoneCurrentGuthixianCache(user: MUser) {
	const todayKey = getESTDateKey();

	const lastTrips = await prisma.activity.findMany({
		where: {
			user_id: BigInt(user.id),
			type: 'GuthixianCache'
		},
		orderBy: {
			finish_date: 'desc'
		},
		take: 10
	});
	return lastTrips.some(trip => getESTDateKey(trip.finish_date) === todayKey);
}

export async function joinGuthixianCache(user: MUser, channelId: string) {
	if (await user.minionIsBusy()) {
		return `${user.minionName} is busy.`;
	}

	const currentInterval = getGuthixianCacheInterval();

	if (await userHasDoneCurrentGuthixianCache(user)) {
		return `You already participated in the current Guthixian Cache, try again at: ${time(currentInterval.end)}`;
	}

	const task = await ActivityManager.startTrip<MinigameActivityTaskOptionsWithNoChanges>({
		userID: user.id,
		channelId,
		quantity: 1,
		duration: Time.Minute * 10,
		type: 'GuthixianCache',
		minigameID: 'guthixian_cache'
	});

	const response = `${
		user.minionName
	} is now participating in the current Guthixian Cache, it'll take around ${formatDuration(
		task.duration
	)} to finish.`;

	return response;
}
