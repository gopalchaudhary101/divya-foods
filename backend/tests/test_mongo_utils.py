"""Unit tests for app.utils.mongo — shared ObjectId validation helpers."""

import pytest
from bson import ObjectId
from fastapi import HTTPException

from app.utils.mongo import get_object_id, get_optional_object_id


def test_get_object_id_returns_object_id_for_valid_string():
    valid = str(ObjectId())
    result = get_object_id(valid)
    assert isinstance(result, ObjectId)
    assert str(result) == valid


def test_get_object_id_raises_400_for_invalid_string():
    with pytest.raises(HTTPException) as exc_info:
        get_object_id("not-a-valid-id")
    assert exc_info.value.status_code == 400


def test_get_object_id_error_message_includes_label():
    with pytest.raises(HTTPException) as exc_info:
        get_object_id("bad-id", label="product")
    assert "product" in exc_info.value.detail


def test_get_object_id_default_label_is_resource():
    with pytest.raises(HTTPException) as exc_info:
        get_object_id("bad-id")
    assert "resource" in exc_info.value.detail


def test_get_optional_object_id_returns_none_for_none():
    assert get_optional_object_id(None) is None


def test_get_optional_object_id_returns_none_for_empty_string():
    assert get_optional_object_id("") is None


def test_get_optional_object_id_returns_object_id_for_valid_string():
    valid = str(ObjectId())
    result = get_optional_object_id(valid)
    assert isinstance(result, ObjectId)
    assert str(result) == valid


def test_get_optional_object_id_raises_for_invalid_non_empty_string():
    with pytest.raises(HTTPException) as exc_info:
        get_optional_object_id("bad-id")
    assert exc_info.value.status_code == 400
