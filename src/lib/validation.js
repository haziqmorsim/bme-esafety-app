const CONTROLS = 'input, select, textarea';
const SKIP_TYPES = new Set(['hidden', 'submit', 'button', 'reset', 'image']);
const ANCHOR_WRAPPERS = '[data-field], .password-wrapper, .password-row, .upload';
const LABEL_SELECTOR = 'label, .forms-label, .image-text';

const errorFor = new WeakMap();
let counter = 0;

const isControl = (node) => node?.nodeType === 1 && node.matches?.(CONTROLS);

function isHidden(el) {
	return el.getClientRects().length === 0;
}

function isValidatable(el) {
	if (SKIP_TYPES.has(el.type)) return false;
	if (el.disabled) return false;
	if (el.closest('[data-no-validate]')) return false;
	if (isHidden(el)) return false;
	return true;
}

function plainText(node) {
	let out = '';
	for (const child of node.childNodes) {
		if (child.nodeType === 3) out += child.textContent;
		else if (child.nodeType === 1) {
			if (child.classList.contains('req-star') || child.classList.contains('field-error')) continue;
			if (isControl(child) || child.querySelector?.(CONTROLS)) continue;
			out += plainText(child);
		}
	}
	return out;
}

const clean = (text) =>
	text
		.replace(/\s+/g, ' ')
		.replace(/\s*\*\s*$/, '')
		.replace(/\s*:\s*$/, '')
		.replace(/^\d+\)\s*/, '')
		.trim();

const byKey = (key) => {
	if (!key || typeof document === 'undefined') return null;
	return document.querySelector(`[data-label-for="${CSS.escape(key)}"]`);
};

const isOptionLabel = (label) => {
	const control = label.control;
	return !!control && (control.type === 'radio' || control.type === 'checkbox');
};

export function getLabelElement(field) {
	const keyed = byKey(field.id) ?? (field.type === 'radio' ? byKey(field.name) : null);
	if (keyed) return keyed;

	const own = field.type === 'radio' ? null : field.labels?.[0];
	if (own) return own;

	let scope = field.parentElement;
	for (let depth = 0; scope && depth < 3; depth += 1, scope = scope.parentElement) {
		if (scope.tagName === 'FORM') break;
		const candidates = [...scope.children].filter(
			(c) => c.matches(LABEL_SELECTOR) && !(c.tagName === 'LABEL' && isOptionLabel(c))
		);
		const before = candidates.filter(
			(c) => c.compareDocumentPosition(field) & Node.DOCUMENT_POSITION_FOLLOWING
		);
		if (before.length) return before[before.length - 1];
	}
	return null;
}

export function getLabelText(field) {
	if (field.dataset.label) return field.dataset.label;
	const label = getLabelElement(field);
	const text = label ? clean(plainText(label)) : '';
	return text || field.getAttribute('aria-label') || clean(field.placeholder ?? '') || 'This field';
}

const isRequired = (el) => el.required || el.matches('[data-required]');

function radioGroup(radio, root) {
	if (!radio.name) return [radio];
	return [...root.querySelectorAll('input[type="radio"]')].filter(
		(r) => r.name === radio.name && r.form === radio.form
	);
}

export function getFieldError(field, root = field.form ?? document) {
	const label = getLabelText(field);
	const missing = field.dataset.message || `${label} is required.`;

	if (field.type === 'radio') {
		const group = radioGroup(field, root);
		if (group.some(isRequired) && !group.some((r) => r.checked)) {
			return group[0].dataset.message || missing;
		}
		return '';
	}

	if (field.type === 'checkbox') {
		if (isRequired(field) && !field.checked) return field.dataset.message || `${label} is required.`;
		return '';
	}

	if (field.type === 'file') {
		if (isRequired(field) && !(field.files && field.files.length)) return missing;
		return '';
	}

	if (field.dataset.filled === 'true') return '';

	const value = String(field.value ?? '');
	if (isRequired(field) && value.trim() === '') return missing;
	if (value === '') return '';

	const { validity } = field;
	if (field.type === 'email' && validity.typeMismatch && !('skipFormat' in field.dataset)) {
		return 'Enter a valid e-mail address.';
	}
	if (field.type === 'url' && validity.typeMismatch) return 'Enter a valid URL.';
	if (field.minLength > 0 && value.length < field.minLength) {
		return `${label} must be at least ${field.minLength} characters.`;
	}
	if (field.maxLength > -1 && value.length > field.maxLength) {
		return `${label} must be at most ${field.maxLength} characters.`;
	}
	if (validity.patternMismatch) return field.title || `${label} is not in the right format.`;
	if (validity.rangeUnderflow) return `${label} must be at least ${field.min}.`;
	if (validity.rangeOverflow) return `${label} must be at most ${field.max}.`;
	if (validity.badInput || validity.stepMismatch) return `Enter a valid value for ${label}.`;
	if (validity.customError) return field.validationMessage;
	return '';
}

