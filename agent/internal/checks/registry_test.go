package checks_test

import (
	"testing"

	"github.com/roundzero/agent/internal/system"
)

func TestRun_UnknownType_ProducesErrorResultNotPanic(t *testing.T) {
	doc := `
version: 1
image: test
checks:
  - id: a
    title: A
    skillNode: linux.ssh.permitrootlogin
    points: 1
    type: nonexistent_type
    params: {}
`
	sys := system.NewFake()
	r := runOne(t, doc, sys)
	if r.Err == nil {
		t.Fatal("expected an error result for an unregistered check type")
	}
	if r.Pass {
		t.Fatal("an unknown-type check must never be counted as passing")
	}
}

func TestRun_EvaluatesEveryCheckEvenIfOneFails(t *testing.T) {
	doc := `
version: 1
image: test
checks:
  - id: bad
    title: bad
    skillNode: linux.ssh.permitrootlogin
    points: 1
    type: nonexistent_type
    params: {}
  - id: good
    title: good
    skillNode: linux.updates-network.ufw
    points: 8
    type: command
    params:
      command: "ufw status"
      pattern: 'Status: active'
      present: true
`
	sys := system.NewFake()
	sys.OnCommand(system.FakeResult{Stdout: "Status: active\n"}, "sh", "-c", "ufw status")
	cf := mustParse(t, doc)
	results := checkResults(t, cf, sys)
	if len(results) != 2 {
		t.Fatalf("expected 2 results, got %d", len(results))
	}
	if results[0].Err == nil {
		t.Fatal("first check should have errored")
	}
	if !results[1].Pass {
		t.Fatalf("second check should still evaluate and pass, detail=%q", results[1].Detail)
	}
}
