/**
 * Auth Store — Svelte 5 Runes
 *
 * Manages authentication state: setup, login, invite, and session persistence.
 * Session token is stored in localStorage for cross-refresh persistence.
 * The token is validated against the server on each app load.
 */

import ws from '$frontend/lib/utils/ws';
import { debug } from '$shared/utils/logger';

const SESSION_TOKEN_KEY = 'clopen-session-token';

export type AuthState = 'loading' | 'setup' | 'login' | 'invite' | 'ready';

export interface AuthUser {
	id: string;
	name: string;
	role: 'admin' | 'member';
	color: string;
	avatar: string;
	createdAt: string;
}

// Reactive state
let authState = $state<AuthState>('loading');
let currentUser = $state<AuthUser | null>(null);
let sessionToken = $state<string | null>(null);
let personalAccessToken = $state<string | null>(null);

export const authStore = {
	get authState() { return authState; },
	get currentUser() { return currentUser; },
	get sessionToken() { return sessionToken; },
	/** PAT is only available right after setup/invite accept — shown once */
	get personalAccessToken() { return personalAccessToken; },

	get isAdmin() { return currentUser?.role === 'admin'; },
	get isAuthenticated() { return authState === 'ready' && currentUser !== null; },

	/**
	 * Initialize auth — called on app mount.
	 * Determines which page to show: setup, login, invite, or main app.
	 */
	async initialize() {
		authState = 'loading';

		try {
			// Wait for WebSocket connection
			await ws.waitUntilConnected(10000);

			// Read stored session token
			const storedToken = localStorage.getItem(SESSION_TOKEN_KEY);

			// If we have a stored token, try to authenticate
			if (storedToken) {
				try {
					const result = await ws.http('auth:login', { token: storedToken });
					currentUser = result.user;
					sessionToken = result.sessionToken;
					// Update stored token (may have been refreshed)
					localStorage.setItem(SESSION_TOKEN_KEY, result.sessionToken);
					// Set token on WS client for reconnection auth
					ws.setSessionToken(result.sessionToken);
					authState = 'ready';
					debug.log('auth', `Authenticated: ${result.user.name} (${result.user.role})`);
					return;
				} catch {
					// Token invalid or expired — clear and continue
					localStorage.removeItem(SESSION_TOKEN_KEY);
					sessionToken = null;
					debug.log('auth', 'Stored session token invalid, clearing');
				}
			}

			// Check if invite token is in URL hash
			const hash = window.location.hash;
			if (hash.startsWith('#invite/')) {
				authState = 'invite';
				return;
			}

			// Check server status
			const status = await ws.http('auth:status', {});

			if (status.needsSetup) {
				authState = 'setup';
			} else {
				authState = 'login';
			}
		} catch (error) {
			debug.error('auth', 'Auth initialization failed:', error);
			// Fallback: try to check status
			try {
				const status = await ws.http('auth:status', {});
				authState = status.needsSetup ? 'setup' : 'login';
			} catch {
				authState = 'login';
			}
		}
	},

	/**
	 * Setup — create first admin account.
	 */
	async setup(name: string) {
		const result = await ws.http('auth:setup', { name });
		currentUser = result.user;
		sessionToken = result.sessionToken;
		personalAccessToken = result.personalAccessToken;
		localStorage.setItem(SESSION_TOKEN_KEY, result.sessionToken);
		ws.setSessionToken(result.sessionToken);
		// Don't set authState to 'ready' yet — setup page shows PAT first
		debug.log('auth', `Admin setup complete: ${result.user.name}`);
	},

	/**
	 * Complete setup — transition to ready state after user has copied PAT.
	 */
	completeSetup() {
		personalAccessToken = null;
		authState = 'ready';
	},

	/**
	 * Login with a token (PAT or session token).
	 */
	async login(token: string) {
		const result = await ws.http('auth:login', { token });
		currentUser = result.user;
		sessionToken = result.sessionToken;
		localStorage.setItem(SESSION_TOKEN_KEY, result.sessionToken);
		ws.setSessionToken(result.sessionToken);
		authState = 'ready';
		debug.log('auth', `Logged in: ${result.user.name} (${result.user.role})`);
	},

	/**
	 * Accept invite — create account from invite token.
	 */
	async acceptInvite(inviteToken: string, name: string) {
		const result = await ws.http('auth:accept-invite', { inviteToken, name });
		currentUser = result.user;
		sessionToken = result.sessionToken;
		personalAccessToken = result.personalAccessToken;
		localStorage.setItem(SESSION_TOKEN_KEY, result.sessionToken);
		ws.setSessionToken(result.sessionToken);
		// Clear invite hash from URL
		window.location.hash = '';
		debug.log('auth', `Invite accepted: ${result.user.name}`);
	},

	/**
	 * Complete invite — transition to ready after user has copied PAT.
	 */
	completeInvite() {
		personalAccessToken = null;
		authState = 'ready';
	},

	/**
	 * Logout — clear session.
	 */
	async logout() {
		try {
			await ws.http('auth:logout', {});
		} catch {
			// Ignore errors during logout
		}
		currentUser = null;
		sessionToken = null;
		personalAccessToken = null;
		localStorage.removeItem(SESSION_TOKEN_KEY);
		ws.setSessionToken(null);
		authState = 'login';
		debug.log('auth', 'Logged out');
	},

	/**
	 * Update display name.
	 */
	async updateName(newName: string) {
		const updated = await ws.http('auth:update-name', { newName });
		currentUser = updated;
		debug.log('auth', `Name updated: ${updated.name}`);
	},

	/**
	 * Regenerate Personal Access Token.
	 */
	async regeneratePAT(): Promise<string> {
		const result = await ws.http('auth:regenerate-pat', {});
		return result.personalAccessToken;
	}
};
