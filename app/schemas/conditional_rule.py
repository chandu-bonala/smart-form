from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator


class ConditionalRuleBase(BaseModel):
    form_id: str
    trigger_field_id: str
    trigger_operator: str = Field(
        description="equals, not_equals, contains, not_contains, starts_with, ends_with, greater_than, greater_than_or_equal, less_than, less_than_or_equal, is_empty, is_not_empty"
    )
    trigger_value: str | None = None
    target_field_id: str
    target_action: str = Field(description="show, hide, require, unrequire")

    @field_validator("trigger_operator")
    @classmethod
    def validate_trigger_operator(cls, value: str) -> str:
        from app.services.conditional_logic_service import ConditionalLogicEngine

        if value not in ConditionalLogicEngine.OPERATORS:
            raise ValueError("Unsupported conditional operator")
        return value

    @field_validator("target_action")
    @classmethod
    def validate_target_action(cls, value: str) -> str:
        from app.services.conditional_logic_service import ConditionalLogicEngine

        if value not in ConditionalLogicEngine.ACTIONS:
            raise ValueError("Unsupported conditional action")
        return value


class ConditionalRuleCreate(ConditionalRuleBase):
    pass


class ConditionalRuleRead(ConditionalRuleBase):
    model_config = ConfigDict(from_attributes=True)

    id: str
    created_at: datetime
    updated_at: datetime


class ConditionalRuleUpdate(BaseModel):
    trigger_operator: str | None = None
    trigger_value: str | None = None
    target_action: str | None = None

    @field_validator("trigger_operator")
    @classmethod
    def validate_trigger_operator(cls, value: str | None) -> str | None:
        from app.services.conditional_logic_service import ConditionalLogicEngine

        if value is not None and value not in ConditionalLogicEngine.OPERATORS:
            raise ValueError("Unsupported conditional operator")
        return value

    @field_validator("target_action")
    @classmethod
    def validate_target_action(cls, value: str | None) -> str | None:
        from app.services.conditional_logic_service import ConditionalLogicEngine

        if value is not None and value not in ConditionalLogicEngine.ACTIONS:
            raise ValueError("Unsupported conditional action")
        return value


class ConditionalRuleList(BaseModel):
    items: list[ConditionalRuleRead]
    total: int
