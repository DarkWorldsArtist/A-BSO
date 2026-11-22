import { SPAWN_BOX_COOLDOWN, spawnLampResetTime } from '@/lib/bso/bsoConstants.js';
import { BSOEmoji } from '@/lib/bso/bsoEmoji.js';
import { BSOMonsters } from '@/lib/bso/monsters/customMonsters.js';
import { MysteryBoxes } from '@/lib/bso/openables/tables.js';
import { pickRandomChallengeItems } from '@/lib/bso/util/challengeItems.js';
import { findGroupOfUser } from '@/lib/bso/util/findGroupOfUser.js';
import { LampTable } from '@/lib/bso/xpLamps.js';

import { bold, dateFm, time, userMention } from '@oldschoolgg/discord';
import { Emoji, formatDuration, isFunction, PerkTier, stringMatches, Time } from '@oldschoolgg/toolkit';
import { MathRNG, randArrItem, randInt, roll } from 'node-rng';
import { Bank, convertLVLtoXP, Items, itemID, LootTable, Monsters } from 'oldschooljs';

import { CanvasModule } from '@/lib/canvas/CanvasModule.js';
import { OSRSCanvas } from '@/lib/canvas/OSRSCanvas.js';
import { BitField, Channel, globalConfig } from '@/lib/constants.js';
import { allCollectionLogsFlat } from '@/lib/data/Collections.js';
import Createables from '@/lib/data/createables.js';
import killableMonsters from '@/lib/minions/data/killableMonsters/index.js';
import { getESTDateKey, getNextESTMidnight } from '@/lib/util/estTime.js';

export const SPAWN_CHALLENGE_MODES = ['random', 'sprite', 'monster', 'recipe', 'unscramble', 'cl', 'xp'] as const;
export type SpawnChallengeMode = (typeof SPAWN_CHALLENGE_MODES)[number];

interface GeneratedSpawnChallenge {
	question: string;
	explainAnswer: string;
	isMatch: (input: string) => boolean;
	files?: Array<{ buffer: Buffer; name: string }>;
}

const challengeCreatables = Createables.filter(
	i =>
		['revert', 'fix', '(', 'unlock', 'unpack', 'pouch', ' set', 'graceful'].every(
			o => !i.name.toLowerCase().includes(o)
		) &&
		Object.keys(i.outputItems).length === 1 &&
		!isFunction(i.inputItems)
);

const challengeMonsters = [...Object.values(BSOMonsters), ...killableMonsters]
	.map(i => {
		const allItems = i.table instanceof LootTable ? i.table.allItems : (Monsters.get(i.id)?.allItems ?? []);
		return {
			name: i.name,
			allItems
		};
	})
	.filter(m => m.allItems.length >= 3);

function generateXPLevelQuestion(): GeneratedSpawnChallenge {
	const level = randInt(1, 120);
	const xp = randInt(convertLVLtoXP(level), convertLVLtoXP(level + 1) - 1);

	return {
		question: `What level would you be at with ${xp.toLocaleString()} XP?`,
		explainAnswer: `${xp.toLocaleString()} XP is level ${level}.`,
		isMatch: input => input.trim() === level.toString()
	};
}

function generateUnscrambleQuestion(): GeneratedSpawnChallenge {
	const [item] = pickRandomChallengeItems(1);
	if (!item) return generateXPLevelQuestion();

	let scrambled = item.name
		.split(' ')
		.map(part => MathRNG.shuffle([...part]).join(''))
		.join(' ');
	if (scrambled.toLowerCase() === item.name.toLowerCase() && item.name.length > 1) {
		scrambled = [...item.name].reverse().join('');
	}

	return {
		question: `Unscramble this item name: ${scrambled}`,
		explainAnswer: `The item was ${item.name}.`,
		isMatch: input => stringMatches(input, item.name)
	};
}

function generateRecipeQuestion(): GeneratedSpawnChallenge {
	const randomCreatable = randArrItem(challengeCreatables);
	if (!randomCreatable || isFunction(randomCreatable.inputItems)) {
		return generateXPLevelQuestion();
	}
	const ingredients =
		randomCreatable.inputItems instanceof Bank ? randomCreatable.inputItems : new Bank(randomCreatable.inputItems);

	return {
		question: `What item is created using these materials: ${ingredients}?`,
		explainAnswer: `The item created is ${randomCreatable.name}.`,
		isMatch: input => stringMatches(input, randomCreatable.name)
	};
}

