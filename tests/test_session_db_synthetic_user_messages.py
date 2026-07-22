from pathlib import Path

from hermes_state import SessionDB
from agent.turn_finalizer import AUTO_CONTINUE_ON_MAX_ITERATIONS_MARKER


def _new_db(tmp_path: Path) -> SessionDB:
    db = SessionDB(db_path=tmp_path / "state.db")
    db.create_session(session_id="s1", source="cli")
    return db


def test_list_recent_user_messages_skips_synthetic_auto_continue_rows(tmp_path):
    db = _new_db(tmp_path)
    try:
        first_id = db.append_message("s1", role="user", content="real first turn")
        db.append_message("s1", role="assistant", content="ok")
        # More synthetic rows than the requested limit exercises the over-fetch
        # guard: /undo 1 must still find the last real user turn.
        for idx in range(12):
            db.append_message(
                "s1",
                role="user",
                content=f"{AUTO_CONTINUE_ON_MAX_ITERATIONS_MARKER}\ncontinue {idx}",
            )
            db.append_message("s1", role="assistant", content=f"continued {idx}")
        second_id = db.append_message("s1", role="user", content="real second turn")

        recents = db.list_recent_user_messages("s1", limit=2)

        assert [row["id"] for row in recents] == [second_id, first_id]
        assert [row["preview"] for row in recents] == [
            "real second turn",
            "real first turn",
        ]
    finally:
        db.close()


def test_list_recent_user_messages_can_include_synthetic_for_forensics(tmp_path):
    db = _new_db(tmp_path)
    try:
        db.append_message("s1", role="user", content="real turn")
        synthetic_id = db.append_message(
            "s1",
            role="user",
            content=f"{AUTO_CONTINUE_ON_MAX_ITERATIONS_MARKER}\ncontinue",
        )

        recents = db.list_recent_user_messages(
            "s1", limit=1, include_synthetic=True
        )

        assert recents[0]["id"] == synthetic_id
        assert recents[0]["preview"].startswith(AUTO_CONTINUE_ON_MAX_ITERATIONS_MARKER)
    finally:
        db.close()


def test_rewind_using_recent_user_messages_targets_real_user_turn(tmp_path):
    db = _new_db(tmp_path)
    try:
        real_id = db.append_message("s1", role="user", content="ship the fix")
        db.append_message("s1", role="assistant", content="working")
        db.append_message(
            "s1",
            role="user",
            content=f"{AUTO_CONTINUE_ON_MAX_ITERATIONS_MARKER}\ncontinue",
        )
        db.append_message("s1", role="assistant", content="continued")

        target_id = db.list_recent_user_messages("s1", limit=1)[0]["id"]
        result = db.rewind_to_message("s1", target_id)

        assert target_id == real_id
        assert result["target_message"]["content"] == "ship the fix"
        assert db.get_messages_as_conversation("s1") == []
    finally:
        db.close()