function placeError(msg, targets) {
	const first = targets[0];
	const wrapper = first.closest('[data-field]');
	if (wrapper) {
		wrapper.insertAdjacentElement('afterend', msg);
	} else if (first.type === 'radio' || first.type === 'checkbox') {
		const row = first.parentElement;
		if (row && targets.every((t) => t.parentElement === row)) row.append(msg);
		else (row ?? first).insertAdjacentElement('afterend', msg);
	} else {
		(first.closest(ANCHOR_WRAPPERS) ?? first).insertAdjacentElement('afterend', msg);
	}
}

export function clearFieldError(field, root = field.form ?? document) {
	const targets = field.type === 'radio' ? radioGroup(field, root) : [field];
	for (const target of targets) {
		target.removeAttribute('aria-invalid');
		const described = target.getAttribute('aria-describedby');
		const msg = errorFor.get(target);
		if (msg && described) {
			const rest = described.split(' ').filter((id) => id !== msg.id);
			if (rest.length) target.setAttribute('aria-describedby', rest.join(' '));
			else target.removeAttribute('aria-describedby');
		}
		errorFor.delete(target);
		if (msg) msg.remove();
	}
}

export function showFieldError(field, message, root = field.form ?? document) {
	const targets = field.type === 'radio' ? radioGroup(field, root) : [field];
	const [first] = targets;

	let msg = errorFor.get(first);
	if (!msg || !msg.isConnected) {
		msg = document.createElement('span');
		msg.className = 'field-error';
		msg.id = `field-error-${++counter}`;
		msg.setAttribute('role', 'alert');
		placeError(msg, targets);
	}
	msg.textContent = message;

	for (const target of targets) {
		target.setAttribute('aria-invalid', 'true');
		const ids = new Set((target.getAttribute('aria-describedby') ?? '').split(' ').filter(Boolean));
		ids.add(msg.id);
		target.setAttribute('aria-describedby', [...ids].join(' '));
		errorFor.set(target, msg);
	}
}

const GROUPS = '[data-checkbox-group][data-required]';

function showGroupError(group, message) {
	let msg = errorFor.get(group);
	if (!msg || !msg.isConnected) {
		msg = document.createElement('span');
		msg.className = 'field-error';
		msg.id = `field-error-${++counter}`;
		msg.setAttribute('role', 'alert');
		group.insertAdjacentElement('afterend', msg);
		errorFor.set(group, msg);
	}
	msg.textContent = message;
	group.dataset.invalid = 'true';
}

function clearGroupError(group) {
	const msg = errorFor.get(group);
	if (msg) msg.remove();
	errorFor.delete(group);
	delete group.dataset.invalid;
}

function groupError(group) {
	if (group.querySelector('input[type="checkbox"]:checked')) return '';
	const label = group.dataset.label || clean(plainText(byKey(group.dataset.checkboxGroup) ?? group));
	return group.dataset.message || `Select at least one ${label || 'option'}.`;
}

function starOf(label) {
	return [...label.children].find((c) => c.classList.contains('req-star')) ?? null;
}

function addStar(label) {
	if (starOf(label)) return;
	const star = document.createElement('span');
	star.className = 'req-star';
	star.setAttribute('aria-hidden', 'true');
	star.textContent = '*';

	const text = label.querySelector(':scope > .label-text');
	if (text) {
		text.append(' ', star);
		return;
	}
	const inner = [...label.querySelectorAll(CONTROLS)].find((c) => c.closest('label') === label);
	if (inner) {
		let node = inner;
		while (node.parentElement && node.parentElement !== label) node = node.parentElement;
		label.insertBefore(star, node);
		label.insertBefore(document.createTextNode(' '), star);
		return;
	}
	label.append(' ', star);
}

function removeStar(label) {
	const star = starOf(label);
	if (!star) return;
	const before = star.previousSibling;
	if (before && before.nodeType === 3 && before.textContent === ' ') before.remove();
	star.remove();
}