function generateMonsterDropQuestion(): GeneratedSpawnChallenge {
	const monster = randArrItem(challengeMonsters);
	if (!monster) return generateXPLevelQuestion();

	const items = MathRNG.shuffle(monster.allItems).slice(0, 3);
	const validMonsters = challengeMonsters.filter(mon => items.every(t => mon.allItems.includes(t)));
	const itemNames = items.map(id => Items.itemNameFromId(id)).join(', ');

	return {
		question: `Name a monster that drops these 3 items: ${itemNames}`,
		explainAnswer: `A valid answer was ${monster.name}.`,
		isMatch: input => validMonsters.some(m => stringMatches(input, m.name))
	};
}

function generateCLQuestion(): GeneratedSpawnChallenge {
	const cl = randArrItem(allCollectionLogsFlat.filter(c => c.items.size > 0));
	if (!cl) return generateXPLevelQuestion();
	const validNames = Array.from(cl.items).map(id => Items.itemNameFromId(id));

	return {
		question: `Name any item from the ${cl.name} collection log:`,
		explainAnswer: `One possible answer from ${cl.name} was ${validNames[0]}.`,
		isMatch: input => validNames.some(name => stringMatches(input, name))
	};
}

async function generateSpriteQuestion(): Promise<GeneratedSpawnChallenge> {
	await CanvasModule.waitTillReady();
	const [item] = pickRandomChallengeItems(1, true);
	if (!item) return generateXPLevelQuestion();

	const canvas = new OSRSCanvas({ width: 56, height: 48 });
	canvas.ctx.fillStyle = '#3e3529';
	canvas.ctx.fillRect(0, 0, canvas.width, canvas.height);
	await canvas.drawItemIDSprite({
		itemID: item.id,
		x: 10,
		y: 8
	});
	const buffer = await canvas.toScaledOutput(2);

	return {
		question: 'Identify this item from its icon:',
		explainAnswer: `The pictured item was ${item.name}.`,
		isMatch: input => stringMatches(input, item.name),
		files: [{ buffer, name: 'mystery_item.png' }]
	};
}

async function generateSpawnChallenge(mode: SpawnChallengeMode = 'random'): Promise<GeneratedSpawnChallenge> {
	const concreteModes: Exclude<SpawnChallengeMode, 'random'>[] = [
		'sprite',
		'monster',
		'recipe',
		'unscramble',
		'cl',
		'xp'
	];
	const chosen = mode === 'random' ? (randArrItem(concreteModes) ?? 'xp') : mode;

	switch (chosen) {
		case 'sprite':
			return generateSpriteQuestion();
		case 'monster':
			return generateMonsterDropQuestion();
		case 'recipe':
			return generateRecipeQuestion();
		case 'unscramble':
			return generateUnscrambleQuestion();
		case 'cl':
			return generateCLQuestion();
		case 'xp':
		default:
			return generateXPLevelQuestion();
	}
}

export async function spawnLampIsReady(user: MUser, channelId: string): Promise<[true] | [false, string]> {
	const allowedChannel = Channel.GeneralChannel;
	if (globalConfig.isProduction && channelId !== allowedChannel && channelId !== '1560885061572763749') {
		return [false, "You can't use spawnlamp in this channel. You can only use it in <#1560885061572763749>."];
	}

	const perkTier = await user.fetchPerkTier();
	const isPatron = perkTier >= PerkTier.Four || user.bitfield.includes(BitField.HasPermanentSpawnLamp);
	if (!isPatron) {
		return [false, 'You need to be a T3 patron or higher to use this command.'];
	}
	const currentDate = Date.now();
	const lastDate = Number(user.user.lastSpawnLamp);
	const difference = currentDate - lastDate;

	const cooldown = spawnLampResetTime(user, perkTier);

	if (difference < cooldown) {
		const duration = formatDuration(Date.now() - (lastDate + cooldown));
		return [false, `You can spawn another lamp in ${duration}.`];
	}
	return [true];
}

