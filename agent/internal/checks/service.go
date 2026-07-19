package checks

import (
	"fmt"
	"strings"

	"github.com/roundzero/agent/internal/system"
)

func init() {
	register("service", buildService)
}

// --- service: is a systemd unit enabled or disabled? ---
//
// Uses `systemctl --root=/ is-enabled <name>`, systemd's documented offline
// mode (the same mechanism chroot/image-building tools like mkosi and
// debootstrap use) — it reads unit/.wants symlinks directly from the
// filesystem and never talks to a running PID 1 / D-Bus, so it works in a
// plain (non-systemd-booted) container. See DECISIONS.md 026.

type serviceParams struct {
	Name  string `yaml:"name"`
	State string `yaml:"state"` // "enabled" or "disabled"
}

type serviceCheck struct {
	params serviceParams
}

func buildService(c Check) (Evaluator, error) {
	var p serviceParams
	if err := c.Params.Decode(&p); err != nil {
		return nil, err
	}
	if p.Name == "" {
		return nil, fmt.Errorf("service check requires name")
	}
	if p.State != "enabled" && p.State != "disabled" {
		return nil, fmt.Errorf("service check: state must be \"enabled\" or \"disabled\", got %q", p.State)
	}
	return &serviceCheck{params: p}, nil
}

func (s *serviceCheck) Evaluate(sys system.System) (bool, string, error) {
	stdout, _, err := sys.Run("systemctl", "--root=/", "is-enabled", s.params.Name)
	if err != nil {
		return false, "", fmt.Errorf("checking service %q: %w", s.params.Name, err)
	}
	actual := strings.TrimSpace(stdout)
	pass := actual == s.params.State
	return pass, fmt.Sprintf("service %s is %s (want %s)", s.params.Name, actual, s.params.State), nil
}
