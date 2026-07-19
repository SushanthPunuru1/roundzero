package checks_test

import (
	"testing"

	"github.com/roundzero/agent/internal/system"
)

const permitRootLoginDoc = `
version: 1
image: test
checks:
  - id: ssh-permitrootlogin
    title: SSH disallows direct root login
    skillNode: linux.ssh.permitrootlogin
    points: 12
    type: sshd_config
    params:
      key: permitrootlogin
      value: "no"
`

const sshdTOutputRootLoginYes = "port 22\npermitrootlogin yes\npasswordauthentication no\n"
const sshdTOutputHardened = "port 22\npermitrootlogin no\npasswordauthentication no\n"

func TestSSHDConfig_FailsWhenMergedValueIsYes(t *testing.T) {
	sys := system.NewFake()
	sys.OnCommand(system.FakeResult{Stdout: sshdTOutputRootLoginYes}, "sshd", "-T")
	r := runOne(t, permitRootLoginDoc, sys)
	if r.Pass {
		t.Fatal("expected fail: PermitRootLogin still yes")
	}
}

func TestSSHDConfig_PassesWhenMergedValueIsNo(t *testing.T) {
	sys := system.NewFake()
	sys.OnCommand(system.FakeResult{Stdout: sshdTOutputHardened}, "sshd", "-T")
	r := runOne(t, permitRootLoginDoc, sys)
	if !r.Pass {
		t.Fatalf("expected pass, detail=%q", r.Detail)
	}
}

const passwordAuthDoc = `
version: 1
image: test
checks:
  - id: ssh-passwordauth
    title: SSH password auth disabled per README
    skillNode: linux.ssh.passwordauth
    points: 12
    type: sshd_config
    params:
      key: passwordauthentication
      value: "no"
`

// The whole point of evaluating the MERGED config: this fixture represents
// a main sshd_config that (naively) says "no", but a later cloud-init-style
// drop-in overrides it back to "yes" — sshd -T reports the value that
// actually wins, "yes", so the check correctly still fails.
func TestSSHDConfig_DropInTrap_MainFileAloneIsNotEnough(t *testing.T) {
	sys := system.NewFake()
	sys.OnCommand(system.FakeResult{Stdout: "port 22\npasswordauthentication yes\n"}, "sshd", "-T")
	r := runOne(t, passwordAuthDoc, sys)
	if r.Pass {
		t.Fatal("expected fail: drop-in override still wins over the main file's (unread) intent")
	}
}

// The alternate valid fix: edit the drop-in itself (or anything else that
// actually controls the merged value) — sshd -T now reports "no", so the
// same check credits it regardless of which file changed.
func TestSSHDConfig_DropInTrap_FixingTheWinningFileCredits(t *testing.T) {
	sys := system.NewFake()
	sys.OnCommand(system.FakeResult{Stdout: "port 22\npasswordauthentication no\n"}, "sshd", "-T")
	r := runOne(t, passwordAuthDoc, sys)
	if !r.Pass {
		t.Fatalf("expected pass: merged config now says no, detail=%q", r.Detail)
	}
}

func TestSSHDConfig_MissingKeyInOutput_Fails(t *testing.T) {
	sys := system.NewFake()
	sys.OnCommand(system.FakeResult{Stdout: "port 22\n"}, "sshd", "-T")
	r := runOne(t, permitRootLoginDoc, sys)
	if r.Pass {
		t.Fatal("expected fail: key absent from sshd -T output")
	}
}
