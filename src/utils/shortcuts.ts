import { state } from './state';
import { matchesHotkey, isEditableTarget } from './hotkeys';
import { handleTranslateToggle, handleLearningToggle, isSpicyLyricsOpen } from './core';
import { applySettingById } from './settings';
import { requestCurrentLearningBreakdown } from './translationOverlay';
import { notify } from './notify';

const SHORTCUT_TOAST_KEY = 'slt-shortcut';

function toggleLearningFromShortcut(): void {
    if (!state.learningMode) {
        applySettingById('learning-mode', true);
        notify({ kind: 'info', title: 'Learning Mode on', key: SHORTCUT_TOAST_KEY });
        return;
    }
    handleLearningToggle();
    notify({ kind: 'info', title: state.learningVisible ? 'Learning Mode cards shown' : 'Learning Mode cards hidden', key: SHORTCUT_TOAST_KEY });
}

function breakDownCurrentLine(): void {
    if (!isSpicyLyricsOpen()) return;
    if (!state.learningMode || !state.learningVisible) {
        notify({ kind: 'info', title: 'Show Learning Mode to break lines down', key: SHORTCUT_TOAST_KEY });
        return;
    }
    if (!requestCurrentLearningBreakdown()) {
        notify({ kind: 'info', title: 'No line to break down yet', key: SHORTCUT_TOAST_KEY });
    }
}

function onShortcutKeydown(event: KeyboardEvent): void {
    if (event.repeat || isEditableTarget(event.target)) return;

    const actions: [string, () => void][] = [
        [state.translateHotkey, () => { if (isSpicyLyricsOpen()) handleTranslateToggle(); }],
        [state.learningHotkey, toggleLearningFromShortcut],
        [state.breakdownHotkey, breakDownCurrentLine]
    ];
    const match = actions.find(([hotkey]) => matchesHotkey(event, hotkey));
    if (!match) return;

    event.preventDefault();
    event.stopPropagation();
    match[1]();
}

const attachedDocuments = new WeakSet<Document>();

export function attachShortcuts(doc: Document = document): void {
    if (attachedDocuments.has(doc)) return;
    attachedDocuments.add(doc);
    doc.addEventListener('keydown', onShortcutKeydown);
}
