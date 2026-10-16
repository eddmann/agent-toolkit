"""Behavioral checks with real Git repos and fake external provider executables."""

import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest


RUNNER = Path(__file__).resolve().parents[1] / "scripts/review_runner.py"

FAKE_CLI = r'''#!/usr/bin/env python3
import json, os, pathlib, sys, time
args = sys.argv[1:]
mode = os.environ.get("REVIEW_FAKE_MODE", "normal")
if "--version" in args:
    print("fake-cli 1.0")
    sys.exit(0)
if "mcp" in args:
    if mode == "mcp-failure":
        print("MCP discovery unavailable", file=sys.stderr)
        sys.exit(1)
    print(json.dumps([{"name": 'example.server"name', "enabled": True}]))
    sys.exit(0)
prompt = sys.stdin.read()
pathlib.Path(os.environ["REVIEW_FAKE_CAPTURE"]).write_text(json.dumps({
    "args": args, "prompt": prompt, "effort": os.environ.get("CLAUDE_CODE_EFFORT_LEVEL")
}))
if mode == "timeout":
    time.sleep(30)
if mode == "exit-failure":
    print("authentication failed", file=sys.stderr)
    sys.exit(7)
if mode == "mutation":
    with open("source.py", "a") as out:
        out.write("\n# unexpected edit\n")
report = json.loads(pathlib.Path(os.environ["REVIEW_FAKE_REPORT"]).read_text())
if "exec" in args:
    if mode != "missing-answer":
        pathlib.Path(args[args.index("--output-last-message") + 1]).write_text(json.dumps(report))
    print(json.dumps({"type": "thread.started", "thread_id": "fake-codex-session"}))
    print(json.dumps({"type": "turn.started"}))
    if mode != "incomplete":
        print(json.dumps({"type": "turn.completed", "usage": {}}))
    if mode == "stale-turn":
        print(json.dumps({"type": "turn.started"}))
    if mode == "failed-turn":
        print(json.dumps({"type": "turn.failed", "error": {"message": "failed"}}))
else:
    print(json.dumps({"type": "result", "subtype": "error_max_turns" if mode == "incomplete" else "success",
        "is_error": False, "session_id": "fake-claude-session", "structured_output": report,
        "modelUsage": {"claude-test-model": {}}}))
'''


def clean_review():
    return {"verdict": "NO_BLOCKERS", "summary": "No blockers found",
            "findings": [], "coverage": ["source.py and the stated behavior"], "limitations": []}


def blocker():
    return {"id": "B1", "severity": "blocker", "path": "source.py", "line": 1,
            "evidence": "Returns 1", "trigger": "Caller expects 2", "impact": "Wrong answer",
            "fix": "Return 2"}


