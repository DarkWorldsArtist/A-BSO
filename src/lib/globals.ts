import { execSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { rewriteSqlToIdempotent } from '@oldschoolgg/toolkit';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaPGlite } from 'pglite-prisma-adapter';

import { PrismaClient as RobochimpPrismaClient } from '@/prisma/clients/robochimp/client.js';
import { PrismaClient } from '@/prisma/main.js';
import { BOT_TYPE, globalConfig } from '@/lib/constants.js';

async function syncMissingPgLiteColumns(pgLiteClient: PGlite, createDbSQL: string) {
	const existingColsRes = await pgLiteClient.query<{ table_name: string; column_name: string }>(
		"SELECT table_name, column_name FROM information_schema.columns WHERE table_schema = 'public';"
	);
	const existingSet = new Set(existingColsRes.rows.map(r => `${r.table_name}.${r.column_name}`));
	const tableRegex = /CREATE\s+TABLE\s+"([^"]+)"\s*\(([\s\S]*?)\);\s*/gi;
	const alterStatements: string[] = [];

	for (const match of createDbSQL.matchAll(tableRegex)) {
		const tableName = match[1]!;
		const body = match[2]!;
		for (const rawLine of body.split('\n')) {
			const line = rawLine.trim().replace(/,$/, '');
			if (!line.startsWith('"')) continue;
			const colMatch = line.match(/^"([^"]+)"\s+(.+)$/);
			if (!colMatch) continue;
			const colName = colMatch[1]!;
			if (!existingSet.has(`${tableName}.${colName}`)) {
				alterStatements.push(`ALTER TABLE "${tableName}" ADD COLUMN IF NOT EXISTS ${line};`);
			}
		}
	}

	if (alterStatements.length > 0) {
		await pgLiteClient.exec(alterStatements.join('\n'));
	}
}

async function getAdapter(
	type: typeof BOT_TYPE | 'robochimp'
): Promise<{ adapter: PrismaPg; pgLiteClient: PGlite | null }> {
	const shouldUseRealPostgres = globalConfig.isProduction || process.env.USE_REAL_PG === '1';
	if (shouldUseRealPostgres) {
		const connectionString = type === 'robochimp' ? process.env.ROBOCHIMP_DATABASE_URL : process.env.DATABASE_URL;
		Logging.logDebug(`Using Real Postgres for ${type} database`);
		return {
			adapter: new PrismaPg(
				{
					connectionString,
					idleTimeoutMillis: 60_000,
					max: 100,
					min: 20
				},
				{ onPoolError: Logging.logError, onConnectionError: Logging.logError }
			),
			pgLiteClient: null
		};
	}

	Logging.logDebug(`Using PGLite for ${type} database`);
	if (!existsSync('./.db')) {
		mkdirSync('./.db');
	}
	const dataDir = `./.db/${type.toLowerCase()}${process.env.TEST ? '-test' : ''}`;
	const pgLiteClient = new PGlite({ dataDir });
	const originalPgLiteQuery = pgLiteClient.query.bind(pgLiteClient);
	pgLiteClient.query = ((...args: Parameters<typeof pgLiteClient.query>) => {
		const [sql, params, options] = args;
		const parsers = {
			...options?.parsers,
			1016: (val: string) =>
				val
					? val
							.slice(1, -1)
							.split(',')
							.map(s => s.trim())
							.filter(Boolean)
					: []
		};
		return originalPgLiteQuery(sql, params, { ...options, parsers });
	}) as typeof pgLiteClient.query;
	const createDbSQL = execSync(
		`prisma migrate diff --from-empty --to-schema-datamodel ./prisma/${type === 'robochimp' ? 'robochimp' : 'schema'}.prisma --script`,
		{
			encoding: 'utf-8'
		}
	);
	await pgLiteClient.exec(rewriteSqlToIdempotent(createDbSQL));
	await syncMissingPgLiteColumns(pgLiteClient, createDbSQL);
	const adapter = new PrismaPGlite(pgLiteClient) as any as PrismaPg;
	return { adapter, pgLiteClient };
}

async function makePrismaClient() {
	const { adapter, pgLiteClient } = await getAdapter(BOT_TYPE);
	const prismaClient = new PrismaClient({
		log: [{ emit: 'event', level: 'query' }, 'info', 'warn'],
		adapter,
		transactionOptions: {
			maxWait: 15_000,
			timeout: 250_000
		}
	});
	prismaClient.$on('query', e => {
		const info = {
			text: `Prisma Query`,
			duration: e.duration,
			query: e.query,
			params: e.params,
			target: 'bot-db'
		};
		if (info.query.length > 1000) {
			info.query = `${info.query.slice(0, 1000)}...`;
		}
		if (info.params.length > 1000) {
			info.params = `${info.params.slice(0, 1000)}...`;
		}
		Logging.logPerf(info);
	});
	return { prismaClient, adapter, pgLiteClient };
}

interface RoboChimpDB {
	prismaClient: RobochimpPrismaClient;
	adapter: PrismaPg | PrismaPGlite;
	pgLiteClient: PGlite | null;
}
async function makeRobochimpPrismaClient(): Promise<RoboChimpDB> {
	const { adapter, pgLiteClient } = await getAdapter('robochimp');
	const prismaClient = new RobochimpPrismaClient({
		log: ['warn', 'info'],
		adapter
	});
	return { prismaClient, adapter, pgLiteClient };
}

export async function createDb() {
	global.prisma = global.prisma || (await makePrismaClient()).prismaClient;
	global.roboChimpClient = global.roboChimpClient || (await makeRobochimpPrismaClient()).prismaClient;
	return { prisma: global.prisma, roboChimpClient: global.roboChimpClient };
}

declare global {
	var prisma: PrismaClient;
	var roboChimpClient: RobochimpPrismaClient;
}
