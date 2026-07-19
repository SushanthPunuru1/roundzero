package checks

import (
	"fmt"
	"time"

	"github.com/roundzero/agent/internal/system"
)

// builder decodes a check's raw params into a concrete Evaluator. Each
// check type registers exactly one builder in init().
type builder func(c Check) (Evaluator, error)

var registry = map[string]builder{}

// register is called from each check type's file's init().
func register(checkType string, b builder) {
	if _, exists := registry[checkType]; exists {
		panic(fmt.Sprintf("checks: type %q registered twice", checkType))
	}
	registry[checkType] = b
}

// RegisteredTypes returns the known check type names, sorted for stable
// output (used by --help and error messages).
func RegisteredTypes() []string {
	names := make([]string, 0, len(registry))
	for name := range registry {
		names = append(names, name)
	}
	return names
}

// Run evaluates every check in cf against sys and returns one Result per
// check, in file order. A check whose type isn't registered, or whose
// params fail to decode, produces a Result with Err set rather than
// aborting the whole run — one bad check shouldn't hide every other score.
func Run(cf *CheckFile, sys system.System) []Result {
	results := make([]Result, 0, len(cf.Checks))
	for _, c := range cf.Checks {
		results = append(results, evaluateOne(c, sys))
	}
	return results
}

func evaluateOne(c Check, sys system.System) Result {
	now := time.Now().UTC()
	base := Result{
		ID:        c.ID,
		Title:     c.Title,
		SkillNode: c.SkillNode,
		Points:    c.Points,
		Timestamp: now,
	}

	build, ok := registry[c.Type]
	if !ok {
		base.Err = fmt.Errorf("unknown check type %q (known: %v)", c.Type, RegisteredTypes())
		return base
	}

	eval, err := build(c)
	if err != nil {
		base.Err = fmt.Errorf("check %q: invalid params: %w", c.ID, err)
		return base
	}

	pass, detail, err := eval.Evaluate(sys)
	if err != nil {
		base.Err = fmt.Errorf("check %q: evaluation failed: %w", c.ID, err)
		return base
	}

	base.Pass = pass
	base.Detail = detail
	if pass {
		base.Earned = c.Points
	}
	return base
}
