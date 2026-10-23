import { calcWhatPercent, formatOrdinal, round, sumArr } from '@oldschoolgg/toolkit';
import type { Bank } from 'oldschooljs';
import { isDeepEqual } from 'remeda';

import type { TriviaQuestion, User } from '@/prisma/clients/robochimp/client.js';
import { BitField, BOT_TYPE, globalConfig, masteryKey } from '@/lib/constants.js';
import { getTotalCl } from '@/lib/data/Collections.js';
import { calculateMastery } from '@/lib/mastery.js';
import { MUserStats } from '@/lib/structures/MUserStats.js';
import { RobochimpBitfieldEnum } from './perkTiers.js';

export type RobochimpUser = User;

const defaultTriviaQuestions: TriviaQuestion[] = [
	{ id: 10001, question: 'What is the maximum combat level achievable in Old School RuneScape?', answers: ['126'] },
	{ id: 10002, question: 'What level in a skill is required to equip a Skillcape?', answers: ['99'] },
	{ id: 10003, question: 'How many Quest Points are required to wear the Quest Point Cape?', answers: ['300'] },
	{
		id: 10004,
		question: 'What is the maximum amount of coins a single stack can hold?',
		answers: ['2,147,483,647', '2147483647']
	},
	{ id: 10005, question: 'Which boss drops the Twisted Bow?', answers: ['Great Olm', 'Olm'] },
	{ id: 10006, question: 'What Slayer level is required to kill Abyssal Demons?', answers: ['85'] },
	{ id: 10007, question: 'What Slayer level is required to kill Cerberus?', answers: ['91'] },
	{ id: 10008, question: 'Which tree produces Magic logs?', answers: ['Magic tree'] },
	{ id: 10009, question: 'What is the highest tier of metal armour available in free-to-play?', answers: ['Rune'] },
	{ id: 10010, question: 'How many barrows brothers were there originally before Linza and Bob?', answers: ['6'] },
	{ id: 10011, question: 'What Slayer level is required to kill Kraken?', answers: ['87'] },
	{ id: 10012, question: 'What Slayer level is required to kill Smoke Devils?', answers: ['93'] },
	{ id: 10013, question: 'What Slayer level is required to kill Hydras?', answers: ['95'] },
	{ id: 10014, question: 'Which god is associated with the color green in RuneScape?', answers: ['Guthix'] },
	{ id: 10015, question: 'Which god is associated with the color red in RuneScape?', answers: ['Zamorak'] },
	{ id: 10016, question: 'Which god is associated with the color blue in RuneScape?', answers: ['Saradomin'] }
];

export async function getRandomTriviaQuestions(): Promise<TriviaQuestion[]> {
	if (!globalConfig.isProduction) {
		return defaultTriviaQuestions;
	}
	try {
		const random: TriviaQuestion[] = await roboChimpClient.$queryRaw`SELECT id, question, answers
FROM trivia_question
ORDER BY random()
LIMIT 10;`;
		if (random.length >= 4) {
			return random;
		}
		return [...random, ...defaultTriviaQuestions].slice(0, 10);
	} catch {
		return defaultTriviaQuestions;
	}
}

const clKey: keyof User = BOT_TYPE === 'OSB' ? 'osb_cl_percent' : 'bso_cl_percent';
const levelKey: keyof User = BOT_TYPE === 'OSB' ? 'osb_total_level' : 'bso_total_level';
const totalXPKey: keyof User = BOT_TYPE === 'OSB' ? 'osb_total_xp' : 'bso_total_xp';

export async function syncOriginalSupporterBit(user: MUser, roboChimpUser: RobochimpUser) {
	if (!roboChimpUser.bits.includes(RobochimpBitfieldEnum.OriginalSupporter)) return;

	if (user.bitfield.includes(BitField.OriginalSupporter)) return;

	await prisma.user.update({
		where: {
			id: user.id
		},
		data: {
			bitfield: {
				push: BitField.OriginalSupporter
			}
		}
	});
}

export async function roboChimpSyncData(user: MUser, newCL?: Bank) {
	const id = BigInt(user.id);
	const newCLArray: number[] = (newCL ?? user.cl).itemIDs;
	const clArrayUpdateObject = {
		cl_array: newCLArray,
		cl_array_length: newCLArray.length
	} as const;

	const stats = new MUserStats(
		await prisma.userStats.upsert({
			where: {
				user_id: id
			},
			create: {
				user_id: id,
				...clArrayUpdateObject
			},
			update: {
				...clArrayUpdateObject
			}
		})
	);

	const [totalClItems, clItems] = await getTotalCl(user, 'collection', stats);
	const clCompletionPercentage = round(calcWhatPercent(clItems, totalClItems), 2);
	const totalXP = sumArr(Object.values(user.skillsAsXP));

	const { totalMastery } = await calculateMastery(user, stats);

	const updateObj = {
		[clKey]: clCompletionPercentage,
		[levelKey]: user.totalLevel,
		[totalXPKey]: totalXP,
		[masteryKey]: totalMastery
	} as const;

	const newUser: RobochimpUser = await roboChimpClient.user.upsert({
		where: {
			id: BigInt(user.id)
		},
		update: updateObj,
		create: {
			id: BigInt(user.id),
			...updateObj
		}
	});

	if (!isDeepEqual(newUser.store_bitfield, user.user.store_bitfield)) {
		await user.update({ store_bitfield: newUser.store_bitfield });
	}
	await syncOriginalSupporterBit(user, newUser);
	await Cache.setRoboChimpUser(user.id, newUser);
	return newUser;
}

export async function calculateOwnCLRanking(userID: string) {
	const clPercentRank = (
		await roboChimpClient.$queryRaw<{ count: number }[]>`SELECT COUNT(*)::int
FROM public.user
WHERE osb_cl_percent >= (SELECT osb_cl_percent FROM public.user WHERE id = ${BigInt(userID)});`
	)[0].count;

	return formatOrdinal(clPercentRank);
}
