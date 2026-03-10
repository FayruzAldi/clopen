/**
 * Route Permission Configuration
 *
 * Defines which WebSocket routes require authentication and which require admin role.
 * Used by the auth gate in WSRouter.handleMessage().
 */

/** Routes that can be accessed WITHOUT authentication */
export const PUBLIC_ROUTES = new Set([
	'auth:status',
	'auth:login',
	'auth:setup',
	'auth:accept-invite',
	'auth:validate-invite',
	'ws:set-context'
]);

/** Routes that require admin role */
export const ADMIN_ONLY_ROUTES = new Set([
	'auth:create-invite',
	'auth:list-invites',
	'auth:revoke-invite',
	'auth:list-users',
	'auth:remove-user',
	'settings:update-system'
]);

/**
 * Check if a route action is allowed for the given auth state.
 */
export function checkRouteAccess(
	action: string,
	authenticated: boolean,
	role: string | null
): { allowed: boolean; error?: string } {
	// Public routes — always allowed
	if (PUBLIC_ROUTES.has(action)) {
		return { allowed: true };
	}

	// Must be authenticated for everything else
	if (!authenticated) {
		return { allowed: false, error: 'Authentication required' };
	}

	// Admin-only routes
	if (ADMIN_ONLY_ROUTES.has(action) && role !== 'admin') {
		return { allowed: false, error: 'Admin access required' };
	}

	// All other routes — any authenticated user
	return { allowed: true };
}
