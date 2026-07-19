package checks

import (
	"fmt"
	"strings"

	"github.com/roundzero/agent/internal/system"
)

func init() {
	register("package", buildPackage)
}

// --- package: is a dpkg package installed or absent? ---

type packageParams struct {
	Name    string `yaml:"name"`
	Present bool   `yaml:"present"`
}

type packageCheck struct {
	params packageParams
}

func buildPackage(c Check) (Evaluator, error) {
	var p packageParams
	if err := c.Params.Decode(&p); err != nil {
		return nil, err
	}
	if p.Name == "" {
		return nil, fmt.Errorf("package check requires name")
	}
	return &packageCheck{params: p}, nil
}

func (p *packageCheck) Evaluate(sys system.System) (bool, string, error) {
	stdout, _, err := sys.Run("dpkg-query", "-W", "-f=${Status}", p.params.Name)
	if err != nil {
		return false, "", fmt.Errorf("checking package %q: %w", p.params.Name, err)
	}
	installed := strings.Contains(stdout, "install ok installed")
	pass := installed == p.params.Present
	if p.params.Present {
		if pass {
			return true, fmt.Sprintf("package %s is installed", p.params.Name), nil
		}
		return false, fmt.Sprintf("package %s is not installed", p.params.Name), nil
	}
	if pass {
		return true, fmt.Sprintf("package %s is not installed", p.params.Name), nil
	}
	return false, fmt.Sprintf("package %s is installed", p.params.Name), nil
}
