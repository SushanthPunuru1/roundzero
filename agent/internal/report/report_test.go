package report_test

import (
	"strings"
	"testing"
	"time"

	"github.com/roundzero/agent/internal/checks"
	"github.com/roundzero/agent/internal/report"
)

func TestBuild_SumsOnlyNonErroredChecks(t *testing.T) {
	now := time.Now().UTC()
	results := []checks.Result{
		{ID: "a", Points: 10, Earned: 10, Pass: true, Timestamp: now},
		{ID: "b", Points: 8, Earned: 0, Pass: false, Timestamp: now},
		{ID: "c", Points: 5, Earned: 0, Pass: false, Err: errString("boom"), Timestamp: now},
	}
	rep := report.Build(results)
	if rep.TotalPossible != 18 {
		t.Fatalf("expected total possible 18 (excluding errored check c), got %d", rep.TotalPossible)
	}
	if rep.TotalEarned != 10 {
		t.Fatalf("expected total earned 10, got %d", rep.TotalEarned)
	}
	if len(rep.Checks) != 3 {
		t.Fatalf("expected 3 check lines, got %d", len(rep.Checks))
	}
	if rep.Checks[2].Error != "boom" {
		t.Fatalf("expected error line to carry error text, got %q", rep.Checks[2].Error)
	}
}

func TestReport_JSONRoundTrips(t *testing.T) {
	rep := report.Build([]checks.Result{
		{ID: "a", Title: "A", SkillNode: "linux.ssh.permitrootlogin", Points: 10, Earned: 10, Pass: true, Timestamp: time.Now().UTC()},
	})
	s, err := rep.JSON()
	if err != nil {
		t.Fatalf("JSON: %v", err)
	}
	if !strings.Contains(s, `"totalEarned": 10`) {
		t.Fatalf("expected totalEarned in JSON output, got: %s", s)
	}
}

func TestReport_TextIncludesScoreAndEachCheck(t *testing.T) {
	rep := report.Build([]checks.Result{
		{ID: "ssh-permitrootlogin", Title: "SSH disallows root login", Points: 12, Earned: 0, Pass: false, Detail: "still yes", Timestamp: time.Now().UTC()},
	})
	text := rep.Text()
	if !strings.Contains(text, "Score: 0 / 12") {
		t.Fatalf("expected score line, got: %s", text)
	}
	if !strings.Contains(text, "ssh-permitrootlogin") {
		t.Fatalf("expected check id in output, got: %s", text)
	}
	if !strings.Contains(text, "FAIL") {
		t.Fatalf("expected FAIL status, got: %s", text)
	}
}

type errString string

func (e errString) Error() string { return string(e) }
