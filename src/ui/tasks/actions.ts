import {
	MarkdownView,
	Menu,
	TFile,
	type Vault,
	type Workspace,
} from "obsidian";
import type { Task } from "./task";
import type { Metadata } from "./tasks";
import type { ColumnTag } from "../columns/columns";
import { type Writable } from "svelte/store";
import type { SettingValues } from "../settings/settings_store";
import { get } from "svelte/store";

export type TaskActions = {
	changeColumn: (id: string, column: ColumnTag) => Promise<void>;
	markDone: (id: string) => Promise<void>;
	updateContent: (id: string, content: string) => Promise<void>;
	viewFile: (id: string) => Promise<void>;
	archiveTasks: (ids: string[]) => Promise<void>;
	deleteTask: (ids: string) => Promise<void>;
	addNew: (column: ColumnTag, e: MouseEvent) => Promise<void>;
};

export function createTaskActions({
	tasksByTaskId,
	metadataByTaskId,
	vault,
	workspace,
	settingsStore,
}: {
	tasksByTaskId: Map<string, Task>;
	metadataByTaskId: Map<string, Metadata>;
	vault: Vault;
	workspace: Workspace;
	settingsStore: Writable<SettingValues>;
}): TaskActions {
	async function updateRowWithTask(
		id: string,
		updater: (task: Task) => void
	) {
		const metadata = metadataByTaskId.get(id);
		const task = tasksByTaskId.get(id);

		if (!metadata || !task) {
			return;
		}

		updater(task);

		const newTaskString = task.serialise();
		await updateRow(
			vault,
			metadata.fileHandle,
			metadata.rowIndex,
			newTaskString
		);
	}

	return {
		async changeColumn(id, column) {
			await updateRowWithTask(id, (task) => (task.column = column));
		},

		async markDone(id) {
			await updateRowWithTask(id, (task) => (task.done = true));
		},

		async updateContent(id, content) {
			await updateRowWithTask(id, (task) => (task.content = content));
		},

		async archiveTasks(ids) {
			for (const id of ids) {
				await updateRowWithTask(id, (task) => task.archive());
			}
		},

		async deleteTask(id) {
			await updateRowWithTask(id, (task) => task.delete());
		},

		async viewFile(id) {
			const metadata = metadataByTaskId.get(id);

			if (!metadata) {
				return;
			}

			const { fileHandle, rowIndex } = metadata;

			const leaf = workspace.getLeaf("tab");
			await leaf.openFile(fileHandle);

			const editorView = workspace.getActiveViewOfType(MarkdownView);
			editorView?.editor.setCursor(rowIndex);
		},

		async addNew(column, e) {
			// Get configured default path from settings
			const defaultTaskPath = get(settingsStore).defaultTaskPath;

			if (defaultTaskPath?.trim()) {
				// Get the kanban board's directory path
				const currentFilePath =
					workspace.getActiveFile()?.parent?.path || "";

				// Determine if path is absolute (starts with / or \) or relative
				const isAbsolutePath = /^[/\\]/.test(defaultTaskPath);

				// If relative path, combine with current directory
				let fullPath = isAbsolutePath
					? defaultTaskPath
					: `${currentFilePath}/${defaultTaskPath}`.replace(
							/\/+/g,
							"/"
					  );

				// Add .md extension if needed
				if (
					!fullPath.endsWith("/") &&
					!fullPath.endsWith("\\") &&
					!fullPath.endsWith(".md")
				) {
					fullPath += ".md";
				}

				// Extract folder path from full file path
				const folderPath = fullPath.substring(
					0,
					fullPath.lastIndexOf("/")
				);

				// Create folder structure if needed
				if (folderPath) {
					const folderExists = await vault.adapter.exists(folderPath);
					if (!folderExists) {
						await vault.createFolder(folderPath);
					}
				}

				// Create the markdown file if needed
				const exists = await vault.adapter.exists(fullPath);
				if (!exists) {
					await vault.create(fullPath, "");
				}

				// Get file handle and validate it's a markdown file
				const file = vault.getAbstractFileByPath(fullPath);
				if (file instanceof TFile) {
					updateRow(vault, file, undefined, `- [ ]  #${column}`);
					return;
				}
			}

			// Rest of existing file picker code...

			const target = e.target as HTMLButtonElement | undefined;
			if (!target) {
				return;
			}

			const boundingRect = target.getBoundingClientRect();
			const y = boundingRect.top + boundingRect.height / 2;
			const x = boundingRect.left + boundingRect.width / 2;

			function createMenu(folder: Folder, parentMenu: Menu | undefined) {
				const menu = new Menu();
				menu.addItem((i) => {
					i.setTitle(parentMenu ? `← back` : "Choose a file")
						.setDisabled(!parentMenu)
						.onClick(() => {
							parentMenu?.showAtPosition({ x: x, y: y });
						});
				});

				for (const [label, folderItem] of Object.entries(folder)) {
					menu.addItem((i) => {
						i.setTitle(
							folderItem instanceof TFile ? label : label + " →"
						).onClick(() => {
							if (folderItem instanceof TFile) {
								updateRow(
									vault,
									folderItem,
									undefined,
									`- [ ]  #${column}`
								);
							} else {
								createMenu(folderItem, menu);
							}
						});
					});
				}

				menu.showAtPosition({ x: x, y: y });
			}

			interface Folder {
				[label: string]: Folder | TFile;
			}
			const folder: Folder = {};

			const files = vault
				.getMarkdownFiles()
				.sort((a, b) => a.path.localeCompare(b.path));

			for (const file of files) {
				const segments = file.path.split("/");

				let currFolder = folder;
				for (const [i, segment] of segments.entries()) {
					if (i === segments.length - 1) {
						currFolder[segment] = file;
					} else {
						const nextFolder = currFolder[segment] || {};
						if (nextFolder instanceof TFile) {
							continue;
						}
						currFolder[segment] = nextFolder;
						currFolder = nextFolder;
					}
				}
			}

			createMenu(folder, undefined);
		},
	};
}

async function updateRow(
	vault: Vault,
	fileHandle: TFile,
	row: number | undefined,
	newText: string
) {
	const file = await vault.read(fileHandle);
	const rows = file.split("\n");

	if (row == null) {
		row = rows.length;
	}

	if (rows.length < row) {
		return;
	}

	if (newText === "") {
		rows.splice(row, 1);
	} else {
		rows[row] = newText;
	}
	const newFile = rows.join("\n");
	await vault.modify(fileHandle, newFile);
}
