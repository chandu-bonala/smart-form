import type { QuestionItem } from '../api/questions-service';

export type ConditionalRuleOperator =
  | 'equals'
  | 'not_equals'
  | 'contains'
  | 'not_contains'
  | 'starts_with'
  | 'ends_with'
  | 'greater_than'
  | 'greater_than_or_equal'
  | 'less_than'
  | 'less_than_or_equal'
  | 'is_empty'
  | 'is_not_empty';

export type ConditionalRuleAction = 'show' | 'hide' | 'require' | 'unrequire';

export type ConditionalRuleLike = {
  trigger_field_id: string;
  trigger_operator: string;
  trigger_value?: string | null;
  target_field_id: string;
  target_action: string;
};

export const CONDITIONAL_OPERATORS: Array<{
  value: ConditionalRuleOperator;
  label: string;
  help: string;
}> = [
  { value: 'equals', label: 'Equals', help: 'Matches the answer exactly.' },
  { value: 'not_equals', label: 'Does not equal', help: 'Matches any answer except this value.' },
  { value: 'contains', label: 'Contains', help: 'Looks for a word or phrase inside the answer.' },
  { value: 'not_contains', label: 'Does not contain', help: 'Runs when the answer does not include this value.' },
  { value: 'starts_with', label: 'Starts with', help: 'Runs when the answer begins with this value.' },
  { value: 'ends_with', label: 'Ends with', help: 'Runs when the answer ends with this value.' },
  { value: 'greater_than', label: 'Greater than', help: 'Compares numeric answers only.' },
  { value: 'greater_than_or_equal', label: 'Greater than or equal', help: 'Compares numeric answers only.' },
  { value: 'less_than', label: 'Less than', help: 'Compares numeric answers only.' },
  { value: 'less_than_or_equal', label: 'Less than or equal', help: 'Compares numeric answers only.' },
  { value: 'is_empty', label: 'Is empty', help: 'Runs when the answer is blank.' },
  { value: 'is_not_empty', label: 'Is not empty', help: 'Runs when any answer is present.' },
];

export const CONDITIONAL_ACTIONS: Array<{
  value: ConditionalRuleAction;
  label: string;
  help: string;
}> = [
  { value: 'show', label: 'Show field', help: 'Makes the target question visible.' },
  { value: 'hide', label: 'Hide field', help: 'Removes the target question from the form.' },
  { value: 'require', label: 'Require field', help: 'Forces the target question to be answered.' },
  { value: 'unrequire', label: 'Make optional', help: 'Lets the target question stay optional.' },
];

export const shouldRuleUseValue = (operator: string) => !['is_empty', 'is_not_empty'].includes(operator);

export const getConditionalOperatorLabel = (operator: string) =>
  CONDITIONAL_OPERATORS.find((item) => item.value === operator)?.label ?? operator.replace(/_/g, ' ');

export const getConditionalActionLabel = (action: string) =>
  CONDITIONAL_ACTIONS.find((item) => item.value === action)?.label ?? action.replace(/_/g, ' ');

export const evaluateConditionalOperator = (
  triggerValue: string | null | undefined,
  operator: string,
  comparisonValue?: string | null,
) => {
  const value = (triggerValue ?? '').toString().trim();
  const comparison = (comparisonValue ?? '').toString().trim();
  const normalizedValue = value.toLowerCase();
  const normalizedComparison = comparison.toLowerCase();

  if (operator === 'equals') return normalizedValue === normalizedComparison;
  if (operator === 'not_equals') return normalizedValue !== normalizedComparison;
  if (operator === 'contains') return normalizedComparison.length > 0 && normalizedValue.includes(normalizedComparison);
  if (operator === 'not_contains') return normalizedComparison.length > 0 && !normalizedValue.includes(normalizedComparison);
  if (operator === 'starts_with') return normalizedComparison.length > 0 && normalizedValue.startsWith(normalizedComparison);
  if (operator === 'ends_with') return normalizedComparison.length > 0 && normalizedValue.endsWith(normalizedComparison);
  if (operator === 'greater_than') {
    const left = Number(value);
    const right = Number(comparison);
    return Number.isFinite(left) && Number.isFinite(right) && left > right;
  }
  if (operator === 'greater_than_or_equal') {
    const left = Number(value);
    const right = Number(comparison);
    return Number.isFinite(left) && Number.isFinite(right) && left >= right;
  }
  if (operator === 'less_than') {
    const left = Number(value);
    const right = Number(comparison);
    return Number.isFinite(left) && Number.isFinite(right) && left < right;
  }
  if (operator === 'less_than_or_equal') {
    const left = Number(value);
    const right = Number(comparison);
    return Number.isFinite(left) && Number.isFinite(right) && left <= right;
  }
  if (operator === 'is_empty') return value.trim() === '';
  if (operator === 'is_not_empty') return value.trim() !== '';
  return false;
};

export const buildQuestionLabelMap = (questions: Array<Pick<QuestionItem, 'id' | 'title'>>) =>
  new Map(questions.map((question) => [question.id, question.title]));

export const describeConditionalRule = (
  rule: ConditionalRuleLike,
  questionLabels: Map<string, string>,
) => {
  const triggerLabel = questionLabels.get(rule.trigger_field_id) ?? 'Deleted question';
  const targetLabel = questionLabels.get(rule.target_field_id) ?? 'Deleted question';
  const operatorLabel = getConditionalOperatorLabel(rule.trigger_operator).toLowerCase();
  const actionLabel = getConditionalActionLabel(rule.target_action);
  const valueLabel = shouldRuleUseValue(rule.trigger_operator)
    ? ` "${rule.trigger_value?.trim() || '...'}"`
    : '';

  return {
    triggerLabel,
    targetLabel,
    operatorLabel,
    actionLabel,
    valueLabel,
    sentence: `If ${triggerLabel} ${operatorLabel}${valueLabel}, ${actionLabel.toLowerCase()} ${targetLabel}.`,
  };
};