export async function spawnLampCommand(
	user: MUser,
	interaction: MInteraction,
	mode: SpawnChallengeMode = 'random'
): CommandResponse {
	if (globalConfig.isProduction && interaction.guildId !== globalConfig.supportServerID) {
		return 'You can only use this command in the support server.';
	}
	const [lampIsReady, reason] = user.isAdmin ? [true, ''] : await spawnLampIsReady(user, interaction.channelId);
	if (!lampIsReady && reason) return reason;

	const group = await findGroupOfUser(user.id);
	await prisma.user.updateMany({
		where: {
			id: {
				in: group
			}
		},
		data: {
			lastSpawnLamp: Date.now()
		}
	});

	const challenge = await generateSpawnChallenge(mode);

	await interaction.replyWithResponse({
		content: `${BSOEmoji.HugeLamp} ${userMention(user.id)} spawned a Lamp, answer within ${time(Math.floor((Date.now() + Time.Minute) / 1000), 'R')} by replying to this message.

${bold(challenge.question)}`,
		files: challenge.files,
		withResponse: true
	});
	const messages = await globalClient.awaitMessages({
		channelId: interaction.channelId,
		time: Time.Minute,
		filter: m => challenge.isMatch(m.content)
	});

	if (!messages[0]) return `Nobody got it. ${challenge.explainAnswer}`;
	const winner = await mUserFetch(messages[0].author.id);
	const loot = LampTable.roll();
	await winner.addItemsToBank({ items: loot, collectionLog: false });
	return `${winner} got it, and won **${loot}**! ${challenge.explainAnswer}`;
}

export async function spawnBoxCommand(
	user: MUser,
	interaction: MInteraction,
	mode: SpawnChallengeMode = 'random'
): CommandResponse {
	const perkTier = await user.fetchPerkTier();
	if (perkTier < PerkTier.Four && !user.bitfield.includes(BitField.HasPermanentEventBackgrounds)) {
		return 'You need to be a T3 patron or higher to use this command.';
	}
	const allowedChannel = Channel.GeneralChannel;
	if (
		globalConfig.isProduction &&
		interaction.channelId !== allowedChannel &&
		interaction.channelId !== '1560885061572763749'
	) {
		return "You can't use spawnbox in this channel. You can only use it in <#1560885061572763749>.";
	}
	const boxCooldown = perkTier >= PerkTier.Six ? Time.Minute * 30 : SPAWN_BOX_COOLDOWN;
	const lastUse = Number(user.user.last_spawn_box_date ?? 0);
	const difference = Date.now() - lastUse;
	const isOnCooldown = difference < boxCooldown ? boxCooldown - difference : null;
	if (isOnCooldown !== null && !user.isAdmin) {
		return `This command is on cooldown for you for ${formatDuration(isOnCooldown)}.`;
	}
	await user.update({
		last_spawn_box_date: Date.now()
	});
	const challenge = await generateSpawnChallenge(mode);
	const timeToAnswer = Time.Minute;

	await interaction.replyWithResponse({
		content: `${Emoji.MysteryBox} ${userMention(user.id)} spawned a Mystery Box, answer within ${time(Math.floor((Date.now() + timeToAnswer) / 1000), 'R')} by replying to this message.

${bold(challenge.question)}`,
		files: challenge.files,
		withResponse: true
	});
	const messages = await globalClient.awaitMessages({
		channelId: interaction.channelId,
		time: timeToAnswer,
		filter: m => challenge.isMatch(m.content)
	});
	if (!messages[0]) return `Nobody got it. ${challenge.explainAnswer}`;
	const winner = await mUserFetch(messages[0].author.id);

	const loot = new Bank().add(MysteryBoxes.roll());
	await winner.addItemsToBank({ items: loot, collectionLog: false });
	return `Congratulations, ${winner}! You received: **${loot}**. ${challenge.explainAnswer}`;
}

export async function giveBox(user: MUser, _recipient: MahojiUserOption) {
	if (!_recipient) return 'You need to specify a user to give a box to.';
	const recipient = await mUserFetch(_recipient.user.id);

	const currentDate = Date.now();
	const lastDate = Number(user.user.lastGivenBoxx);
	if (lastDate > 0 && getESTDateKey(new Date(lastDate)) === getESTDateKey(new Date(currentDate)) && !user.isAdmin) {
		const nextReset = getNextESTMidnight(new Date(currentDate));
		return `You can give another box at midnight EST (${dateFm(nextReset)}).`;
	}

	if (recipient.id === user.id) return "You can't give boxes to yourself!";
	if (recipient.isIronman) return "You can't give boxes to ironmen!";
	await user.update({
		lastGivenBoxx: currentDate
	});

	const boxToReceive = new Bank().add(roll(10) ? MysteryBoxes.roll() : itemID('Mystery box'));

	await recipient.addItemsToBank({ items: boxToReceive, collectionLog: false });

	return `Gave **${boxToReceive}** to ${recipient}.`;
}
