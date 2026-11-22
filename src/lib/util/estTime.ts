const EST_TIMEZONE = 'America/New_York';

function getESTParts(date = new Date()) {
	const parts = new Intl.DateTimeFormat('en-US', {
		timeZone: EST_TIMEZONE,
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
		hour: '2-digit',
		minute: '2-digit',
		second: '2-digit',
		hour12: false
	}).formatToParts(date);

	const map: Record<string, number> = {};
	for (const p of parts) {
		if (p.type !== 'literal') {
			map[p.type] = Number(p.value);
		}
	}
	return {
		year: map.year,
		month: map.month,
		day: map.day,
		hour: map.hour === 24 ? 0 : map.hour,
		minute: map.minute,
		second: map.second
	};
}

export function getESTDateKey(date = new Date()): string {
	return new Intl.DateTimeFormat('en-CA', { timeZone: EST_TIMEZONE }).format(date);
}

export function getPreviousESTDateKey(date = new Date()): string {
	const todayParts = getESTParts(date);
	const approxYesterday = new Date(Date.UTC(todayParts.year, todayParts.month - 1, todayParts.day - 1, 12, 0, 0));
	return getESTDateKey(approxYesterday);
}

export function getNextESTMidnight(date = new Date()): Date {
	const parts = getESTParts(date);
	const remainingMs =
		((23 - parts.hour) * 3600 + (59 - parts.minute) * 60 + (60 - parts.second)) * 1000 - date.getMilliseconds();
	const candidate = new Date(date.getTime() + remainingMs);
	const candParts = getESTParts(candidate);
	if (candParts.hour === 23) {
		return new Date(candidate.getTime() + 3600_000);
	}
	if (candParts.hour === 1) {
		return new Date(candidate.getTime() - 3600_000);
	}
	return candidate;
}

export function getESTMidnightAfterDays(days: number, fromDate = new Date()): Date {
	let target = getNextESTMidnight(fromDate);
	for (let i = 1; i < days; i++) {
		target = getNextESTMidnight(new Date(target.getTime() + 60_000));
	}
	return target;
}

export function getESTWeekKey(date = new Date()): string {
	const parts = getESTParts(date);
	const utcMidday = new Date(Date.UTC(parts.year, parts.month - 1, parts.day, 12, 0, 0));
	const dow = utcMidday.getUTCDay();
	const diffToMonday = dow === 0 ? -6 : 1 - dow;
	utcMidday.setUTCDate(utcMidday.getUTCDate() + diffToMonday);
	return getESTDateKey(utcMidday);
}

export function getNextESTWeekReset(date = new Date()): Date {
	const parts = getESTParts(date);
	const utcMidday = new Date(Date.UTC(parts.year, parts.month - 1, parts.day, 12, 0, 0));
	const dow = utcMidday.getUTCDay();
	const daysUntilMonday = dow === 0 ? 1 : 8 - dow;
	return getESTMidnightAfterDays(daysUntilMonday, date);
}

export function getESTMonthKey(date = new Date()): string {
	return getESTDateKey(date).slice(0, 7);
}

export function getNextESTMonthReset(date = new Date()): Date {
	const parts = getESTParts(date);
	const daysInMonth = new Date(Date.UTC(parts.year, parts.month, 0)).getUTCDate();
	const daysRemaining = daysInMonth - parts.day + 1;
	return getESTMidnightAfterDays(daysRemaining, date);
}

export function getEST4HourBucket(date = new Date()): Date {
	const parts = getESTParts(date);
	const bucketHour = Math.floor(parts.hour / 4) * 4;
	const msIntoBucket =
		((parts.hour - bucketHour) * 3600 + parts.minute * 60 + parts.second) * 1000 + date.getMilliseconds();
	return new Date(date.getTime() - msIntoBucket);
}
