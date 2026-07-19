package checks_test

import (
	"testing"

	"github.com/roundzero/agent/internal/system"
)

const fakePasswd = `root:x:0:0:root:/root:/bin/bash
backdoor:x:0:0::/home/backdoor:/bin/bash
zzsync:x:1002:1002::/home/zzsync:/bin/bash
alice:x:1001:1001::/home/alice:/bin/bash
`

const uid0AbsentDoc = `
version: 1
image: test
checks:
  - id: uid0-backdoor
    title: no unauthorized UID 0 account
    skillNode: linux.accounts.uid0
    points: 12
    type: user
    params:
      username: backdoor
      uid: 0
      present: false
`

func TestUser_UID0Vuln_FailsWhileAccountExists(t *testing.T) {
	sys := system.NewFake()
	sys.Files["/etc/passwd"] = fakePasswd
	r := runOne(t, uid0AbsentDoc, sys)
	if r.Pass {
		t.Fatal("expected fail: backdoor still has uid 0")
	}
}

func TestUser_UID0Vuln_PassesWhenAccountDeleted(t *testing.T) {
	sys := system.NewFake()
	sys.Files["/etc/passwd"] = "root:x:0:0:root:/root:/bin/bash\nalice:x:1001:1001::/home/alice:/bin/bash\n"
	r := runOne(t, uid0AbsentDoc, sys)
	if !r.Pass {
		t.Fatalf("expected pass: backdoor removed, detail=%q", r.Detail)
	}
}

func TestUser_UID0Vuln_PassesWhenUIDChangedInstead(t *testing.T) {
	// Alternate valid fix: keep the account but move it off uid 0.
	sys := system.NewFake()
	sys.Files["/etc/passwd"] = "root:x:0:0:root:/root:/bin/bash\nbackdoor:x:1500:1500::/home/backdoor:/bin/bash\n"
	r := runOne(t, uid0AbsentDoc, sys)
	if !r.Pass {
		t.Fatalf("expected pass: backdoor no longer uid 0, detail=%q", r.Detail)
	}
}

const decoyUserPresentDoc = `
version: 1
image: test
checks:
  - id: decoy-authorized-user
    title: authorized user zzsync still present
    skillNode: linux.accounts.passwd-shadow
    points: 0
    type: user
    params:
      username: zzsync
      present: true
`

func TestUser_Decoy_PassesWhenAuthorizedUserUntouched(t *testing.T) {
	sys := system.NewFake()
	sys.Files["/etc/passwd"] = fakePasswd
	r := runOne(t, decoyUserPresentDoc, sys)
	if !r.Pass {
		t.Fatalf("expected pass: zzsync exists, detail=%q", r.Detail)
	}
}

func TestUser_Decoy_FailsIfAuthorizedUserWronglyDeleted(t *testing.T) {
	sys := system.NewFake()
	sys.Files["/etc/passwd"] = "root:x:0:0:root:/root:/bin/bash\n"
	r := runOne(t, decoyUserPresentDoc, sys)
	if r.Pass {
		t.Fatal("expected fail: zzsync was removed")
	}
}
