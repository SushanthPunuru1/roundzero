package checks

import "fmt"

func validate(cf *CheckFile) error {
	if len(cf.Checks) == 0 {
		return fmt.Errorf("check file %q: no checks defined", cf.Image)
	}
	seen := make(map[string]bool, len(cf.Checks))
	for i, c := range cf.Checks {
		if c.ID == "" {
			return fmt.Errorf("check at index %d: missing id", i)
		}
		if seen[c.ID] {
			return fmt.Errorf("duplicate check id %q", c.ID)
		}
		seen[c.ID] = true
		if c.Title == "" {
			return fmt.Errorf("check %q: missing title", c.ID)
		}
		if c.SkillNode == "" {
			return fmt.Errorf("check %q: missing skillNode", c.ID)
		}
		if c.Type == "" {
			return fmt.Errorf("check %q: missing type", c.ID)
		}
		if c.Points < 0 {
			return fmt.Errorf("check %q: points must be >= 0", c.ID)
		}
	}
	return nil
}
