import path from 'node:path';
import * as dotenv from 'dotenv';
import * as z from 'zod';

const isProduction = process.env.NODE_ENV === 'production';
const REAL_SUPPORT_SERVER_ID = '342983479501389826';
export const TEST_SERVER_ID = '940758552425955348';
export const MASS_HOSTER_ROLE_ID = '734055552933429280';

dotenv.config({ path: path.resolve(process.cwd(), process.env.TEST ? '.env.test' : '.env') });

const globalConfigSchema = z.object({
	httpPort: z.coerce.number().int(),
	alabastorPatreonToken: z.string().min(10).optional(),
	isProduction: z.boolean().default(false),
	githubToken: z.string().min(10).optional(),
	alabastorPatreonCampaignID: z.string().min(2).optional(),
	botToken: z.string().min(10),
	appID: z.string().min(10),
	supportServerID: z.string().min(10),
	alabastorPatreonWebhookSecret: z.string().min(10).optional(),
	alabastorPatreonTier1ID: z.string().min(1).optional(),
	alabastorPatreonTier2ID: z.string().min(1).optional(),
	alabastorPatreonTier3ID: z.string().min(1).optional(),
	alabastorPatreonTier4ID: z.string().min(1).optional(),
	alabastorPatreonTier5ID: z.string().min(1).optional(),
	alabastorPatreonTier6ID: z.string().min(1).optional(),
	alabastorPatreonTier7ID: z.string().min(1).optional(),
	githubWebhookSecret: z.string().min(10).optional(),
	patronLogWebhookURL: z.string().min(10),
	apiUrl: z.url(),
	frontendUrl: z.url(),
	cookieOrigin: z.string()
});

export const globalConfig = globalConfigSchema.parse({
	httpPort: process.env.HTTP_PORT,
	alabastorPatreonToken: process.env.ALABASTOR_PATREON_TOKEN,
	isProduction,
	githubToken: process.env.GITHUB_TOKEN,
	alabastorPatreonCampaignID: process.env.ALABASTOR_PATREON_CAMPAIGN_ID,
	botToken: process.env.BOT_TOKEN,
	appID: process.env.APP_ID,
	supportServerID:
		process.env.SUPPORT_SERVER_ID ?? (isProduction ? REAL_SUPPORT_SERVER_ID : process.env.SUPPORT_SERVER_ID),
	alabastorPatreonWebhookSecret: process.env.ALABASTOR_PATREON_WEBHOOK_SECRET,
	alabastorPatreonTier1ID: process.env.ALABASTOR_PATREON_TIER_1_ID,
	alabastorPatreonTier2ID: process.env.ALABASTOR_PATREON_TIER_2_ID,
	alabastorPatreonTier3ID: process.env.ALABASTOR_PATREON_TIER_3_ID,
	alabastorPatreonTier4ID: process.env.ALABASTOR_PATREON_TIER_4_ID,
	alabastorPatreonTier5ID: process.env.ALABASTOR_PATREON_TIER_5_ID,
	alabastorPatreonTier6ID: process.env.ALABASTOR_PATREON_TIER_6_ID,
	alabastorPatreonTier7ID: process.env.ALABASTOR_PATREON_TIER_7_ID,
	githubWebhookSecret: process.env.GITHUB_WEBHOOK_SECRET,
	patronLogWebhookURL: process.env.PATRON_LOGS_WEBHOOK,
	apiUrl: process.env.API_URL,
	frontendUrl: process.env.FRONTEND_URL,
	cookieOrigin: process.env.COOKIE_ORIGIN
});

if (!process.env.OAUTH_SECRET) {
	throw new Error('OAUTH_SECRET is not set in environment variables');
}
