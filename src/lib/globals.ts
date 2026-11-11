import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import path from 'node:path';
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

function recoverPgLiteWal(dataDir: string) {
	const ctrlPath = path.join(dataDir, 'global', 'pg_control');
	if (!existsSync(ctrlPath)) return;
	const ctrlBuf = readFileSync(ctrlPath);
	const sysId = ctrlBuf.readBigUInt64LE(0);
	const checkPointCopy = Buffer.from(ctrlBuf.subarray(40, 128));

	const table = new Uint32Array(256);
	for (let i = 0; i < 256; i++) {
		let c = i;
		for (let j = 0; j < 8; j++) c = c & 1 ? 0x82f63b78 ^ (c >>> 1) : c >>> 1;
		table[i] = c;
	}
	function crc32c(b: Buffer, start: number, len: number, init = 0xffffffff) {
		let crc = init;
		for (let i = start; i < start + len; i++) {
			crc = table[(crc ^ b[i]) & 0xff] ^ (crc >>> 8);
		}
		return crc;
	}

	const walDir = path.join(dataDir, 'pg_wal');
	let maxSeg = 0x90n;
	if (existsSync(walDir)) {
		for (const f of readdirSync(walDir)) {
			if (f.match(/^[0-9A-F]{24}$/i)) {
				const seg = BigInt(`0x${f.slice(16)}`);
				if (seg > maxSeg) maxSeg = seg;
			}
		}
	}
	const newSegNo = maxSeg + 1n;
	const segSize = 0x100000n;
	const segStartLSN = newSegNo * segSize;
	const redoLSN = segStartLSN + 0x28n;

	checkPointCopy.writeBigUInt64LE(redoLSN, 0);
	checkPointCopy.writeUInt32LE(1, 8);
	checkPointCopy.writeUInt32LE(1, 12);

	const walBuf = Buffer.alloc(Number(segSize));
	walBuf.writeUInt16LE(0xd116, 0);
	walBuf.writeUInt16LE(0x0002, 2);
	walBuf.writeUInt32LE(1, 4);
	walBuf.writeBigUInt64LE(segStartLSN, 8);
	walBuf.writeUInt32LE(0, 16);
	walBuf.writeUInt32LE(0, 20);
	walBuf.writeBigUInt64LE(sysId, 24);
	walBuf.writeUInt32LE(Number(segSize), 32);
	walBuf.writeUInt32LE(8192, 36);

	const recOff = 40;
	walBuf.writeUInt32LE(114, recOff + 0);
	walBuf.writeUInt32LE(0, recOff + 4);
	walBuf.writeBigUInt64LE(0n, recOff + 8);
	walBuf.writeUInt8(0, recOff + 16);
	walBuf.writeUInt8(0, recOff + 17);
	walBuf.writeUInt16LE(0, recOff + 18);
	walBuf.writeUInt8(0xff, recOff + 24);
	walBuf.writeUInt8(0x58, recOff + 25);
	checkPointCopy.copy(walBuf, recOff + 26, 0, 88);

	const c1 = crc32c(walBuf, recOff + 24, 114 - 24);
	const c2 = crc32c(walBuf, recOff, 20, c1);
	const recCrc = (c2 ^ 0xffffffff) >>> 0;
	walBuf.writeUInt32LE(recCrc, recOff + 20);

	if (existsSync(walDir)) {
		for (const f of readdirSync(walDir)) {
			if (f.match(/^[0-9A-F]{24}$/i)) {
				try {
					unlinkSync(path.join(walDir, f));
				} catch {}
			}
		}
	}
	const walFileName = `0000000100000000000000${newSegNo.toString(16).toUpperCase()}`;
	writeFileSync(path.join(walDir, walFileName), walBuf);

	ctrlBuf.writeUInt32LE(1, 16);
	ctrlBuf.writeBigUInt64LE(redoLSN, 32);
	checkPointCopy.copy(ctrlBuf, 40, 0, 88);
	ctrlBuf.writeBigUInt64LE(0n, 112);
	ctrlBuf.writeBigUInt64LE(0n, 120);
	ctrlBuf.writeBigUInt64LE(0n, 136);
	ctrlBuf.writeUInt32LE(0, 144);

	const ctrlCrc = (crc32c(ctrlBuf, 0, 288) ^ 0xffffffff) >>> 0;
	ctrlBuf.writeUInt32LE(ctrlCrc, 288);
	writeFileSync(ctrlPath, ctrlBuf);
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
	for (const f of ['postmaster.pid', '.s.PGSQL.5432.lock.out']) {
		const lockPath = path.join(dataDir, f);
		if (existsSync(lockPath)) {
			try {
				unlinkSync(lockPath);
			} catch {}
		}
	}
	let pgLiteClient: PGlite;
	try {
		pgLiteClient = new PGlite({ dataDir });
		await pgLiteClient.query('SELECT 1;');
	} catch (err: any) {
		Logging.logError(err);
		Logging.logDebug(`Attempting WAL recovery for PGlite ${type} database...`);
		recoverPgLiteWal(dataDir);
		pgLiteClient = new PGlite({ dataDir });
	}
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
	if (type !== 'robochimp') {
		const functionsPath = path.join(process.cwd(), './prisma/sql/functions.sql');
		if (existsSync(functionsPath)) {
			try {
				const functionsSQL = readFileSync(functionsPath, 'utf8');
				await pgLiteClient.exec(functionsSQL);
			} catch (err: any) {
				Logging.logError(err);
			}
		}
	}
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
