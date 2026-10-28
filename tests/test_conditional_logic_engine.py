from types import SimpleNamespace

from app.services.conditional_logic_service import ConditionalLogicEngine


def test_show_rule_sets_target_visible_only_when_trigger_matches():
    rules = [
        SimpleNamespace(
            trigger_field_id="q1",
            trigger_operator="equals",
            trigger_value="yes",
            target_field_id="q2",
            target_action="show",
        )
    ]

    state = ConditionalLogicEngine.get_effective_field_state(
        rules=rules,
        answers={"q1": "no"},
        required_fields={"q2"},
    )

    assert "q2" not in state["visible_fields"]
    assert state["required_fields"] == set()


def test_require_rule_marks_target_as_required_when_trigger_matches():
    rules = [
        SimpleNamespace(
            trigger_field_id="q1",
            trigger_operator="equals",
            trigger_value="yes",
            target_field_id="q3",
            target_action="require",
        )
    ]

    state = ConditionalLogicEngine.get_effective_field_state(
        rules=rules,
        answers={"q1": "yes"},
        required_fields=set(),
    )

    assert "q3" in state["required_fields"]
    assert "q3" in state["visible_fields"]


def test_show_rule_keeps_target_hidden_until_trigger_matches_even_when_all_fields_are_known():
    rules = [
        SimpleNamespace(
            trigger_field_id="q1",
            trigger_operator="equals",
            trigger_value="yes",
            target_field_id="q2",
            target_action="show",
        )
    ]

    state = ConditionalLogicEngine.get_effective_field_state(
        rules=rules,
        answers={"q1": "no"},
        required_fields=set(),
        all_fields={"q1", "q2", "q3"},
    )

    assert "q2" not in state["visible_fields"]
    assert "q2" not in state["required_fields"]


def test_text_comparison_operators_are_case_insensitive():
    assert ConditionalLogicEngine._evaluate_condition("SmartForm Builder", "contains", "form")
    assert ConditionalLogicEngine._evaluate_condition("SmartForm Builder", "not_contains", "survey")
    assert ConditionalLogicEngine._evaluate_condition("SmartForm Builder", "starts_with", "smart")
    assert ConditionalLogicEngine._evaluate_condition("SmartForm Builder", "ends_with", "BUILDER")


def test_numeric_comparison_operators_include_equal_variants():
    assert ConditionalLogicEngine._evaluate_condition("10", "greater_than_or_equal", "10")
    assert ConditionalLogicEngine._evaluate_condition("10", "less_than_or_equal", "10")
    assert not ConditionalLogicEngine._evaluate_condition("ten", "greater_than_or_equal", "10")
