package checks

import (
	"fmt"
	"strings"

	"github.com/roundzero/agent/internal/system"
)

func init() {
	register("sshd_config", buildSSHDConfig)
}

// --- sshd_config: does sshd's MERGED effective config set key to value? ---
//
// Always evaluates `sshd -T` (sshd's own effective-config dump after
// applying every `Include`d drop-in, in the same first-value-wins order
// sshd itself uses) rather than grepping any single file. That's the only
// way to correctly credit a fix regardless of which file — the main
// sshd_config or a later cloud-init-style drop-in — actually controls the
// live value. See DECISIONS.md 026.

type sshdConfigParams struct {
	Key   string `yaml:"key"`
	Value string `yaml:"value"`
}

type sshdConfigCheck struct {
	params sshdConfigParams
}

func buildSSHDConfig(c Check) (Evaluator, error) {
	var p sshdConfigParams
	if err := c.Params.Decode(&p); err != nil {
		return nil, err
	}
	if p.Key == "" {
		return nil, fmt.Errorf("sshd_config check requires key")
	}
	return &sshdConfigCheck{params: p}, nil
}

func (s *sshdConfigCheck) Evaluate(sys system.System) (bool, string, error) {
	stdout, _, err := sys.Run("sshd", "-T")
	if err != nil {
		return false, "", fmt.Errorf("running sshd -T: %w", err)
	}
	effective := parseSSHDEffectiveConfig(stdout)
	actual, ok := effective[strings.ToLower(s.params.Key)]
	if !ok {
		return false, fmt.Sprintf("sshd -T does not report %q", s.params.Key), nil
	}
	pass := strings.EqualFold(actual, s.params.Value)
	return pass, fmt.Sprintf("sshd effective %s is %q (want %q)", s.params.Key, actual, s.params.Value), nil
}

// parseSSHDEffectiveConfig turns `sshd -T` output into a lowercase-keyed
// map of directive -> value. Each line is "key value..."; sshd -T already
// resolves everything to one line per directive, so no last-wins merging
// is needed here — that resolution already happened inside sshd itself.
func parseSSHDEffectiveConfig(output string) map[string]string {
	m := make(map[string]string)
	for _, line := range strings.Split(output, "\n") {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}
		fields := strings.SplitN(line, " ", 2)
		key := strings.ToLower(fields[0])
		value := ""
		if len(fields) == 2 {
			value = strings.TrimSpace(fields[1])
		}
		m[key] = value
	}
	return m
}
