import { betterAuth, type GenericEndpointContext, type HookEndpointContext } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import {
    createAuthorizationURL,
    validateAuthorizationCode,
    refreshAccessToken as refreshOAuthToken,
    type OAuth2Tokens,
    type OAuthProvider,
    type ProviderOptions,
} from "better-auth/oauth2";
import type { SocialProviders } from "better-auth/social-providers";
import { db } from "@/db";
import { account, session, user, verification } from "@/db/schema/auth";
import { mondayIntegrations } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

type MondayProfile = {
    me: {
        id: string;
        name: string;
        email: string | null;
        photo_small?: string | null;
        teams?: Array<{ id: string; name: string }>;
        account?: { id: string; slug?: string };
    };
};

type PersistMondayTokensParams = {
    userId: string;
    tokens: OAuth2Tokens;
    profile: MondayProfile["me"];
    scopes?: string[];
};

type MondayProviderOptions = ProviderOptions & { defaultScopes?: string[] };

const MONDAY_AUTHORIZATION_URL = "https://auth.monday.com/oauth2/authorize";
const MONDAY_TOKEN_URL = "https://auth.monday.com/oauth2/token";
const MONDAY_GRAPHQL_URL = "https://api.monday.com/v2";
const DEFAULT_MONDAY_SCOPES = ["boards:read", "boards:write", "users:read"];

const ensureMondayOAuthEnv = () => {
    const clientId = process.env.MONDAY_CLIENT_ID;
    const clientSecret = process.env.MONDAY_CLIENT_SECRET;
    const redirectURI =
        process.env.MONDAY_REDIRECT_URI ||
        `${process.env.BETTER_AUTH_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/auth/monday/callback`;

    if (!clientId) {
        throw new Error("MONDAY_CLIENT_ID is not configured");
    }

    if (!clientSecret) {
        throw new Error("MONDAY_CLIENT_SECRET is not configured");
    }

    return { clientId, clientSecret, redirectURI };
};

const normalizeScopes = (scopes?: string[] | null) => scopes?.map((scope) => scope.trim()).filter(Boolean);

const createMondayProvider = (options: MondayProviderOptions): OAuthProvider<MondayProfile> => {
    const scope = normalizeScopes(options.scope ?? options.defaultScopes) ?? DEFAULT_MONDAY_SCOPES;

    return {
        id: "monday",
        name: "Monday.com",
        options,
        async createAuthorizationURL({ state, codeVerifier, scopes, redirectURI }) {
            return createAuthorizationURL({
                id: "monday",
                options: { ...options, scope },
                authorizationEndpoint: MONDAY_AUTHORIZATION_URL,
                state,
                codeVerifier,
                scopes: scopes?.length ? scopes : scope,
                redirectURI,
                responseType: "code",
            });
        },
        async validateAuthorizationCode({ code, redirectURI, codeVerifier }) {
            return validateAuthorizationCode({
                code,
                redirectURI,
                codeVerifier,
                options,
                tokenEndpoint: MONDAY_TOKEN_URL,
                authentication: "post",
            });
        },
        async getUserInfo(token) {
            if (!token.accessToken) {
                return null;
            }

            const response = await fetch(MONDAY_GRAPHQL_URL, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: token.accessToken,
                },
                body: JSON.stringify({
                    query: `
                        query MeQuery {
                            me {
                                id
                                name
                                email
                                photo_small
                                account { id slug }
                                teams { id name }
                            }
                        }
                    `,
                }),
            });

            if (!response.ok) {
                const text = await response.text();
                throw new Error(`Failed to fetch Monday user profile: ${response.status} ${text}`);
            }

            const payload = (await response.json()) as {
                data?: MondayProfile;
                errors?: Array<{ message: string }>;
            };

            if (payload.errors?.length) {
                const errorMessage = payload.errors.map((error) => error.message).join("; ");
                throw new Error(errorMessage);
            }

            const profile = payload.data?.me;

            if (!profile) {
                return null;
            }

            return {
                user: {
                    id: profile.id,
                    name: profile.name,
                    email: profile.email,
                    image: profile.photo_small ?? undefined,
                    emailVerified: Boolean(profile.email),
                },
                data: { me: profile },
            };
        },
        async refreshAccessToken(refreshToken) {
            return refreshOAuthToken({
                refreshToken,
                options,
                tokenEndpoint: MONDAY_TOKEN_URL,
                authentication: "post",
                extraParams: { grant_type: "refresh_token" },
            });
        },
    };
};

