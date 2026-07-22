export const FACTORY_ANNOTATION_REVEAL_EVENT = 'mfd:factory-annotation-reveal';
export const revealFactoryAnnotation = (id: string): void => {
  document.dispatchEvent(new CustomEvent(FACTORY_ANNOTATION_REVEAL_EVENT, { detail: id }));
};