export function syncStars(root) {
	const wanted = new Set();
	for (const el of root.querySelectorAll(CONTROLS)) {
		if (SKIP_TYPES.has(el.type) || el.disabled) continue;
		if (!isRequired(el)) continue;
		const label = getLabelElement(el);
		if (label) wanted.add(label);
		else if (el.type === 'checkbox' || el.type === 'radio') wanted.add(el);
	}

	for (const group of root.querySelectorAll(GROUPS)) {
		const label = byKey(group.dataset.checkboxGroup);
		if (label) wanted.add(label);
	}

	for (const star of root.querySelectorAll('.req-star')) {
		const owner = star.parentElement;
		if (owner && !wanted.has(owner) && !star.dataset.control) removeStar(owner);
		else if (star.dataset.control && !wanted.has(star.previousElementSibling)) star.remove();
	}

	for (const item of wanted) {
		if (item.matches?.(CONTROLS)) {
			if (!(item.nextElementSibling?.classList.contains('req-star'))) {
				const star = document.createElement('span');
				star.className = 'req-star';
				star.dataset.control = 'true';
				star.setAttribute('aria-hidden', 'true');
				star.textContent = '*';
				item.insertAdjacentElement('afterend', star);
			}
		} else {
			addStar(item);
		}
	}
}

export function validateForm(root, { focus = true } = {}) {
	if (!root) return true;
	const handledRadios = new Set();
	let firstInvalid = null;

	for (const el of root.querySelectorAll(CONTROLS)) {
		if (!isValidatable(el)) {
			clearFieldError(el, root);
			continue;
		}
		if (el.type === 'radio') {
			if (handledRadios.has(el.name || el)) continue;
			handledRadios.add(el.name || el);
		}

		const message = getFieldError(el, root);
		if (message) {
			showFieldError(el, message, root);
			firstInvalid ??= el;
		} else {
			clearFieldError(el, root);
		}
	}

	for (const group of root.querySelectorAll(GROUPS)) {
		if (group.closest('[data-no-validate]') || isHidden(group)) {
			clearGroupError(group);
			continue;
		}
		const message = groupError(group);
		if (message) {
			showGroupError(group, message);
			firstInvalid ??= group.querySelector('input[type="checkbox"]') ?? group;
		} else {
			clearGroupError(group);
		}
	}

	if (firstInvalid && focus) {
		firstInvalid.scrollIntoView({ block: 'center', behavior: 'smooth' });
		firstInvalid.focus({ preventScroll: true });
	}
	return !firstInvalid;
}

export function recheckInvalid(root) {
	for (const el of root.querySelectorAll('[aria-invalid="true"]')) {
		if (!isControl(el)) continue;
		const message = getFieldError(el, root);
		if (message) showFieldError(el, message, root);
		else clearFieldError(el, root);
	}
	for (const group of root.querySelectorAll('[data-checkbox-group][data-invalid]')) {
		const message = groupError(group);
		if (message) showGroupError(group, message);
		else clearGroupError(group);
	}
}

export function resetValidation(root) {
	for (const el of root.querySelectorAll(CONTROLS)) clearFieldError(el, root);
	for (const group of root.querySelectorAll(GROUPS)) clearGroupError(group);
}

export function checkSubmit(event) {
	const form = event?.currentTarget ?? event?.target;
	if (!form || typeof form.querySelectorAll !== 'function') return true;
	try {
		return validateForm(form);
	} catch (error) {
		console.error('Form validation failed to run', error);
		return typeof form.reportValidity === 'function' ? form.reportValidity() : false;
	}
}

export function validation(node) {
	if (node.tagName === 'FORM') node.noValidate = true;

	let queued = false;
	const sync = () => {
		queued = false;
		syncStars(node);
		observer.takeRecords();
	};
	const queue = () => {
		if (queued) return;
		queued = true;
		queueMicrotask(sync);
	};

	const observer = new MutationObserver(queue);
	observer.observe(node, {
		childList: true,
		subtree: true,
		attributes: true,
		attributeFilter: ['required', 'disabled', 'readonly', 'data-required']
	});
	sync();

	const onSubmit = (event) => {
		if (event.target !== node) return;
		let valid;
		try {
			valid = validateForm(node);
		} catch (error) {
			console.error('Form validation failed to run', error);
			valid = node.checkValidity();
			if (!valid) node.reportValidity();
		}
		if (!valid) {
			event.preventDefault();
			event.stopImmediatePropagation();
		}
	};

	const recheck = () => setTimeout(() => node.isConnected && recheckInvalid(node), 0);

	const onDocumentClick = recheck;

	if (node.tagName === 'FORM') document.addEventListener('submit', onSubmit, true);
	document.addEventListener('click', onDocumentClick);
	node.addEventListener('input', recheck);
	node.addEventListener('change', recheck);
	node.addEventListener('focusout', recheck);

	return {
		destroy() {
			observer.disconnect();
			document.removeEventListener('submit', onSubmit, true);
			document.removeEventListener('click', onDocumentClick);
			node.removeEventListener('input', recheck);
			node.removeEventListener('change', recheck);
			node.removeEventListener('focusout', recheck);
		}
	};
}