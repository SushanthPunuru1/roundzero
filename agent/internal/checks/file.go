package checks

import (
	"fmt"
	"regexp"
	"strconv"

	"github.com/roundzero/agent/internal/system"
)

func init() {
	register("file_contains", buildFileContains)
	register("file_mode", buildFileMode)
}

// --- file_contains: does path's content match (or not match) a regex ---

type fileContainsParams struct {
	Path    string `yaml:"path"`
	Pattern string `yaml:"pattern"`
	// Present true: check passes when the pattern IS found (e.g. an
	// enforced pwquality minlen line). Present false: check passes when
	// the pattern is NOT found (e.g. a malicious cron line was removed).
	Present bool `yaml:"present"`
}

type fileContainsCheck struct {
	params fileContainsParams
	re     *regexp.Regexp
}

func buildFileContains(c Check) (Evaluator, error) {
	var p fileContainsParams
	if err := c.Params.Decode(&p); err != nil {
		return nil, err
	}
	if p.Path == "" || p.Pattern == "" {
		return nil, fmt.Errorf("file_contains requires path and pattern")
	}
	re, err := regexp.Compile(p.Pattern)
	if err != nil {
		return nil, fmt.Errorf("file_contains: bad pattern: %w", err)
	}
	return &fileContainsCheck{params: p, re: re}, nil
}

func (f *fileContainsCheck) Evaluate(sys system.System) (bool, string, error) {
	content, err := sys.ReadFile(f.params.Path)
	if err != nil {
		return false, "", err
	}
	found := f.re.MatchString(content)
	pass := found == f.params.Present
	if f.params.Present {
		if pass {
			return true, fmt.Sprintf("%s matches %q", f.params.Path, f.params.Pattern), nil
		}
		return false, fmt.Sprintf("%s does not match %q", f.params.Path, f.params.Pattern), nil
	}
	if pass {
		return true, fmt.Sprintf("%s does not contain %q", f.params.Path, f.params.Pattern), nil
	}
	return false, fmt.Sprintf("%s contains %q", f.params.Path, f.params.Pattern), nil
}

// --- file_mode: does path's permission bits satisfy a comparator ---

type fileModeParams struct {
	Path string `yaml:"path"`
	Mode string `yaml:"mode"` // octal string, e.g. "0640"
	// Compare is "equals" (default) or "max" — "max" passes when the
	// actual mode grants no permission bits beyond Mode (i.e. is at least
	// as restrictive), which is what "world-readable shadow" actually
	// needs: 0600 or 0400 must also pass a "max 0640" check.
	Compare string `yaml:"compare"`
}

type fileModeCheck struct {
	path    string
	mode    uint32
	compare string
}

func buildFileMode(c Check) (Evaluator, error) {
	var p fileModeParams
	if err := c.Params.Decode(&p); err != nil {
		return nil, err
	}
	if p.Path == "" || p.Mode == "" {
		return nil, fmt.Errorf("file_mode requires path and mode")
	}
	mode, err := strconv.ParseUint(p.Mode, 8, 32)
	if err != nil {
		return nil, fmt.Errorf("file_mode: bad octal mode %q: %w", p.Mode, err)
	}
	compare := p.Compare
	if compare == "" {
		compare = "equals"
	}
	if compare != "equals" && compare != "max" {
		return nil, fmt.Errorf("file_mode: compare must be \"equals\" or \"max\", got %q", compare)
	}
	return &fileModeCheck{path: p.Path, mode: uint32(mode), compare: compare}, nil
}

func (f *fileModeCheck) Evaluate(sys system.System) (bool, string, error) {
	actual, exists, err := sys.Mode(f.path)
	if err != nil {
		return false, "", err
	}
	if !exists {
		return false, fmt.Sprintf("%s does not exist", f.path), nil
	}
	var pass bool
	switch f.compare {
	case "max":
		pass = actual&^f.mode == 0
	default:
		pass = actual == f.mode
	}
	detail := fmt.Sprintf("%s is %04o (want %s %04o)", f.path, actual, f.compare, f.mode)
	return pass, detail, nil
}
