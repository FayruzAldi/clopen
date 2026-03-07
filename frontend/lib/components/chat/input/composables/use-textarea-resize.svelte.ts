export function useTextareaResize() {
	// Auto-resize textarea with proper single-line reset
	const MAX_HEIGHT_PX = 22.5 * 16; // 360px = 22.5rem

	function adjustTextareaHeight(
		textareaElement: HTMLTextAreaElement | undefined,
		messageText: string
	) {
		if (textareaElement) {
			// Reset height to auto first to get accurate scrollHeight
			textareaElement.style.height = 'auto';

			// If content is empty or only whitespace, keep at minimum height
			if (!messageText || !messageText.trim()) {
				// Force single line height
				textareaElement.style.height = 'auto';
				textareaElement.style.overflowY = 'hidden';
				return;
			}

			// Calculate required height based on content
			const scrollHeight = textareaElement.scrollHeight + 7;
			const lineHeight = parseInt(getComputedStyle(textareaElement).lineHeight) || 24;
			const paddingTop = parseInt(getComputedStyle(textareaElement).paddingTop) || 0;
			const paddingBottom = parseInt(getComputedStyle(textareaElement).paddingBottom) || 0;
			const minHeight = lineHeight + paddingTop + paddingBottom;

			const newHeight = Math.max(minHeight, scrollHeight);

			if (newHeight >= MAX_HEIGHT_PX) {
				textareaElement.style.height = '22.5rem';
				textareaElement.style.overflowY = 'auto';
			} else {
				textareaElement.style.height = newHeight / 16 + 'rem';
				textareaElement.style.overflowY = 'hidden';
			}
		}
	}

	// Handle textarea input with debouncing for better performance
	function handleTextareaInput(
		textareaElement: HTMLTextAreaElement | undefined,
		messageText: string
	) {
		adjustTextareaHeight(textareaElement, messageText);
	}

	// Handle key events for better resize behavior
	function handleKeyDown(
		event: KeyboardEvent,
		textareaElement: HTMLTextAreaElement | undefined,
		messageText: string
	) {
		// Delay adjustment slightly for delete/backspace to ensure DOM is updated
		if (event.key === 'Backspace' || event.key === 'Delete') {
			setTimeout(() => {
				adjustTextareaHeight(textareaElement, messageText);
			}, 0);
		}
	}

	return {
		adjustTextareaHeight,
		handleTextareaInput,
		handleKeyDown
	};
}
