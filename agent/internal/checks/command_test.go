package checks_test

import (
	"testing"

	"github.com/roundzero/agent/internal/system"
)

const ufwDoc = `
version: 1
image: test
checks:
  - id: ufw-active
    title: firewall is active
    skillNode: linux.updates-network.ufw
    points: 8
    type: command
    params:
      command: "ufw status"
      pattern: 'Status: active'
      present: true
`

func TestCommand_UFW_FailsWhenInactive(t *testing.T) {
	sys := system.NewFake()
	sys.OnCommand(system.FakeResult{Stdout: "Status: inactive\n"}, "sh", "-c", "ufw status")
	r := runOne(t, ufwDoc, sys)
	if r.Pass {
		t.Fatal("expected fail: ufw inactive")
	}
}

func TestCommand_UFW_PassesWhenActive(t *testing.T) {
	sys := system.NewFake()
	sys.OnCommand(system.FakeResult{Stdout: "Status: active\nLogging: on (low)\n"}, "sh", "-c", "ufw status")
	r := runOne(t, ufwDoc, sys)
	if !r.Pass {
		t.Fatalf("expected pass, detail=%q", r.Detail)
	}
}

const suidDoc = `
version: 1
image: test
checks:
  - id: rogue-suid
    title: no rogue SUID binary
    skillNode: linux.files-perms.suid
    points: 8
    type: command
    params:
      command: "find / -xdev -perm -4000 -type f 2>/dev/null"
      pattern: '/usr/local/bin/rootbash'
      present: false
`

func TestCommand_SUID_FailsWhilePlanted(t *testing.T) {
	sys := system.NewFake()
	sys.OnCommand(system.FakeResult{Stdout: "/usr/bin/passwd\n/usr/local/bin/rootbash\n"}, "sh", "-c", "find / -xdev -perm -4000 -type f 2>/dev/null")
	r := runOne(t, suidDoc, sys)
	if r.Pass {
		t.Fatal("expected fail: rootbash still present")
	}
}

func TestCommand_SUID_PassesWhenRemoved(t *testing.T) {
	sys := system.NewFake()
	sys.OnCommand(system.FakeResult{Stdout: "/usr/bin/passwd\n"}, "sh", "-c", "find / -xdev -perm -4000 -type f 2>/dev/null")
	r := runOne(t, suidDoc, sys)
	if !r.Pass {
		t.Fatalf("expected pass, detail=%q", r.Detail)
	}
}

func TestCommand_UnregisteredCommand_IsEvaluationError(t *testing.T) {
	sys := system.NewFake() // no command registered
	r := runOne(t, ufwDoc, sys)
	if r.Err == nil {
		t.Fatal("expected an error for an unregistered fake command")
	}
	if r.Pass {
		t.Fatal("errored check must not be counted as passing")
	}
}
