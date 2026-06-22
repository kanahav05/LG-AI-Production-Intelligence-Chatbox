import os
from error_logging import get_error_severity, should_email_error, _save_screenshot

def test_critical_codes_are_emailed():
    assert get_error_severity("ERR_001") == "CRITICAL"
    assert should_email_error("ERR_001") is True


def test_warning_codes_are_not_emailed():
    assert get_error_severity("WARN_001") == "WARNING"
    assert should_email_error("WARN_001") is False


def test_info_codes_are_not_emailed():
    assert get_error_severity("INFO_001") == "INFO"
    assert should_email_error("INFO_001") is False


def test_save_screenshot_valid():
    # 1x1 transparent pixel png base64
    screenshot_data = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
    path_str = _save_screenshot(screenshot_data)
    assert path_str is not None
    assert os.path.exists(path_str)
    assert path_str.endswith(".png")
    os.remove(path_str)


def test_save_screenshot_invalid():
    assert _save_screenshot("invalid_data") is None
    assert _save_screenshot(None) is None

