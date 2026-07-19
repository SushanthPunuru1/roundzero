package checks

import (
	"fmt"
	"regexp"

	"github.com/roundzero/agent/internal/system"
)

func init() {
	register("command", buildCommand)
}

// --- command: run a shell command, does its stdout match a regex? ---
//
// The check file is trusted, repo-authored content (like aeacus's own check
// definitions), never student- or attacker-supplied — same trust boundary
// as any other content-as-code YAML in this repo — so shelling out to run
// it is an accepted, documented trade-off (agent/README.md), not a general
// command-injection surface.

type commandParams struct {
	Command string `yaml:"command"`
	Pattern string `yaml:"pattern"`
	Present bool   `yaml:"present"`
}

type commandCheck struct {
	params commandParams
	re     *regexp.Regexp
}

func buildCommand(c Check) (Evaluator, error) {
	var p commandParams
	if err := c.Params.Decode(&p); err != nil {
		return nil, err
	}
	if p.Command == "" || p.Pattern == "" {
		return nil, fmt.Errorf("command check requires command and pattern")
	}
	re, err := regexp.Compile(p.Pattern)
	if err != nil {
		return nil, fmt.Errorf("command check: bad pattern: %w", err)
	}
	return &commandCheck{params: p, re: re}, nil
}

func (cc *commandCheck) Evaluate(sys system.System) (bool, string, error) {
	stdout, _, err := sys.Run("sh", "-c", cc.params.Command)
	if err != nil {
		return false, "", fmt.Errorf("running %q: %w", cc.params.Command, err)
	}
	found := cc.re.MatchString(stdout)
	pass := found == cc.params.Present
	if cc.params.Present {
		if pass {
			return true, fmt.Sprintf("output of %q matches %q", cc.params.Command, cc.params.Pattern), nil
		}
		return false, fmt.Sprintf("output of %q does not match %q", cc.params.Command, cc.params.Pattern), nil
	}
	if pass {
		return true, fmt.Sprintf("output of %q does not match %q", cc.params.Command, cc.params.Pattern), nil
	}
	return false, fmt.Sprintf("output of %q matches %q", cc.params.Command, cc.params.Pattern), nil
}
