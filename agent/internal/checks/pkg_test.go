package checks_test

import (
	"testing"

	"github.com/roundzero/agent/internal/system"
)

const insecurePackageAbsentDoc = `
version: 1
image: test
checks:
  - id: telnetd-absent
    title: telnetd not installed
    skillNode: linux.services-persistence.malware
    points: 8
    type: package
    params:
      name: telnetd
      present: false
`

func TestPackage_FailsWhenInstalled(t *testing.T) {
	sys := system.NewFake()
	sys.OnCommand(system.FakeResult{Stdout: "install ok installed"}, "dpkg-query", "-W", "-f=${Status}", "telnetd")
	r := runOne(t, insecurePackageAbsentDoc, sys)
	if r.Pass {
		t.Fatal("expected fail: telnetd still installed")
	}
}

func TestPackage_PassesWhenAbsent(t *testing.T) {
	sys := system.NewFake()
	sys.OnCommand(system.FakeResult{Stdout: "", ExitCode: 1}, "dpkg-query", "-W", "-f=${Status}", "telnetd")
	r := runOne(t, insecurePackageAbsentDoc, sys)
	if !r.Pass {
		t.Fatalf("expected pass, detail=%q", r.Detail)
	}
}

const pwqualityPresentDoc = `
version: 1
image: test
checks:
  - id: pwquality-installed
    title: pam_pwquality installed
    skillNode: linux.pam.pwquality
    points: 10
    type: package
    params:
      name: libpam-pwquality
      present: true
`

func TestPackage_PresentTrue_FailsWhenMissing(t *testing.T) {
	sys := system.NewFake()
	sys.OnCommand(system.FakeResult{Stdout: "", ExitCode: 1}, "dpkg-query", "-W", "-f=${Status}", "libpam-pwquality")
	r := runOne(t, pwqualityPresentDoc, sys)
	if r.Pass {
		t.Fatal("expected fail: package not installed")
	}
}

func TestPackage_PresentTrue_PassesWhenInstalled(t *testing.T) {
	sys := system.NewFake()
	sys.OnCommand(system.FakeResult{Stdout: "install ok installed"}, "dpkg-query", "-W", "-f=${Status}", "libpam-pwquality")
	r := runOne(t, pwqualityPresentDoc, sys)
	if !r.Pass {
		t.Fatalf("expected pass, detail=%q", r.Detail)
	}
}
