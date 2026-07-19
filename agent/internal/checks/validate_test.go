package checks_test

import (
	"testing"

	"github.com/roundzero/agent/internal/checks"
)

func TestParse_RejectsDuplicateIDs(t *testing.T) {
	doc := `
version: 1
image: test
checks:
  - id: dup
    title: A
    skillNode: linux.ssh.permitrootlogin
    points: 1
    type: command
    params: { command: "true", pattern: "x", present: false }
  - id: dup
    title: B
    skillNode: linux.ssh.permitrootlogin
    points: 1
    type: command
    params: { command: "true", pattern: "x", present: false }
`
	if _, err := checks.Parse([]byte(doc)); err == nil {
		t.Fatal("expected error for duplicate check ids")
	}
}

func TestParse_RejectsMissingSkillNode(t *testing.T) {
	doc := `
version: 1
image: test
checks:
  - id: a
    title: A
    points: 1
    type: command
    params: { command: "true", pattern: "x", present: false }
`
	if _, err := checks.Parse([]byte(doc)); err == nil {
		t.Fatal("expected error for missing skillNode")
	}
}

func TestParse_RejectsEmptyChecks(t *testing.T) {
	doc := `
version: 1
image: test
checks: []
`
	if _, err := checks.Parse([]byte(doc)); err == nil {
		t.Fatal("expected error for a check file with no checks")
	}
}
