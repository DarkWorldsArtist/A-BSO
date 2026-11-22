import { BSOEmoji } from '@/lib/bso/bsoEmoji.js';
import { LampTable } from '@/lib/bso/xpLamps.js';

import { dateFm } from '@oldschoolgg/discord';
import { Emoji, isWeekend, uniqueArr } from '@oldschoolgg/toolkit';

import type { MessageBuilderClass } from '@/discord/MessageBuilder.js';
import { getRandomTriviaQuestions } from '@/lib/roboChimp.js';
import dailyRoll, { rollIronmanDailySupplies } from '@/lib/simulation/dailyTable.js';
import { getESTDateKey, getNextESTMidnight, getPreviousESTDateKey } from '@/lib/util/estTime.js';

export async function isUsersDailyReady(
	user: MUser
): Promise<{ isReady: true } | { isReady: false; durationUntilReady: number; nextReset: Date }> {
	const stats = await user.fetchStats();
	const todayKey = getESTDateKey();

	if (stats.last_daily_date === todayKey) {
		const nextReset = getNextESTMidnight();
		return {
			isReady: false,
			durationUntilReady: Math.max(0, nextReset.getTime() - Date.now()),
			nextReset
		};
	}

	return { isReady: true };
}

async function reward(
	rng: RNGProvider,
	user: MUser,
	triviaCorrect: boolean,
	streak: number
): Promise<MessageBuilderClass> {
	const member = await globalClient.fetchMainServerMember(user.id);
	const loot = dailyRoll(1, triviaCorrect);
	const bonuses: string[] = [];

	let coinsToGive = loot.amount('Coins');

	const levelMult = 1 + Math.min(1.5, user.totalLevel / 2000);
	const streakMult = 1 + Math.min(0.5, Math.max(0, streak - 1) * 0.02);
	coinsToGive = Math.floor(coinsToGive * levelMult * streakMult);

	if (isWeekend()) {
		coinsToGive *= 2;
		bonuses.push(Emoji.MoneyBag);
	}

	if (member) {
		coinsToGive = Math.floor(coinsToGive * 1.5);
		bonuses.push(Emoji.OSBot);
	}

	if (rng.roll(73)) {
		coinsToGive = Math.floor(coinsToGive * 1.73);
		bonuses.push(Emoji.Joy);
	}

	if (rng.roll(5000)) {
		if (rng.roll(2)) {
			bonuses.push(Emoji.Bpaptu);
		} else {
			coinsToGive += 1_000_000_000;
			bonuses.push(Emoji.Diamond);
		}
	}

	if (!triviaCorrect) {
		coinsToGive = Math.floor(coinsToGive * 0.5);
	}

	const hasSkipper = user.usingPet('Skipper') || user.bank.has('Skipper');
	if (hasSkipper && coinsToGive > 0) {
		coinsToGive = Math.floor(coinsToGive * 1.5);
		bonuses.push(`${BSOEmoji.Skipper} Skipper negotiated you 50% more coins!`);
	}

	if (user.isIronman) {
		coinsToGive = 0;
		const supplyRolls = triviaCorrect ? 3 : 1;
		loot.add(rollIronmanDailySupplies(supplyRolls));
	}

	loot.set('Coins', Math.floor(coinsToGive));

	if (streak > 0 && streak % 7 === 0) {
		loot.add('Tradeable mystery box', 1);
		bonuses.push(`7-day streak milestone (${streak} days)!`);
	}
	if (streak > 0 && streak % 30 === 0) {
		loot.add(LampTable.roll());
		bonuses.push(`30-day streak milestone (${streak} days)!`);
	}

	const correct = triviaCorrect ? 'correct' : 'incorrect';
	const rewardText = triviaCorrect
		? "I've picked you some random items as a reward..."
		: "Even though you got it wrong, here's a little reward...";

	const dmStr = `${bonuses.join(' ')} **${Emoji.Diango} Diango says..** That's ${correct}! ${rewardText}\n**Daily Streak:** ${streak} day${streak === 1 ? '' : 's'}\n`;

	if (coinsToGive > 0) {
		ClientSettings.updateClientGPTrackSetting('gp_daily', coinsToGive);
	}

	const { itemsAdded, previousCL } = await user.transactItems({
		collectionLog: true,
		itemsToAdd: loot
	});

	return new MessageBuilder().setContent(`${dmStr}\nYou received ${loot}`).addBankImage({
		bank: itemsAdded,
		title: `Daily Loot (Day ${streak})`,
		previousCL,
		showNewCL: true,
		user
	});
}

export async function dailyCommand(rng: RNGProvider, interaction: MInteraction, user: MUser): CommandResponse {
	const check = await isUsersDailyReady(user);
	if (!check.isReady) {
		return `**${Emoji.Diango} Diango says...** You already claimed today's daily! Resets at midnight EST (${dateFm(check.nextReset)}).`;
	}

	const [question, ...fakeQuestions] = await getRandomTriviaQuestions();
	const allAnswers = uniqueArr(rng.shuffle([question, ...fakeQuestions].map(q => q.answers[0])));

	const choice = await globalClient.pickStringWithButtons({
		interaction,
		options: allAnswers.map(answer => ({ label: answer, id: answer })),
		content: `**${Emoji.Diango} Diango asks ${user.badgedUsername}...** ${question.question}`
	});
	if (!choice) {
		return "You didn't answer in time! Your daily has not been consumed.";
	}

	const stats = await user.fetchStats();
	const todayKey = getESTDateKey();
	if (stats.last_daily_date === todayKey) {
		const nextReset = getNextESTMidnight();
		return `**${Emoji.Diango} Diango says...** You already claimed today's daily! Resets at midnight EST (${dateFm(nextReset)}).`;
	}
	const yesterdayKey = getPreviousESTDateKey();
	const newStreak = stats.last_daily_date === yesterdayKey ? (stats.daily_streak ?? 0) + 1 : 1;

	const claimResult = await prisma.userStats.updateMany({
		where: {
			user_id: BigInt(user.id),
			OR: [{ last_daily_date: null }, { last_daily_date: { not: todayKey } }]
		},
		data: {
			last_daily_timestamp: Date.now(),
			last_daily_date: todayKey,
			daily_streak: newStreak
		}
	});
	if (claimResult.count === 0) {
		const nextReset = getNextESTMidnight();
		return `**${Emoji.Diango} Diango says...** You already claimed today's daily! Resets at midnight EST (${dateFm(nextReset)}).`;
	}

	return reward(rng, user, question.answers.includes(choice.choice.label!), newStreak);
}
