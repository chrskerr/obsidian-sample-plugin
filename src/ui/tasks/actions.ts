import { MarkdownView, type TFile, type Vault, type Workspace } from "obsidian";
import type { Task } from "./task";
import type { Metadata } from "./tasks";
import type { ColumnTag, DefaultColumns } from "../columns/columns";

export type TaskActions = {
	changeColumn: (
		id: string,
		newColumn: ColumnTag | Exclude<DefaultColumns, "uncategorised">
	) => Promise<void>;
	viewFile: (id: string) => Promise<void>;
};

export function createTaskActions({
	tasksByTaskId,
	metadataByTaskId,
	vault,
	workspace,
}: {
	tasksByTaskId: Map<string, Task>;
	metadataByTaskId: Map<string, Metadata>;
	vault: Vault;
	workspace: Workspace;
}): TaskActions {
	async function changeColumn(
		id: string,
		newColumn: ColumnTag | Exclude<DefaultColumns, "uncategorised">
	) {
		const metadata = metadataByTaskId.get(id);
		const task = tasksByTaskId.get(id);

		if (!metadata || !task) {
			return;
		}

		const newTaskString = task.serialise({ column: newColumn });
		await updateRow(
			vault,
			metadata.fileHandle,
			metadata.rowIndex,
			newTaskString
		);
	}

	async function viewFile(id: string) {
		const metadata = metadataByTaskId.get(id);

		if (!metadata) {
			return;
		}

		const { fileHandle, rowIndex } = metadata;

		const leaf = workspace.getLeaf("tab");
		await leaf.openFile(fileHandle);
		const editorView = workspace.getActiveViewOfType(MarkdownView);
		editorView?.editor.setCursor(rowIndex);
	}

	return { changeColumn, viewFile };
}

async function updateRow(
	vault: Vault,
	fileHandle: TFile,
	row: number,
	newText: string
) {
	const file = await vault.read(fileHandle);
	const rows = file.split("\n");

	if (rows.length < row) {
		return;
	}

	rows[row] = newText;
	const newFile = rows.join("\n");
	await vault.modify(fileHandle, newFile);
}
