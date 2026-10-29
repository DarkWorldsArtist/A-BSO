import type { Fish } from '@/lib/skilling/types.js';
import { Fishing } from './fishing.js';

export const FISHING_REWORK_MESSAGE = 'Warning: Fishing has been reworked.\n\nPlease send a fresh **/fish** command.';

export class FishingStoredTripError extends Error {
	constructor() {
		super(FISHING_REWORK_MESSAGE);
		this.name = 'FishingStoredTripError';
	}
}

function isValidFishingName(identifier: unknown): identifier is string {
	return typeof identifier === 'string' && identifier.length > 0;
}

export function findFishingSpotForStoredTrip(identifier: unknown): Fish | null {
	if (!isValidFishingName(identifier)) {
		return null;
	}

	const fish = Fishing.Fishes.find(spot => spot.name === identifier);
	if (!fish || !fish.subfishes || fish.subfishes.length === 0) {
		return null;
	}
	return fish;
}

export function ensureValidStoredFishingTripIdentifier(data: {
	fishID?: unknown;
	identifier?: unknown;
	fishName?: unknown;
}): Fish {
	const identifier = data.fishID ?? data.identifier ?? data.fishName;
	const fish = findFishingSpotForStoredTrip(identifier);
	if (!fish) {
		throw new FishingStoredTripError();
	}
	return fish;
}
