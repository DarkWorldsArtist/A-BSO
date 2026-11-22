import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

export const PARTY_BALLOON_COLORS = ['red', 'blue', 'yellow', 'green', 'pink', 'white', 'dual', 'tri'] as const;
export type PartyBalloonColor = (typeof PARTY_BALLOON_COLORS)[number];

export type PartyBalloonEmojiName = `party_balloon_${PartyBalloonColor}` | `party_balloon_${PartyBalloonColor}_burst`;

const PARTY_ROOM_ASSETS_DIR = path.resolve('src/lib/resources/images/party_room');

const applicationEmojiCache = new Map<string, { id: string; name: string }>();
let hasSynced = false;

export function getApplicationEmoji(name: PartyBalloonEmojiName): { id: string; name: string } | undefined {
	return applicationEmojiCache.get(name);
}

export function formatApplicationEmoji(name: PartyBalloonEmojiName): string {
	const entry = applicationEmojiCache.get(name);
	if (!entry) return '';
	return `<:${entry.name}:${entry.id}>`;
}

export async function syncApplicationEmojis(): Promise<void> {
	if (hasSynced || process.env.TEST) return;
	if (!globalClient?.applicationId || !globalClient?.rest) return;
	if (!existsSync(PARTY_ROOM_ASSETS_DIR)) return;

	try {
		const route = `/applications/${globalClient.applicationId}/emojis` as const;
		const existingRes = (await globalClient.rest.get(route)) as
			| { items?: Array<{ id: string; name: string }> }
			| Array<{ id: string; name: string }>;

		const existingItems = Array.isArray(existingRes) ? existingRes : (existingRes?.items ?? []);
		for (const item of existingItems) {
			if (item?.id && item?.name) {
				applicationEmojiCache.set(item.name, { id: item.id, name: item.name });
			}
		}

		const files = readdirSync(PARTY_ROOM_ASSETS_DIR).filter(f => f.endsWith('.png'));
		for (const file of files) {
			const emojiName = path.basename(file, '.png');
			if (applicationEmojiCache.has(emojiName)) continue;

			const fileBuffer = readFileSync(path.join(PARTY_ROOM_ASSETS_DIR, file));
			const dataUri = `data:image/png;base64,${fileBuffer.toString('base64')}`;

			const created = (await globalClient.rest.post(route, {
				body: {
					name: emojiName,
					image: dataUri
				}
			})) as { id?: string; name?: string };

			if (created?.id && created?.name) {
				applicationEmojiCache.set(created.name, { id: created.id, name: created.name });
			}
		}

		hasSynced = true;
	} catch (err) {
		Logging.logError(err as Error);
	}
}