@unittest.skipIf(os.name == "nt", "Fake executable fixtures use POSIX shebangs; native Windows needs live executable checks")
class ReviewLoopTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name)
        self.repo = self.root / "project with spaces"
        self.repo.mkdir()
        self.git("init", "-q")
        self.git("config", "user.name", "Review Test")
        self.git("config", "user.email", "review@example.invalid")
        (self.repo / "source.py").write_text("def answer():\n    return 1\n")
        (self.repo / ".gitignore").write_text("ignored.txt\n")
        self.git("add", ".")
        self.git("commit", "-qm", "Initial behavior")
        self.base = self.git("rev-parse", "HEAD").strip()
        self.cli = self.root / "fake reviewer"
        self.cli.write_text(FAKE_CLI)
        self.cli.chmod(0o700)
        self.brief = self.root / "brief.md"
        self.brief.write_text("Return the intended answer. Preserve unrelated work.\n")
        self.feedback = self.root / "feedback.md"
        self.feedback.write_text("B1 confirmed and fixed. Acceptance check passed.\n")
        self.config = self.root / "preferences.json"
        self.config.write_text("{}")
        self.report = self.root / "report.json"
        self.report.write_text(json.dumps(clean_review()))
        self.capture = self.root / "capture.json"
        self.env = {**os.environ, "REVIEW_FAKE_CAPTURE": str(self.capture),
                    "REVIEW_FAKE_REPORT": str(self.report), "REVIEW_FAKE_MODE": "normal",
                    "TMPDIR": str(self.root), "CLAUDE_CODE_EFFORT_LEVEL": "low"}

    def git(self, *args):
        return subprocess.check_output(["git", "-C", str(self.repo), *args], text=True)

    def invoke(self, *args, expected=0):
        result = subprocess.run([sys.executable, str(RUNNER), *map(str, args)],
                                env=self.env, text=True, capture_output=True, timeout=15)
        self.assertEqual(result.returncode, expected, result.stdout + result.stderr)
        return result

    def start(self, host="codex", extra=(), expected=0):
        result = self.invoke("start", "--host", host, "--repo", self.repo, "--brief", self.brief,
                             "--config", self.config, "--cli", self.cli, *extra, expected=expected)
        return json.loads(result.stdout) if result.stdout else json.loads(result.stderr)

    def test_both_directions_return_current_independent_reviews(self):
        for host, reviewer in (("codex", "claude"), ("claude", "codex")):
            with self.subTest(host=host):
                result = self.start(host)
                self.assertEqual(result["reviewer"], reviewer)
                self.assertEqual(result["status"], "complete")
                self.assertEqual(result["requested_model"], None)
                self.assertTrue(result["session_id"].startswith("fake-"))
                self.invoke("check", result["run"])
                capture = json.loads(self.capture.read_text())
                self.assertIn(self.brief.read_text(), capture["prompt"])
                self.assertIn("Testing Philosophy", capture["prompt"])
                self.assertEqual(self.git("status", "--porcelain"), "")
                run = Path(result["run"])
                self.assertFalse(run.is_relative_to(self.repo))
                self.assertEqual(run.stat().st_mode & 0o777, 0o700)

    def test_cli_explicit_model_effort_and_budget_override_preferences(self):
        self.config.write_text(json.dumps({"claude": {"model": "sonnet", "effort": "medium"}, "rounds": 5}))
        result = self.start(extra=("--model", "opus", "--effort", "high", "--rounds", "2"))
        capture = json.loads(self.capture.read_text())
        self.assertEqual(result["requested_model"], "opus")
        self.assertEqual(result["observed_models"], ["claude-test-model"])
        self.assertEqual(capture["effort"], "high")
        self.assertEqual(capture["args"][capture["args"].index("--model") + 1], "opus")
        state = json.loads((Path(result["run"]) / "state.json").read_text())
        self.assertEqual(state["settings"]["rounds"], 2)

    def test_selected_provider_preferences_and_explicit_reviewer(self):
        self.config.write_text(json.dumps({"claude": {"model": "sonnet"}, "codex": {"model": "test-codex", "effort": "high"}}))
        result = self.start("other", ("--reviewer", "codex"))
        self.assertEqual(result["requested_model"], "test-codex")
        self.assertEqual(result["requested_effort"], "high")
        capture = json.loads(self.capture.read_text())
        self.assertIn('model_reasoning_effort="high"', capture["args"])

    def test_unknown_host_needs_explicit_reviewer(self):
        self.assertIn("explicit --reviewer", self.start("other", expected=1)["error"])

    def test_reviewers_get_restricted_tools_and_no_bypass_flags(self):
        self.start("codex")
        args = json.loads(self.capture.read_text())["args"]
        self.assertIn("--safe-mode", args)
        self.assertEqual(args[args.index("--tools") + 1], "Read,Glob,Grep")
        self.assertIn("dontAsk", args)
        self.assertIn("--strict-mcp-config", args)
        self.assertIn('{"fallbackModel":[]}', args)
        self.start("claude")
        args = json.loads(self.capture.read_text())["args"]
        self.assertEqual(args[args.index("--sandbox") + 1], "read-only")
        self.assertIn('approval_policy="never"', args)
        self.assertIn('mcp_servers."example.server\\\"name".enabled=false', args)
        for feature in ("apps", "plugins", "hooks", "multi_agent", "multi_agent_v2"):
            self.assertIn(feature, args)
        self.assertFalse(any("bypass" in arg for arg in args))

    def test_fix_round_carries_prior_findings_feedback_and_new_code_state(self):
        report = clean_review()
        report.update(verdict="CHANGES_REQUIRED", findings=[blocker()])
        self.report.write_text(json.dumps(report))
        result = self.start(extra=("--rounds", "2"))
        self.invoke("check", result["run"], expected=1)
        (self.repo / "source.py").write_text("def answer():\n    return 2\n")
        self.report.write_text(json.dumps(clean_review()))
        next_result = json.loads(self.invoke("next", result["run"], "--feedback", self.feedback).stdout)
        self.assertNotEqual(result["snapshot"], next_result["snapshot"])
        prompt = json.loads(self.capture.read_text())["prompt"]
        self.assertIn("Caller expects 2", prompt)
        self.assertIn(self.feedback.read_text().strip(), prompt)
        self.invoke("check", result["run"])
        self.invoke("next", result["run"], "--feedback", self.feedback, expected=1)
        state = json.loads((Path(result["run"]) / "state.json").read_text())
        self.assertEqual(len(state["history"]), 2)

    def test_untracked_staged_unstaged_and_deleted_changes_invalidate_clean_review(self):
        mutations = ("untracked", "staged", "unstaged", "deleted", "index-only", "new-head")
        for change in mutations:
            with self.subTest(change=change):
                result = self.start()
                path = self.repo / "source.py"
                if change == "untracked":
                    (self.repo / "new file\nwith newline.py").write_text("new\n")
                elif change == "deleted":
                    path.unlink()
                elif change == "new-head":
                    self.git("commit", "--allow-empty", "-qm", "New head")
                else:
                    original = path.read_text()
                    path.write_text(original + "# changed\n")
                    if change in {"staged", "index-only"}:
                        self.git("add", "source.py")
                    if change == "index-only":
                        path.write_text(original)
                self.invoke("check", result["run"], expected=1)
                self.git("reset", "--hard", self.base)
                self.git("clean", "-fd")

    def test_untracked_content_and_symlink_target_are_fingerprinted(self):
        path = self.repo / "new.py"
        path.write_text("one")
        result = self.start()
        path.write_text("two")
        self.invoke("check", result["run"], expected=1)
        path.unlink()
        path.symlink_to("source.py")
        result = self.start()
        path.unlink()
        path.symlink_to(".gitignore")
        self.invoke("check", result["run"], expected=1)

    def test_branch_review_includes_commits_and_working_changes_and_tracks_base(self):
        self.git("branch", "review-base")
        (self.repo / "source.py").write_text("def answer():\n    return 2\n")
        self.git("commit", "-qam", "Change behavior")
        (self.repo / "source.py").write_text("def answer():\n    return 3\n")
        result = self.start(extra=("--base", "review-base"))
        diff = (Path(result["run"]) / "round-1/diff.patch").read_text()
        self.assertIn("-    return 1", diff)
        self.assertIn("+    return 3", diff)
        self.assertEqual(result["snapshot"]["base"], self.base)
        self.git("branch", "-f", "review-base", "HEAD")
        self.invoke("check", result["run"], expected=1)

    def test_commit_review_requires_matching_clean_checkout(self):
        (self.repo / "source.py").write_text("def answer():\n    return 2\n")
        self.git("commit", "-qam", "Change behavior")
        head = self.git("rev-parse", "HEAD").strip()
        result = self.start(extra=("--commit", head))
        self.assertIn("-    return 1", (Path(result["run"]) / "round-1/diff.patch").read_text())
        self.assertIn("that commit checked out", self.start(extra=("--commit", self.base), expected=1)["error"])
        (self.repo / "source.py").write_text("unexpected")
        self.assertIn("no tracked working changes", self.start(extra=("--commit", head), expected=1)["error"])

    def test_commit_review_can_reinspect_working_fixes(self):
        result = self.start(extra=("--commit", self.base))
        (self.repo / "source.py").write_text("def answer():\n    return 2\n")
        self.invoke("check", result["run"], expected=1)
        self.invoke("next", result["run"], "--feedback", self.feedback)
        diff = (Path(result["run"]) / "round-2/diff.patch").read_text()
        self.assertIn("+    return 2", diff)
        self.invoke("check", result["run"])

    def test_merge_commit_review_includes_changes_introduced_by_the_merge(self):
        original_branch = self.git("branch", "--show-current").strip()
        self.git("checkout", "-qb", "feature")
        (self.repo / "incoming.py").write_text("incoming = True\n")
        self.git("add", "incoming.py")
        self.git("commit", "-qm", "Feature change")
        self.git("checkout", "-q", original_branch)
        (self.repo / "local.py").write_text("local = True\n")
        self.git("add", "local.py")
        self.git("commit", "-qm", "Local change")
        self.git("merge", "--no-ff", "feature", "-qm", "Merge feature")
        head = self.git("rev-parse", "HEAD").strip()
        result = self.start(extra=("--commit", head))
        diff = (Path(result["run"]) / "round-1/diff.patch").read_text()
        self.assertIn("+incoming = True", diff)

    def test_ignored_files_do_not_invalidate_superproject_review(self):
        result = self.start()
        (self.repo / "ignored.txt").write_text("outside the documented fingerprint")
        self.invoke("check", result["run"])

    def test_failed_newer_round_never_reuses_old_approval(self):
        result = self.start()
        self.env["REVIEW_FAKE_MODE"] = "exit-failure"
        failed = json.loads(self.invoke("next", result["run"], "--feedback", self.feedback, expected=1).stdout)
        self.assertEqual(failed["exit_code"], 7)
        self.assertNotIn("review", failed)
        self.invoke("check", result["run"], expected=1)

    def test_incomplete_and_missing_provider_results_cannot_approve(self):
        for host, modes in (("codex", ["incomplete"]), ("claude", ["incomplete", "missing-answer", "stale-turn", "failed-turn", "mcp-failure"])):
            for mode in modes:
                with self.subTest(host=host, mode=mode):
                    self.env["REVIEW_FAKE_MODE"] = mode
                    result = self.start(host, expected=1)
                    self.assertEqual(result["status"], "failed")
                    self.invoke("check", result["run"], expected=1)

    def test_malformed_or_inconsistent_reviews_are_rejected(self):
        variants = [{}, {**clean_review(), "verdict": []}, {**clean_review(), "coverage": []},
                    {**clean_review(), "findings": [blocker()]},
                    {**clean_review(), "limitations": ["Could not inspect the relevant file"]},
                    {**clean_review(), "verdict": "CHANGES_REQUIRED"},
                    {**clean_review(), "verdict": "CHANGES_REQUIRED", "findings": [blocker(), blocker()]}]
        for host in ("claude", "codex"):
            for report in variants:
                with self.subTest(host=host, report=report):
                    self.report.write_text(json.dumps(report))
                    result = self.start(host, expected=1)
                    self.assertEqual(result["status"], "failed")

    def test_incomplete_assessment_is_valid_but_cannot_pass_check(self):
        report = clean_review()
        report.update(verdict="INCOMPLETE", limitations=["Missing acceptance criteria"])
        self.report.write_text(json.dumps(report))
        result = self.start()
        self.assertEqual(result["status"], "complete")
        self.invoke("check", result["run"], expected=1)

    def test_mutation_during_review_invalidates_result_without_undoing_work(self):
        self.env["REVIEW_FAKE_MODE"] = "mutation"
        result = self.start(expected=1)
        self.assertIn("Checkout changed", result["error"])
        self.assertIn("unexpected edit", (self.repo / "source.py").read_text())

    def test_timeout_is_recorded_and_not_approval(self):
        self.env["REVIEW_FAKE_MODE"] = "timeout"
        result = self.start(extra=("--timeout", "1"), expected=1)
        self.assertEqual(result["status"], "failed")
        self.assertIn("timed out", result["error"])
        self.invoke("check", result["run"], expected=1)

    def test_lock_rejects_concurrent_round_without_spending_budget(self):
        result = self.start()
        run = Path(result["run"])
        (run / "lock").touch()
        self.invoke("next", run, "--feedback", self.feedback, expected=1)
        self.assertEqual(len(json.loads((run / "state.json").read_text())["history"]), 1)

    def test_exact_model_substitution_is_not_silent(self):
        result = self.start(extra=("--model", "claude-unavailable-model"), expected=1)
        self.assertIn("different model", result["error"])
        self.assertEqual(result["observed_models"], ["claude-test-model"])

    def test_shell_characters_in_model_are_literal_arguments(self):
        marker = self.root / "should-not-exist"
        model = f"opus; touch {marker}"
        result = self.start(extra=("--model", model))
        self.assertEqual(result["requested_model"], model)
        self.assertFalse(marker.exists())
        self.assertIn(model, json.loads(self.capture.read_text())["args"])

    def test_invalid_preferences_missing_cli_and_empty_feedback_fail_clearly(self):
        self.config.write_text('{"rounds": true}')
        self.assertIn("positive integer", self.start(expected=1)["error"])
        self.config.write_text('{"claude": {"unknown": "x"}}')
        self.assertIn("Invalid claude", self.start(expected=1)["error"])
        self.config.write_text('{}')
        self.assertIn("CLI not found", self.start(extra=("--cli", str(self.root / "absent")), expected=1)["error"])
        result = self.start()
        self.feedback.write_text(" ")
        self.invoke("next", result["run"], "--feedback", self.feedback, expected=1)


if __name__ == "__main__":
    unittest.main()
