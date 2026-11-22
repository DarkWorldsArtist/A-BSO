import { EmbedBuilder } from '@oldschoolgg/discord';

import { PATREON_URL, SUPPORT_PROJECT_MSG } from '@/lib/constants.js';

export const patreonCommand = defineCommand({
	name: 'patreon',
	description: 'Shows the patreon link and tier benefits for the bot.',
	options: [],
	run: async () => {
		const embed = new EmbedBuilder()
			.setTitle('A-BSO Patron Tiers & Perks')
			.setColor(16_750_592)
			.setDescription(
				[
					SUPPORT_PROJECT_MSG,
					'',
					'**Tier 1 ($5/mo):** +5m max trip length, custom unique item outline color, custom minion icon, trip loot value toggle, `cl_bank` JSON export, `give_box` (24h), Autofarm button, Yeti clue, +3 GE slots, 2 pinned trips, 8 gear presets.',
					'**Tier 2 ($10/mo):** +10m max trip length, default `/bank` overlay flag, custom `/bank` title color, custom tame images & tame bank view, giveaway entry indicator, +6 GE slots, 3 pinned trips, 10 gear presets.',
					'**Tier 3 ($15/mo - Bond Tier):** +15m max trip length (+3m sacrifice bonus), 1 trip queue slot, `spawnbox` (45m) & `spawnlamp` (24h), global stats & XP/KC/clue gain leaderboards, `minion_stats`, unlimited giveaways, +12 GE slots, 4 pinned trips, 12 gear presets.',
					'**Tier 4 ($20/mo):** +20m max trip length, 2 trip queue slots, 12h `spawnlamp` cooldown, monthly 20m Double Loot or Double XP trigger, Falador Party Room (1 wave), +14 GE slots, 6 pinned trips, 14 gear presets.',
					'**Tier 5 ($25/mo):** +25m max trip length, 4 trip queue slots, 30m `spawnbox` cooldown, monthly 45m Double Loot or Double XP trigger, Falador Party Room (2 waves), Box Frenzy (6 items), custom personal bank background eligibility, +16 GE slots, 8 pinned trips, 16 gear presets.',
					'**Tier 6 ($50/mo):** +25m max trip length, 4 trip queue depth (5 daily cap), monthly 90m Double Loot/XP (or 45m Dual DL+DXP), Falador Party Room (2 waves, 3d CD), Box Frenzy (10 items), +18 GE slots, 10 pinned trips, 18 gear presets.',
					'**Tier 7 ($100/mo):** +25m max trip length, 4 trip queue depth (6 daily cap), monthly 180m Double Loot/XP (or 90m Dual DL+DXP), Falador Party Room (3 waves, 3d CD), Box Frenzy (15 items), custom bank background + purple variant eligibility, +20 GE slots, 12 pinned trips, 20 gear presets.'
				].join('\n')
			);
		return {
			content: PATREON_URL,
			embeds: [embed]
		};
	}
});
