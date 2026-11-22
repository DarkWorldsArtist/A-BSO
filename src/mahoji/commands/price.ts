import { EmbedBuilder } from '@oldschoolgg/discord';
import { Items, toKMB } from 'oldschooljs';

import { itemOption } from '@/discord/index.js';
import { marketPricemap } from '@/lib/cache.js';
import { GrandExchange } from '@/lib/grandExchange.js';
import itemIsTradeable from '@/lib/util/itemIsTradeable.js';
import { sellPriceOfItem } from '@/mahoji/commands/sell.js';

export const priceCommand = defineCommand({
	name: 'price',
	description: 'Looks up the price of an item.',
	options: [
		{
			...itemOption(item => Boolean(item.tradeable_on_ge || item.tradeable || itemIsTradeable(item.id))),
			name: 'item',
			required: true
		}
	],
	run: async ({ options }) => {
		const item = Items.getItem(options.item);
		if (!item || item.customItemData?.isSecret) return "Couldn't find that item.";

		const { basePrice: priceOfItem, price: sellPrice } = sellPriceOfItem(item);
		const marketData = marketPricemap.get(item.id);
		const isGETradeable = itemIsTradeable(item.id);

		const lines = [`**Price:** ${toKMB(priceOfItem)} (${priceOfItem.toLocaleString()} GP)`];
		if (marketData) {
			lines.push(
				`**Market price:** ${toKMB(marketData.guidePrice)} (${marketData.guidePrice.toLocaleString()} GP)`,
				`**Recent GE price:** ${toKMB(marketData.averagePriceLast100)} (${marketData.averagePriceLast100.toLocaleString()} GP)`
			);
		}
		lines.push(
			`**Sell price:** ${toKMB(sellPrice)} (${sellPrice.toLocaleString()} GP)`,
			`**Alch value:** ${toKMB(item.highalch ?? 0)} (${(item.highalch ?? 0).toLocaleString()} GP)`
		);
		if (isGETradeable) {
			lines.push(`**Buy limit (4h):** ${GrandExchange.getItemBuyLimit(item).toLocaleString()}`);
		}

		const embed = new EmbedBuilder()
			.setTitle(item.name)
			.setColor(52_224)
			.setThumbnail(
				`https://raw.githubusercontent.com/runelite/static.runelite.net/gh-pages/cache/item/icon/${item.id}.png`
			)
			.setDescription(lines.join('\n'));

		return { embeds: [embed] };
	}
});
