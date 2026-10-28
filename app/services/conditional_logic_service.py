from __future__ import annotations

from typing import Any

from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.answer import Answer
from app.models.conditional_rule import ConditionalRule
from app.models.form import Form
from app.models.question_branch import QuestionBranch
from app.models.response import Response
from app.schemas.response import AnswerCreate


class ConditionalLogicEngine:
    """Evaluates and enforces conditional rules for form submissions."""

    OPERATORS = {
        "equals",
        "not_equals",
        "contains",
        "not_contains",
        "starts_with",
        "ends_with",
        "greater_than",
        "greater_than_or_equal",
        "less_than",
        "less_than_or_equal",
        "is_empty",
        "is_not_empty",
    }

    ACTIONS = {"show", "hide", "require", "unrequire"}

    @staticmethod
    async def get_form_rules(db: AsyncSession, form_id: str) -> list[ConditionalRule]:
        """Fetch all conditional rules for a form."""
        result = await db.execute(
            select(ConditionalRule).where(ConditionalRule.form_id == form_id)
        )
        return list(result.scalars().all())

    @staticmethod
    def _evaluate_condition(trigger_value: str, operator: str, comparison_value: str | None) -> bool:
        """Evaluate a single condition."""
        trigger_text = (trigger_value or "").strip()
        comparison_text = (comparison_value or "").strip()

        if operator == "equals":
            return trigger_text.lower() == comparison_text.lower()
        elif operator == "not_equals":
            return trigger_text.lower() != comparison_text.lower()
        elif operator == "contains":
            return comparison_text.lower() in trigger_text.lower() if comparison_text else False
        elif operator == "not_contains":
            return comparison_text.lower() not in trigger_text.lower() if comparison_text else False
        elif operator == "starts_with":
            return trigger_text.lower().startswith(comparison_text.lower()) if comparison_text else False
        elif operator == "ends_with":
            return trigger_text.lower().endswith(comparison_text.lower()) if comparison_text else False
        elif operator == "greater_than":
            try:
                return float(trigger_text) > float(comparison_text)
            except (ValueError, TypeError):
                return False
        elif operator == "greater_than_or_equal":
            try:
                return float(trigger_text) >= float(comparison_text)
            except (ValueError, TypeError):
                return False
        elif operator == "less_than":
            try:
                return float(trigger_text) < float(comparison_text)
            except (ValueError, TypeError):
                return False
        elif operator == "less_than_or_equal":
            try:
                return float(trigger_text) <= float(comparison_text)
            except (ValueError, TypeError):
                return False
        elif operator == "is_empty":
            return trigger_text == ""
        elif operator == "is_not_empty":
            return trigger_text != ""
        return False

    @staticmethod
    def evaluate_rules(
        rules: list[ConditionalRule],
        answers: dict[str, str | None],  # {question_id: answer_value}
    ) -> dict[str, set[str]]:
        """
        Evaluate all rules and determine field visibility/required status.
        Returns: {question_id: {"show"/"hide", "require"/"unrequire"}}
        """
        field_actions: dict[str, set[str]] = {}

        for rule in rules:
            trigger_answer = answers.get(rule.trigger_field_id)
            if ConditionalLogicEngine._evaluate_condition(
                trigger_answer or "",
                rule.trigger_operator,
                rule.trigger_value,
            ):
                if rule.target_field_id not in field_actions:
                    field_actions[rule.target_field_id] = set()
                field_actions[rule.target_field_id].add(rule.target_action)

        return field_actions

    @staticmethod
    def get_effective_field_state(
        rules: list[ConditionalRule],
        answers: dict[str, str | None],
        required_fields: set[str],
        all_fields: set[str] | None = None,
    ) -> dict[str, set[str]]:
        """
        Compute the effective field state after applying all matching rules.
        Returns:
        {
            "visible_fields": set[str],
            "hidden_fields": set[str],
            "required_fields": set[str],
        }
        """
        all_field_ids = set(all_fields or answers.keys())
        show_target_ids = {
            rule.target_field_id
            for rule in rules
            if getattr(rule, "target_action", None) == "show"
        }
        visible_fields = set(all_field_ids) - show_target_ids
        hidden_fields = set(show_target_ids)
        required_visible = set(required_fields) - show_target_ids

        field_actions = ConditionalLogicEngine.evaluate_rules(rules, answers)

        for field_id, actions in field_actions.items():
            if "show" in actions:
                visible_fields.add(field_id)
                hidden_fields.discard(field_id)
            if "hide" in actions:
                visible_fields.discard(field_id)
                hidden_fields.add(field_id)
                required_visible.discard(field_id)
            if "require" in actions:
                visible_fields.add(field_id)
                hidden_fields.discard(field_id)
                required_visible.add(field_id)
            if "unrequire" in actions:
                required_visible.discard(field_id)

        for hidden_field_id in hidden_fields:
            required_visible.discard(hidden_field_id)

        return {
            "visible_fields": visible_fields,
            "hidden_fields": hidden_fields,
            "required_fields": required_visible,
        }

    @staticmethod
    def validate_submission(
        rules: list[ConditionalRule],
        answers: dict[str, str | None],
        required_fields: set[str],
        all_fields: set[str] | None = None,
    ) -> tuple[bool, str | None]:
        """
        Validate submission against conditional rules.
        - Hidden fields must not have answers
        - Required visible fields must have answers
        """
        state = ConditionalLogicEngine.get_effective_field_state(rules, answers, required_fields, all_fields)
        hidden_fields = state["hidden_fields"]
        required_visible = state["required_fields"]

        for hidden_field_id in hidden_fields:
            if hidden_field_id in answers and answers[hidden_field_id]:
                return False, f"Field {hidden_field_id} should be hidden but has a value"

        for required_field_id in required_visible:
            if required_field_id not in answers or not answers[required_field_id]:
                return False, f"Required field {required_field_id} is missing"

        return True, None

    @staticmethod
    def get_branch_visible_questions(form: Form, answers: dict[str, str | None]) -> set[str]:
        """
        Return question ids that are visible due to branch selections.
        Root questions are always visible; branch questions become visible when the
        triggering question answer matches the branch's trigger option.
        """
        branches_by_trigger: dict[str, list[QuestionBranch]] = {}
        for branch in form.branches:
            branches_by_trigger.setdefault(branch.trigger_question_id, []).append(branch)

        visible: set[str] = {question.id for question in form.questions if question.branch_id is None}
        queue = list(visible)
        visited: set[str] = set()

        while queue:
            question_id = queue.pop(0)
            if question_id in visited:
                continue
            visited.add(question_id)

            answer_value = (answers.get(question_id) or "").strip().lower()
            for branch in branches_by_trigger.get(question_id, []):
                if branch.trigger_option_text.strip().lower() != answer_value:
                    continue

                for branch_question in form.questions:
                    if branch_question.branch_id != branch.id:
                        continue
                    if branch_question.id not in visible:
                        visible.add(branch_question.id)
                        queue.append(branch_question.id)

        return visible

    @staticmethod
    def validate_branch_submission(form: Form, answers: dict[str, str | None]) -> tuple[bool, str | None]:
        """
        Ensure answers only exist for questions that are visible through branching.
        """
        visible_questions = ConditionalLogicEngine.get_branch_visible_questions(form, answers)
        for question_id, value in answers.items():
            if value and question_id not in visible_questions:
                return False, f"Field {question_id} is hidden by branching but has a value"
        return True, None
