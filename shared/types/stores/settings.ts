import type { EngineType } from '$shared/types/engine';

/** Per-user settings (stored per user) */
export interface AppSettings {
	selectedEngine: EngineType;
	selectedModel: string;
	/** Remembers the last selected model per engine so switching engines preserves choices */
	engineModelMemory: Record<string, string>;
	autoSave: boolean;
	theme: 'light' | 'dark' | 'system';
	soundNotifications: boolean;
	pushNotifications: boolean;
	layoutPresetVisibility: Record<string, boolean>;
	/** Base font size in pixels (10–20). Default: 13. */
	fontSize: number;
}

/** System-wide settings (admin-only, shared across all users) */
export interface SystemSettings {
	/** Restrict folder browser to only these base paths. Empty = no restriction. */
	allowedBasePaths: string[];
	/** Automatically update to the latest version when available. Default: false. */
	autoUpdate: boolean;
	/** Session lifetime in days. Default: 30. */
	sessionLifetimeDays: number;
}
