export const elementEvent = (element, eventName, eventData) => element.dispatchEvent(new CustomEvent(eventName, {detail: eventData, bubbles: true, cancelable: true, composed: true}));

export const documentEvent = (eventName, eventData) => elementEvent(document.documentElement, eventName, eventData);
