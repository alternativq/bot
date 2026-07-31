from pathlib import Path

from config import find_env_file


def test_find_env_file_searches_parent_directories(tmp_path: Path) -> None:
    project_dir = tmp_path / "project"
    project_dir.mkdir()
    env_dir = tmp_path
    env_file = env_dir / ".env"
    env_file.write_text("BOT_TOKEN=test-token\n", encoding="utf-8")

    assert find_env_file(project_dir) == env_file