const persistMondayTokens = async ({ userId, tokens, profile, scopes }: PersistMondayTokensParams) => {
    const accessToken = tokens.accessToken;
    if (!accessToken) {
        throw new Error("Missing Monday access token");
    }

    const mondayAccountId = profile.account?.id ?? "unknown";
    const mondayUserId = profile.id;

    const [existing] = await db
        .select()
        .from(mondayIntegrations)
        .where(eq(mondayIntegrations.userId, userId))
        .limit(1);

    const payload = {
        userId,
        mondayAccountId,
        mondayUserId,
        accessToken,
        refreshToken: tokens.refreshToken ?? null,
        tokenExpiresAt: tokens.accessTokenExpiresAt ?? null,
        refreshTokenExpiresAt: tokens.refreshTokenExpiresAt ?? null,
        scopes: scopes?.length ? scopes.join(" ") : tokens.scopes?.join(" ") ?? null,
        updatedAt: new Date(),
    } satisfies Partial<(typeof mondayIntegrations)["$inferInsert"]>;

    if (existing) {
        await db
            .update(mondayIntegrations)
            .set(payload)
            .where(eq(mondayIntegrations.id, existing.id));
    } else {
        await db.insert(mondayIntegrations).values({
            ...payload,
            createdAt: new Date(),
        });
    }
};

const mondayProviderOptions: MondayProviderOptions = {
    ...ensureMondayOAuthEnv(),
    scope: normalizeScopes(process.env.MONDAY_OAUTH_SCOPES?.split(",") ?? undefined) ?? DEFAULT_MONDAY_SCOPES,
    defaultScopes: DEFAULT_MONDAY_SCOPES,
};

export const mondayOAuthProvider = createMondayProvider(mondayProviderOptions);

export const mondayAuth = betterAuth({
    database: drizzleAdapter(db, {
        provider: "pg",
        schema: {
            user,
            account,
            session,
            verification,
        },
    }),
    socialProviders: {
        monday: mondayOAuthProvider,
    } as SocialProviders,
    hooks: {
        after: [
            {
                matcher: (context: HookEndpointContext) =>
                    (context.params?.provider ?? context.query?.provider) === "monday",
                handler: async (ctx: GenericEndpointContext) => {
                    type OAuthContext = {
                        tokens?: OAuth2Tokens;
                        profile?: MondayProfile;
                        account?: { userId?: string };
                        scopes?: string[];
                    };

                    const extendedContext = ctx as GenericEndpointContext & { oauth?: OAuthContext };
                    const fallbackContext = (ctx as { context?: { oauth?: OAuthContext } }).context;
                    const oauthContext = extendedContext.oauth ?? fallbackContext?.oauth;
                    const tokens = oauthContext?.tokens;
                    const profile = oauthContext?.profile;
                    const accountEntity = oauthContext?.account ?? (ctx as { account?: { userId?: string } }).account;
                    const scopes = oauthContext?.scopes;

                    if (!tokens || !profile || !accountEntity?.userId) {
                        return;
                    }

                    await persistMondayTokens({
                        userId: accountEntity.userId,
                        tokens,
                        profile: profile.me,
                        scopes,
                    });
                },
            },
        ],
    },
});

export const refreshMondayIntegrationToken = async (integrationId: string) => {
    const [integration] = await db
        .select()
        .from(mondayIntegrations)
        .where(eq(mondayIntegrations.id, integrationId))
        .limit(1);

    if (!integration) {
        throw new Error(`Integration ${integrationId} was not found`);
    }

    if (!integration.refreshToken) {
        throw new Error("No refresh token stored for the Monday integration");
    }

    const env = ensureMondayOAuthEnv();

    const tokens = await refreshOAuthToken({
        refreshToken: integration.refreshToken,
        options: env,
        tokenEndpoint: MONDAY_TOKEN_URL,
        authentication: "post",
        extraParams: { grant_type: "refresh_token" },
    });

    await db
        .update(mondayIntegrations)
        .set({
            accessToken: tokens.accessToken ?? integration.accessToken,
            refreshToken: tokens.refreshToken ?? integration.refreshToken,
            tokenExpiresAt: tokens.accessTokenExpiresAt ?? integration.tokenExpiresAt,
            refreshTokenExpiresAt: tokens.refreshTokenExpiresAt ?? integration.refreshTokenExpiresAt,
            scopes: tokens.scopes?.length ? tokens.scopes.join(" ") : integration.scopes,
            updatedAt: new Date(),
        })
        .where(eq(mondayIntegrations.id, integrationId));

    return tokens;
};
