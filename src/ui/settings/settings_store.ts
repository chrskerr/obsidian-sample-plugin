import { writable } from "svelte/store";
import { z } from "zod";

export enum VisibilityOption {
	Auto = "auto",
	NeverShow = "never",
	AlwaysShow = "always",
}

export enum ScopeOption {
	Folder = "folder",
	Everywhere = "everywhere",
}

const settingsObject = z.object({
	columns: z.array(z.string()),
	scope: z.nativeEnum(ScopeOption).default(ScopeOption.Folder),
	showFilepath: z.boolean().default(true).optional(),
	consolidateTags: z.boolean().default(false).optional(),
	uncategorizedVisibility: z
		.nativeEnum(VisibilityOption)
		.default(VisibilityOption.Auto)
		.optional(),
	doneVisibility: z
		.nativeEnum(VisibilityOption)
		.default(VisibilityOption.AlwaysShow)
		.optional(),
	defaultTaskPath: z.string().optional(),
});

export type SettingValues = z.infer<typeof settingsObject>;

export const defaultSettings: SettingValues = {
	columns: ["Later", "Soonish", "Next week", "This week", "Today", "Pending"],
	scope: ScopeOption.Folder,
	showFilepath: true,
	consolidateTags: false,
	uncategorizedVisibility: VisibilityOption.Auto,
	doneVisibility: VisibilityOption.AlwaysShow,
	defaultTaskPath: "Tasks.md",
};

export const createSettingsStore = () =>
	writable<SettingValues>(defaultSettings);

const nonEnforcedFields: (keyof SettingValues)[] = ["defaultTaskPath"];

export function parseSettingsString(settingsString: string): SettingValues {
	/**
	 * Safely parse & partially merge settings from JSON.
	 *
	 * If input is empty/invalid => return full defaults (a "new" board).
	 * If input is valid => merge with defaults but omit `defaultTaskPath`
	 * unless user explicitly provided it (including empty string).
	 */

	try {
		// If there's no content in settingsString at all, assume a brand-new board
		if (!settingsString.trim()) {
			return defaultSettings;
		}

		// 2. Attempt JSON parse
		let parsedConfig: unknown;
		try {
			parsedConfig = JSON.parse(settingsString);
		} catch {
			// Malformed JSON => treat as new
			return defaultSettings;
		}

		// 3. Validate with Zod
		const ValidatedSettings = settingsObject.safeParse(parsedConfig);
		if (!ValidatedSettings.success) {
			// Invalid shape => treat as new
			return defaultSettings;
		}

		// 4. Merge validated user data with defaults, ensuring missing optional fields
		//    get default values while keeping any explicitly set values from the user's config.
		const mergedSettings = {
			...defaultSettings,
			...ValidatedSettings.data,
		};

		// 5. Remove non enforced fields if they weren't explicitly provided
		nonEnforcedFields.forEach((field) => {
			if (!Object.prototype.hasOwnProperty.call(parsedConfig, field)) {
				console.log(`Removing optional field: ${field}`);
				delete mergedSettings[field];
			}
		});

		return mergedSettings;
	} catch {
		// If something above throws an error, reset to defaults
		return defaultSettings;
	}
}

export function toSettingsString(settings: SettingValues): string {
	return JSON.stringify(settings);
}
