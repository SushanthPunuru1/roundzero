package checks_test

import (
	"testing"

	"github.com/roundzero/agent/internal/system"
)

const malwareServiceDoc = `
version: 1
image: test
checks:
  - id: backdoor-service
    title: prohibited backdoor service disabled
    skillNode: linux.services-persistence.malware
    points: 10
    type: service
    params:
      name: rzero-backdoor.service
      state: disabled
`

func TestService_FailsWhenEnabled(t *testing.T) {
	sys := system.NewFake()
	sys.OnCommand(system.FakeResult{Stdout: "enabled\n"}, "systemctl", "--root=/", "is-enabled", "rzero-backdoor.service")
	r := runOne(t, malwareServiceDoc, sys)
	if r.Pass {
		t.Fatal("expected fail: service still enabled")
	}
}

func TestService_PassesWhenDisabled(t *testing.T) {
	sys := system.NewFake()
	sys.OnCommand(system.FakeResult{Stdout: "disabled\n", ExitCode: 1}, "systemctl", "--root=/", "is-enabled", "rzero-backdoor.service")
	r := runOne(t, malwareServiceDoc, sys)
	if !r.Pass {
		t.Fatalf("expected pass, detail=%q err=%v", r.Detail, r.Err)
	}
}

const decoyRequiredServiceDoc = `
version: 1
image: test
checks:
  - id: decoy-required-ssh
    title: required SSH service stays enabled
    skillNode: linux.services-persistence.critical
    points: 0
    type: service
    params:
      name: ssh
      state: enabled
`

func TestService_Decoy_PassesWhileRequiredServiceEnabled(t *testing.T) {
	sys := system.NewFake()
	sys.OnCommand(system.FakeResult{Stdout: "enabled\n"}, "systemctl", "--root=/", "is-enabled", "ssh")
	r := runOne(t, decoyRequiredServiceDoc, sys)
	if !r.Pass {
		t.Fatalf("expected pass, detail=%q", r.Detail)
	}
}

func TestService_Decoy_FailsIfRequiredServiceWronglyDisabled(t *testing.T) {
	sys := system.NewFake()
	sys.OnCommand(system.FakeResult{Stdout: "disabled\n", ExitCode: 1}, "systemctl", "--root=/", "is-enabled", "ssh")
	r := runOne(t, decoyRequiredServiceDoc, sys)
	if r.Pass {
		t.Fatal("expected fail: a required service must not be disabled")
	}
}

func TestService_InvalidState_IsBuildError(t *testing.T) {
	sys := system.NewFake()
	doc := `
version: 1
image: test
checks:
  - id: bad
    title: bad
    skillNode: linux.services-persistence.malware
    points: 1
    type: service
    params:
      name: foo
      state: running
`
	r := runOne(t, doc, sys)
	if r.Err == nil {
		t.Fatal("expected build error for invalid state value")
	}
}
