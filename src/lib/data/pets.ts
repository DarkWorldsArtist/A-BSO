import { Emoji } from '@oldschoolgg/toolkit';
import { Items } from 'oldschooljs';

const xpEmoji = Emoji.XP;
const gpEmoji = Emoji.GP;
const fm = (num: number) => num.toLocaleString();

export interface Pet {
	id: number;
	emoji?: string;
	chance: number;
	name: string;
	type: string;
	altNames: string[];
	bossKeys?: string[];
	finish?(): number;
	formatFinish(num: number): string;
}

const pets: Pet[] = [
	{
		id: 1,
		emoji: '<:Baby_chinchompa_red:1560874066653610077>',
		chance: 95_898,
		name: 'Baby Chinchompa',
		type: 'SKILL',
		altNames: ['CHINCHOMPA', 'BABYCHINCHOMPA', 'CHIN'],
		formatFinish: (num: number) =>
			`You had to catch ${fm(num)} Red Chinchompas to get the Baby Chinchompa Pet! ` +
			`<:Baby_chinchompa_red:1560874066653610077> You also got...\n${xpEmoji} ${fm(num * 265)} XP\n${gpEmoji} ${fm(
				num * 1318
			)} GP`
	},
	{
		id: 2,
		emoji: '<:Baby_mole:1560874071086858261>',
		chance: 3000,
		name: 'Baby Mole',
		type: 'BOSS',
		altNames: ['BABYMOLE', 'MOLE', 'GIANTMOLE'],
		formatFinish: (num: number) =>
			`You had to kill ${fm(num)} Giant Moles to get the Baby Mole Pet! <:Baby_mole:1560874071086858261>`,
		bossKeys: ['giantMole']
	},
	{
		id: 3,
		emoji: '<:Beaver:1560874075767967924>',
		chance: 69_846,
		name: 'Beaver',
		type: 'SKILL',
		altNames: ['BEAVER', 'WC', 'WOODCUTTING'],
		formatFinish: (num: number) =>
			`You had to cut ${fm(num)} Magic Logs to get the Beaver Pet! <:Beaver:1560874075767967924> ` +
			`You also got...\n${xpEmoji} ${fm(num * 250)} XP\n${gpEmoji} ${fm(num * 1043)} GP`
	},
	{
		id: 4,
		emoji: '<:Bloodhound:1560874080700473515>',
		chance: 1000,
		name: 'Bloodhound',
		type: 'SPECIAL',
		altNames: ['BLOODHOUND'],
		formatFinish: (num: number) =>
			`You had to complete ${fm(num)} Master Clues to get the Bloodhound Pet! <:Bloodhound:1560874080700473515>`
	},
	{
		id: 5,
		emoji: '<:Callisto_cub:1560874084647047169>',
		chance: 2000,
		name: 'Callisto Cub',
		type: 'BOSS',
		altNames: ['CALLISTO', 'CALLISTOCUB', 'CUB'],
		formatFinish: (num: number) =>
			`You had to slay Callisto ${fm(num)} times to get the Callisto Cub Pet! <:Callisto_cub:1560874084647047169>`,
		bossKeys: ['callisto']
	},
	{
		id: 6,
		emoji: '<:Giant_squirrel:1560874105585008710>',
		chance: 31_965,
		name: 'Giant Squirrel',
		type: 'SKILL',
		altNames: ['SQUIRREL', 'GIANTSQUIRREL', 'AGILITY'],
		formatFinish: (num: number) =>
			`You had to run around the Ardougne Rooftops ${fm(
				num
			)} times to get the Giant Squirrel Pet! <:Giant_squirrel:1560874105585008710> You also got...\n${xpEmoji} ${fm(
				num * 570
			)} XP\n<:ehpclock:1560874281938976809> ${Math.round((num * 45) / 3600)} Hours of your time wasted!`
	},
	{
		id: 7,
		emoji: '<:Heron:1560874121561247829>',
		chance: 136_108,
		name: 'Heron',
		type: 'SKILL',
		altNames: ['HERON', 'FISHING', 'AGILITY'],
		formatFinish: (num: number) =>
			`You had to catch ${fm(
				num
			)} Monkfish to get the Heron Pet! <:Heron:1560874121561247829> You also got...\n${xpEmoji} ${fm(
				num * 120
			)} XP\n${gpEmoji} ${fm(num * 294)} GP`
	},
	{
		id: 8,
		emoji: '<:Kalphite_princess_2nd_form:1560874134697934918>',
		chance: 3000,
		name: 'Kalphite Princess',
		type: 'BOSS',
		altNames: ['KALPHITE', 'KALPHITEPRINCESS', 'KALPHITEQUEEN', 'KQ'],
		formatFinish: (num: number) =>
			`You had to kill the Kalphite Queen ${fm(
				num
			)} times to get the Kalphite Princess Pet! <:Kalphite_princess_2nd_form:1560874134697934918>`,
		bossKeys: ['kalphiteQueen']
	},
	{
		id: 9,
		emoji: '<:Noon:1560874148090085439>',
		chance: 3000,
		name: 'Noon',
		type: 'BOSS',
		altNames: ['GARGOYLE', 'NOON', 'DAWN', 'GG', 'MIDNIGHT'],
		formatFinish: (num: number) =>
			`You had to kill ${fm(num)} Grotesque Guardians to get the Noon Pet! <:Noon:1560874148090085439>`,
		bossKeys: ['grotesqueGuardians']
	},
	{
		id: 10,
		emoji: '<:Olmlet:1560874152544444467>',
		chance: 3000,
		name: 'Olmlet',
		type: 'BOSS',
		altNames: ['OLMLET', 'RAIDS', 'OLMLET', 'OLM'],
		formatFinish: (num: number) =>
			`You had to do ${fm(num)} Raids to get the Olmlet Pet! <:Olmlet:1560874152544444467>`,
		bossKeys: ['chambersofXeric', 'chambersofXericChallengeMode']
	},
	{
		id: 11,
		emoji: '<:Pet_chaos_elemental:1560874157002981497>',
		chance: 300,
		name: 'Pet chaos elemental',
		type: 'BOSS',
		altNames: ['CHAOSELE', 'CHAOSELEMENTAL'],
		formatFinish: (num: number) =>
			`You had to kill the Chaos Elemental ${fm(
				num
			)} times to get the Chaos Elemental Pet! <:Pet_chaos_elemental:1560874157002981497>`,
		bossKeys: ['chaosElemental', 'chaosFanatic']
	},
	{
		id: 12,
		emoji: '<:Pet_dagannoth_prime:1560874161839149076>',
		chance: 5000,
		name: 'Pet dagannoth prime',
		type: 'BOSS',
		altNames: ['PRIME', 'DAGANNOTHPRIME'],
		formatFinish: (num: number) =>
			`You had to kill Dagannoth Prime ${fm(
				num
			)} times to get the Dagannoth Prime Pet! <:Pet_dagannoth_prime:1560874161839149076>`,
		bossKeys: ['dagannothPrime']
	},
	{
		id: 13,
		emoji: '<:Pet_dagannoth_rex:1560874165748236342>',
		chance: 5000,
		name: 'Pet dagannoth rex',
		type: 'BOSS',
		altNames: ['REX', 'DAGANNOTHREX'],
		formatFinish: (num: number) =>
			`You had to kill Dagannoth Rex ${fm(
				num
			)} times to get the Dagannoth Rex Pet! <:Pet_dagannoth_rex:1560874165748236342>`,
		bossKeys: ['dagannothRex']
	},
	{
		id: 14,
		emoji: '<:Pet_dagannoth_supreme:1560874170215178410>',
		chance: 5000,
		name: 'Pet dagannoth supreme',
		type: 'BOSS',
		altNames: ['SUPREME', 'DAGANNOTHSUPREME'],
		formatFinish: (num: number) =>
			`You had to kill Dagannoth Supreme ${fm(
				num
			)} times to get the Dagannoth Supreme Pet! <:Pet_dagannoth_supreme:1560874170215178410>`,
		bossKeys: ['dagannothSupreme']
	},
	{
		id: 15,
		emoji: '<:Pet_dark_core:1560874174753280040>',
		chance: 5000,
		name: 'Pet dark core',
		type: 'BOSS',
		altNames: ['CORP', 'CORE', 'DARKCORE', 'CORPBEAST'],
		formatFinish: (num: number) =>
			`You had to slay the Corporeal Beast ${fm(
				num
			)} times to get the Dark Core Pet! <:Pet_dark_core:1560874174753280040>`,
		bossKeys: ['corporealBeast']
	},
	{
		id: 16,
		emoji: '<:Pet_general_graardor:1560874179426000936>',
		chance: 5000,
		name: 'Pet general graardor',
		type: 'BOSS',
		altNames: ['BANDOS', 'GRAARDOR'],
		formatFinish: (num: number) =>
			`You had to kill General Graardor ${fm(
				num
			)} times to get the General Graardor Jr. Pet! <:Pet_general_graardor:1560874179426000936>`,
		bossKeys: ['generalGraardor']
	},
	{
		id: 17,
		emoji: '<:Pet_kraken:1560874184186273792>',
		chance: 3000,
		name: 'Pet kraken',
		type: 'BOSS',
		altNames: ['KRAKEN'],
		formatFinish: (num: number) =>
			`You had to slay the Kraken ${fm(num)} times to get the Kraken Pet! <:Pet_kraken:1560874184186273792>`,
		bossKeys: ['kraken']
	},
	{
		id: 18,
		emoji: '<:Pet_kreearra:1560874188669984800>',
		chance: 5000,
		name: "Pet kree'arra",
		type: 'BOSS',
		altNames: ['KREE', 'ARMA', 'ARMADYL', 'KREEARRA'],
		formatFinish: (num: number) =>
			`You had to kill Kree'arra ${fm(num)} times to get the Kree'arra Pet! <:Pet_kreearra:1560874188669984800>`,
		bossKeys: ['kreeArra']
	},
	{
		id: 19,
		emoji: '<:Pet_kril_tsutsaroth:1560874194873483314>',
		chance: 5000,
		name: "Pet k'ril tsutsaroth",
		type: 'BOSS',
		altNames: ['KRILL', 'ZAMMY', 'ZAMORAK', 'KRIL', 'ZAM'],
		formatFinish: (num: number) =>
			`You had to kill K'ril Tsutsaroth ${fm(
				num
			)} times to get the K'ril Tsutsaroth Pet! <:Pet_kril_tsutsaroth:1560874194873483314>`,
		bossKeys: ['krilTsutsaroth']
	},
	{
		id: 20,
		emoji: '<:Pet_penance_queen:1560874199395082250>',
		chance: 1000,
		name: 'Pet Penance Queen',
		type: 'SPECIAL',
		altNames: ['PENANCE', 'PENANCEQUEEN', 'BARB'],
		formatFinish: (num: number) =>
			`You had to do ${fm(
				num
			)} High Level Gambles to get the Penance Queen Pet! <:Pet_penance_queen:1560874199395082250>`
	},
	{
		id: 21,
		emoji: '<:Pet_smoke_devil:1560874203689783367>',
		chance: 3000,
		name: 'Pet Smoke Devil',
		type: 'BOSS',
		altNames: ['SMOKEDEVIL', 'THERMY'],
		formatFinish: (num: number) =>
			`You had to kill ${fm(
				num
			)} Thermonuclear Smoke Devil's to get the Smoke Devil Pet! <:Pet_smoke_devil:1560874203689783367>`,
		bossKeys: ['thermonuclearSmokeDevil']
	},
	{
		id: 22,
		emoji: '<:Pet_snakeling:1560874207808847934>',
		chance: 4000,
		name: 'Pet snakeling',
		type: 'BOSS',
		altNames: ['ZULRAH', 'SNAKELING'],
		formatFinish: (num: number) =>
			`You had to kill Zulrah ${fm(num)} times to get the Snakeling Pet! <:Pet_snakeling:1560874207808847934>`,
		bossKeys: ['zulrah']
	},
	{
		id: 23,
		emoji: '<:Pet_zilyana:1560874212409741373>',
		chance: 5000,
		name: 'Pet zilyana',
		type: 'BOSS',
		altNames: ['SARA', 'SARADOMIN', 'ZILLY', 'ZILYANA'],
		formatFinish: (num: number) =>
			`You had to kill Commander Zilyana ${fm(
				num
			)} times to get the Zilyana Jr. Pet! <:Pet_zilyana:1560874212409741373>`,
		bossKeys: ['commanderZilyana']
	},
	{
		id: 24,
		emoji: '<:Phoenix:1560874216352387114>',
		chance: 5000,
		name: 'Phoenix',
		type: 'SPECIAL',
		altNames: ['PHOENIX', 'PHEONIX', 'WINTERTODT', 'FM'],
		formatFinish: (num: number) =>
			`It took you ${fm(
				num
			)} Wintertodt Supply Crate rolls to get the Phoenix Pet! <:Phoenix:1560874216352387114>`,
		bossKeys: ['wintertodt']
	},
	{
		id: 25,
		emoji: '<:Prince_black_dragon:1560874221326966945>',
		chance: 3000,
		name: 'Prince Black Dragon',
		type: 'BOSS',
		altNames: ['KBD', 'KINGBLACKDRAGON', 'PRINCEBLACKDRAGON'],
		formatFinish: (num: number) =>
			`You had to kill the King Black Dragon ${fm(
				num
			)} times to get the Prince Black Dragon Pet! <:Prince_black_dragon:1560874221326966945>`,
		bossKeys: ['kingBlackDragon']
	},
	{
		id: 26,
		emoji: '<:Rift_guardian_fire:1560874225739505735>',
		chance: 1_793_283,
		name: 'Rift Guardian',
		type: 'SKILL',
		altNames: ['RC', 'RIFTGUARDIAN', 'RUNECRAFTING'],
		formatFinish: (num: number) =>
			`You had to craft ${fm(
				num
			)} Nature Runes to get the Rift Guardian Pet! <:Rift_guardian_fire:1560874225739505735>`
	},
	{
		id: 27,
		emoji: '<:Rock_golem:1560874229359054935>',
		chance: 244_725,
		name: 'Rock Golem',
		type: 'SKILL',
		altNames: ['GOLEM', 'ROCKGOLEM', 'MINING'],
		formatFinish: (num: number) =>
			`You had to mine ${fm(
				num
			)} Paydirt at Motherlode Mine to get the Rock Golem Pet! <:Rock_golem:1560874229359054935>`
	},
	{
		id: 28,
		emoji: '<:Rocky:1560874234027319296>',
		chance: 254_736,
		name: 'Rocky',
		type: 'SKILL',
		altNames: ['ROCKY', 'THIEVING', 'RACCOON'],
		formatFinish: (num: number) =>
			`You had to pickpocket that Ardougne Knight ${fm(
				num
			)} times to get the Rocky Pet! <:Rocky:1560874234027319296> You also got...\n${xpEmoji} ${fm(
				num * 84
			)} XP\n${gpEmoji} ${fm(num * 100)} GP`
	},
	{
		id: 29,
		emoji: '<:Scorpias_offspring:1560874238272082031>',
		chance: 2000,
		name: "Scorpia's Offspring",
		type: 'BOSS',
		altNames: ['SCORPIA', 'SCORPION'],
		formatFinish: (num: number) =>
			`You had to kill Scorpia ${fm(
				num
			)} times to get the Scorpia's Offspring Pet! <:Scorpias_offspring:1560874238272082031>`,
		bossKeys: ['scorpia']
	},
	{
		id: 30,
		emoji: '<:Skotos:1560874242562592901>',
		chance: 65,
		name: 'Skotos',
		type: 'BOSS',
		altNames: ['SKOTOS', 'SKOTIZO'],
		formatFinish: (num: number) =>
			`You had to kill Skotizo ${fm(num)} times to get the Skotos Pet! <:Skotos:1560874242562592901>`,
		bossKeys: ['skotizo']
	},
	{
		id: 31,
		emoji: '<:Tangleroot:1560874251920216074>',
		chance: 6893,
		name: 'Tangleroot',
		type: 'SKILL',
		altNames: ['FARMING', 'TANGLEROOT'],
		formatFinish: (num: number) =>
			`You had to harvest ${fm(
				num
			)} Magic Trees to get the Tangleroot Pet! <:Tangleroot:1560874251920216074> You also got...\n${xpEmoji} ${fm(
				num * 13_768.3
			)} XP\n${gpEmoji} -${fm(num * 116_894)} GP`
	},
	{
		id: 32,
		emoji: '<:Tzrekjad:1560874256449933384>',
		chance: 200,
		name: 'Tzrek-Jad',
		type: 'BOSS',
		altNames: ['JAD'],
		formatFinish: (num: number) =>
			`You had to kill Jad ${fm(num)} times to get the TzRek-Jad Pet! <:Tzrekjad:1560874256449933384>`,
		bossKeys: ['tzTokJad']
	},
	{
		id: 33,
		emoji: '<:Venenatis_spiderling:1560874261332103258>',
		chance: 2000,
		name: 'Venenatis Spiderling',
		type: 'BOSS',
		altNames: ['SPIDER', 'VENNY', 'VENENATIS', 'SPIDERLING'],
		formatFinish: (num: number) =>
			`You had to kill Venenatis ${fm(
				num
			)} times to get the Venenatis Spiderling Pet! <:Venenatis_spiderling:1560874261332103258>`,
		bossKeys: ['venenatis']
	},
	{
		id: 34,
		emoji: '<:Vetion_jr:1560874265157435507>',
		chance: 2000,
		name: "Vet'ion jr.",
		type: 'BOSS',
		altNames: ['VETION'],
		formatFinish: (num: number) =>
			`You had to kill Vet'ion ${fm(num)} times to get the Vet'ion Jr. Pet! <:Vetion_jr:1560874265157435507>`,
		bossKeys: ['vetion']
	},
	{
		id: 35,
		emoji: '<:Abyssal_orphan:1560874062371102770>',
		chance: 2560,
		name: 'Abyssal Orphan',
		type: 'BOSS',
		altNames: ['SIRE', 'ABYSSALSIRE', 'ABYSSALOPRHAN'],
		formatFinish: (num: number) =>
			`You had to kill the Abyssal Sire ${fm(
				num
			)} times to get the Abyssal orphan Pet! <:Abyssal_orphan:1560874062371102770>`,
		bossKeys: ['abyssalSire']
	},
	{
		id: 36,
		emoji: '<:Hellpuppy:1560874110211596369>',
		chance: 3000,
		name: 'Hellpuppy',
		type: 'BOSS',
		altNames: ['CERB', 'CERBERUS', 'HELLPUPPY'],
		formatFinish: (num: number) =>
			`You had to kill Cerberus ${fm(num)} times to get the Hellpuppy Pet! <:Hellpuppy:1560874110211596369>`,
		bossKeys: ['cerberus']
	},
	{
		id: 37,
		emoji: '<:Chompy_chick:1560874101164212285>',
		chance: 500,
		name: 'Chompy chick',
		type: 'SPECIAL',
		altNames: ['CHOMPYCHICK'],
		formatFinish: (num: number) =>
			`You had to kill ${fm(num)} Chompy Birds to get the Chompy Chick Pet! <:Chompy_chick:1560874101164212285>`
	},
	{
		id: 38,
		emoji: '<:Jalnibrek:1560874130495246346>',
		chance: 100,
		name: 'Jal-nib-rek',
		type: 'BOSS',
		altNames: ['INFERNO', 'JALNIBREK', 'NIBBLER', 'ZUK'],
		formatFinish: (num: number) =>
			`You had to complete the Inferno ${fm(
				num
			)} times to get the Jal-Nib-Rek Pet! <:Jalnibrek:1560874130495246346>`,
		bossKeys: ['tzKalZuk']
	},
	{
		id: 39,
		emoji: '<:Herbi:1560874114967933059>',
		chance: 6500,
		name: 'Herbi',
		type: 'SPECIAL',
		altNames: ['HERBIBOAR', 'HERBI'],
		formatFinish: (num: number) =>
			`You had to track down ${fm(num)} Herbiboars to get the Herbi Pet! <:Herbi:1560874114967933059>`
	},
	{
		id: 40,
		emoji: '<:Vorki:1560874270400315483>',
		chance: 3000,
		name: 'Vorki',
		type: 'SPECIAL',
		altNames: ['VORKI', 'VORKATH'],
		formatFinish: (num: number) =>
			`You had to slay the almighty Vorkath ${fm(num)} times to get the Vorki Pet! <:Vorki:1560874270400315483>`,
		bossKeys: ['vorkath']
	},
	{
		id: 41,
		emoji: '<:Lil_zik:1560874138967482379>',
		chance: 650,
		name: "Lil' Zik",
		type: 'BOSS',
		altNames: ['LILZIK', 'TOB', 'THEATREOFBLOOD', 'ZIK'],
		formatFinish: (num: number) =>
			`You had to complete the Theatre of Blood ${fm(
				num
			)} times to get the Lil' Zik pet! <:Lil_zik:1560874138967482379>`,
		bossKeys: ['theatreofBlood']
	},
	{
		id: 42,
		emoji: '<:Ikkle_hydra:1560874125998817371>',
		chance: 3000,
		name: 'Ikkle hydra',
		type: 'BOSS',
		altNames: ['HYDRA', 'IKKLEHYDRA'],
		formatFinish: (num: number) =>
			`You had to slay the Alchemical Hydra ${fm(
				num
			)} times to get the Ikkle hydra pet! <:Ikkle_hydra:1560874125998817371>`,
		bossKeys: ['alchemicalHydra']
	},
	{
		id: 43,
		emoji: '<:Smolcano:1560874247520256062>',
		chance: 3000,
		name: 'Smolcano',
		type: 'BOSS',
		altNames: ['ZALCANO'],
		formatFinish: (num: number) =>
			`You had to take down Zalcano ${fm(num)} times to get the Smolcano pet! <:Smolcano:1560874247520256062>`,
		bossKeys: ['zalcano']
	},
	{
		id: 44,
		emoji: '<:Youngllef:1560874275349463060>',
		chance: 800,
		name: 'Youngllef',
		type: 'BOSS',
		altNames: ['GAUNTLET', 'YOUNGLEF'],
		formatFinish: (num: number) =>
			`You had to complete the Corrupted Gauntlet ${fm(
				num
			)} times to get the Youngllef pet! <:Youngllef:1560874275349463060> This took you ${fm(num * 0.15)} hours.`,
		bossKeys: ['theGauntlet', 'theCorruptedGauntlet']
	},
	{
		id: 45,
		emoji: '<:Sraracha:1560874488843866142>',
		chance: 3000,
		name: 'Sraracha',
		type: 'BOSS',
		altNames: ['SRARACHA', 'SARACHNIS', 'SARACH'],
		formatFinish: (num: number) =>
			`You had to kill Sarachnis ${fm(num)} times to get the Sraracha pet! <:Sraracha:1560874488843866142>`,
		bossKeys: ['sarachnis']
	},
	{
		id: 46,
		emoji: '<:Little_nightmare:1560880790240239689>',
		chance: 3800,
		name: 'Little nightmare',
		type: 'BOSS',
		altNames: ['NIGHTMARE', 'LILNIGHTMARE'],
		formatFinish: (num: number) =>
			`You had to kill The Nightmare ${fm(
				num
			)} times to get the Little nightmare pet! <:Little_nightmare:1560880790240239689>`,
		bossKeys: ['nightmare']
	},
	{
		id: 47,
		emoji: '<:Lil_creator:1560872595220340816>',
		chance: 400,
		name: "Lil' Creator",
		type: 'SPECIAL',
		altNames: ['LILDESTRUCTOR', 'LILCREATOR', 'SOULWARS'],
		formatFinish: (num: number) =>
			`You had to open ${fm(num)} Spoils of war to get the Lil' Creator! <:Lil_creator:1560872595220340816>`,
		bossKeys: ['soulwars']
	},
	{
		id: 48,
		emoji: '<:TinyTempor:1560873176672641084>',
		chance: 8000,
		name: 'Tiny Tempor',
		type: 'SPECIAL',
		altNames: ['TINYTEMPOR', 'TEMPOROSS'],
		formatFinish: (num: number) =>
			`You had to spend ${fm(num)} Permits to get the Tiny Tempor! <:TinyTempor:1560873176672641084>`,
		bossKeys: ['tempoross']
	},
	{
		id: 49,
		emoji: '<:Nexling:1560874144038654082>',
		chance: 500,
		name: 'Nexling',
		type: 'SPECIAL',
		altNames: ['NEXLING'],
		formatFinish: (num: number) =>
			`You had to kill Nex ${fm(num)} times to get Nexling! <:Nexling:1560874144038654082>`
	},
	{
		id: 50,
		chance: 4000,
		name: 'Abyssal protector',
		type: 'SPECIAL',
		altNames: ['ABYSSALPROTECTOR', 'PROTECTOR', 'GOTR'],
		formatFinish: (num: number) =>
			`You had to close ${fm(num)} Guardians of the Rift rifts to get the Abyssal protector! :pet:`
	},
	{
		id: 51,
		chance: 650,
		name: "Tumeken's guardian",
		type: 'BOSS',
		altNames: ['TUMEKENSGUARDIAN', 'TOA', 'TOMBS'],
		formatFinish: (num: number) =>
			`You had to complete Tombs of Amascut ${fm(num)} times to get Tumeken's guardian! :pet:`,
		bossKeys: ['tombsofAmascut', 'tombsofAmascutExpert']
	},
	{
		id: 52,
		chance: 2500,
		name: 'Muphin',
		type: 'BOSS',
		altNames: ['MUPHIN', 'MUSPAH', 'PHANTOMMUSPAH'],
		formatFinish: (num: number) => `You had to kill Phantom Muspah ${fm(num)} times to get Muphin! :pet:`,
		bossKeys: ['phantomMuspah']
	},
	{
		id: 53,
		chance: 2500,
		name: 'Baron',
		type: 'BOSS',
		altNames: ['BARON', 'DUKE', 'DUKESUCELLUS'],
		formatFinish: (num: number) => `You had to kill Duke Sucellus ${fm(num)} times to get Baron! :pet:`,
		bossKeys: ['dukeSucellus']
	},
	{
		id: 54,
		chance: 3000,
		name: 'Butch',
		type: 'BOSS',
		altNames: ['BUTCH', 'VARDORVIS'],
		formatFinish: (num: number) => `You had to kill Vardorvis ${fm(num)} times to get Butch! :pet:`,
		bossKeys: ['vardorvis']
	},
	{
		id: 55,
		chance: 2500,
		name: "Lil'viathan",
		type: 'BOSS',
		altNames: ['LILVIATHAN', 'LEVIATHAN', 'THELEVIATHAN'],
		formatFinish: (num: number) => `You had to kill The Leviathan ${fm(num)} times to get Lil'viathan! :pet:`,
		bossKeys: ['theLeviathan']
	},
	{
		id: 56,
		chance: 2000,
		name: 'Wisp',
		type: 'BOSS',
		altNames: ['WISP', 'WHISPERER', 'THEWHISPERER'],
		formatFinish: (num: number) => `You had to kill The Whisperer ${fm(num)} times to get Wisp! :pet:`,
		bossKeys: ['theWhisperer']
	},
	{
		id: 57,
		chance: 3000,
		name: 'Scurry',
		type: 'BOSS',
		altNames: ['SCURRY', 'SCURRIUS'],
		formatFinish: (num: number) => `You had to kill Scurrius ${fm(num)} times to get Scurry! :pet:`,
		bossKeys: ['scurrius']
	},
	{
		id: 58,
		chance: 200,
		name: 'Smol heredit',
		type: 'BOSS',
		altNames: ['SMOLHEREDIT', 'SOLHEREDIT', 'COLOSSEUM'],
		formatFinish: (num: number) => `You had to defeat Sol Heredit ${fm(num)} times to get Smol heredit! :pet:`,
		bossKeys: ['solHeredit']
	},
	{
		id: 59,
		chance: 1000,
		name: 'Quetzin',
		type: 'SKILL',
		altNames: ['QUETZIN', 'HUNTER', 'RUMOURS', 'HUNTERSRUMOURS'],
		formatFinish: (num: number) => `You had to open ${fm(num)} Hunters' loot sacks to get Quetzin! :pet:`
	},
	{
		id: 60,
		chance: 3000,
		name: 'Nid',
		type: 'BOSS',
		altNames: ['NID', 'ARAXXOR', 'RAX'],
		formatFinish: (num: number) => `You had to kill Araxxor ${fm(num)} times to get Nid! :pet:`,
		bossKeys: ['araxxor']
	},
	{
		id: 61,
		chance: 400,
		name: 'Huberte',
		type: 'BOSS',
		altNames: ['HUBERTE', 'HUEY', 'HUEYCOATL', 'THEHUEYCOATL'],
		formatFinish: (num: number) => `You had to kill The Hueycoatl ${fm(num)} times to get Huberte! :pet:`,
		bossKeys: ['theHueycoatl']
	},
	{
		id: 62,
		chance: 3000,
		name: 'Moxi',
		type: 'BOSS',
		altNames: ['MOXI', 'AMOXLIATL'],
		formatFinish: (num: number) => `You had to kill Amoxliatl ${fm(num)} times to get Moxi! :pet:`,
		bossKeys: ['amoxliatl']
	},
	{
		id: 63,
		chance: 3000,
		name: 'Bran',
		type: 'BOSS',
		altNames: ['BRAN', 'ROYALTITANS', 'TITANS'],
		formatFinish: (num: number) => `You had to defeat the Royal Titans ${fm(num)} times to get Bran! :pet:`
	},
	{
		id: 64,
		chance: 2500,
		name: 'Yami',
		type: 'BOSS',
		altNames: ['YAMI', 'YAMA'],
		formatFinish: (num: number) => `You had to defeat Yama ${fm(num)} times to get Yami! :pet:`
	},
	{
		id: 65,
		chance: 1000,
		name: 'Dom',
		type: 'BOSS',
		altNames: ['DOM', 'DOOMOFMOKHAIOTL', 'MOKHAIOTL'],
		formatFinish: (num: number) => `You had to defeat Doom of Mokhaiotl ${fm(num)} times to get Dom! :pet:`
	},
	{
		id: 66,
		chance: 4691,
		name: 'Soup',
		type: 'SKILL',
		altNames: ['SOUP', 'SAILING'],
		formatFinish: (num: number) => `You had to complete ${fm(num)} Sailing activities to get Soup! :pet:`
	},
	{
		id: 67,
		chance: 1000,
		name: 'Beef',
		type: 'BOSS',
		altNames: ['BEEF', 'BRUTUS', 'DEMONICBRUTUS'],
		formatFinish: (num: number) => `You had to defeat Brutus ${fm(num)} times to get Beef! :pet:`
	}
];

for (const pet of pets) {
	Items.getOrThrow(pet.name);
}

export default pets;
