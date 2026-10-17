import { globalConfig } from '@/lib/constants.js';

export const skillEmoji = {
	runecraft: '<:runecraft:1560872699549585468>',
	firemaking: '<:firemaking:1560872490560131113>',
	thieving: '<:thieving:1560872794034536550>',
	mining: '<:mining:1560872604305334342>',
	ranged: '<:ranged:1560872669363310632>',
	construction: '<:construction:1560872421018574898>',
	smithing: '<:smithing:1560872752443949106>',
	herblore: '<:herblore:1560872545115439195>',
	attack: '<:attack:1560873194112688271>',
	strength: '<:strength:1560872784719253535>',
	defence: '<:defence:1560872443625742436>',
	fishing: '<:fishing:1560872500076871804>',
	hitpoints: '<:hitpoints:1560872549158621265>',
	total: '<:xp:1560872811264876626>',
	overall: '<:xp:1560872811264876626>',
	magic: '<:magic:1560872600278667394>',
	crafting: '<:crafting:1560872439582298163>',
	agility: '<:agility:1560880739673702400>',
	fletching: '<:fletching:1560872510105456660>',
	cooking: '<:cooking:1560872425170800731>',
	farming: '<:farming:1560872485174517902>',
	slayer: '<:slayer:1560872733888225431>',
	prayer: '<:prayer:1560872643299643403>',
	woodcutting: '<:woodcutting:1560872814947475499>',
	hunter: '<:hunter:1560872557932970065>',
	cml: '<:CrystalMathLabs:1560873112046936104>',
	clock: '<:ehpclock:1560874281938976809>',
	combat: '<:combat:1560873224110088293>',
	dungeoneering: '<:dungeoneering:1560872468346966108>',
	invention: '<:Invention:1560880780819955752>',
	divination: '<:Divination:1560880903402815641>'
};

export const EmojiId = {
	ClueScroll: '1560873107638583376',
	Farming: '1560872485174517902',
	Casket: '1560873099597979648',
	Seedpack: '1560872944274514001',
	Slayer: '1560872733888225431',
	MoneyBag: '1560873139720953906',
	BirdsNest: '1560872907281010728',
	Leagues: '1560873036994056272',
	Gear: '1560872518976409620',
	Minion: '1560872612224307264',
	MysteryBox: '1560872620759584798',
	Bank: '1560873202912206919',
	ItemContract: '1560880770308902972',
	HugeXPLamp: '1560880855046430754',
	Fishing: '1560872500076871804'
};

export const ReactEmoji = globalConfig.isProduction
	? {
			Happy: 'RSHappy:1560874441708412938',
			Sad: 'RSSad:1560874450491015323',
			Gift: '🎁'
		}
	: {
			Happy: '😃',
			Sad: '😞',
			Gift: '🎁'
		};

export const miscEmojis = {
	barrowsChests: '<:Dharoks_helm:1560873705079439461>',
	hespori: '<:Bottomless_compost_bucket:1560873486421983294>',
	bryophyta: '<:Bryophytas_essence:1560873914509430804>',
	crazyArchaeologist: '<:Fedora:1560873963687645194>',
	derangedArchaeologist: '<:Fedora:1560873963687645194>',
	mimic: '<:Casket:1560873099597979648>',
	obor: '<:Hill_giant_club:1560873365311328387>'
} as const;
