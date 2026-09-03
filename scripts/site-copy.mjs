export const DIAGRAM_TYPES = Object.freeze([
  'architecture',
  'workflow',
  'sequence',
  'dataflow',
  'lifecycle',
]);

export const DIAGRAM_TYPE_LABELS = Object.freeze({
  architecture: 'Architecture',
  workflow: 'Workflow',
  sequence: 'Sequence',
  dataflow: 'Data flow',
  lifecycle: 'Lifecycle',
});

export function diagramTypeCopyReplacements() {
  const replacements = {
    '[[DIAGRAM_TYPES_JSON]]': JSON.stringify(DIAGRAM_TYPES),
    '[[DIAGRAM_TYPE_LABELS_JSON]]': JSON.stringify(DIAGRAM_TYPE_LABELS),
  };

  for (const type of DIAGRAM_TYPES) {
    const placeholder = type.toUpperCase();
    replacements[`[[DIAGRAM_TYPE_${placeholder}_EN]]`] = DIAGRAM_TYPE_LABELS[type];
  }

  return replacements;
}
