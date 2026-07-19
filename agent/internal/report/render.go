package report

import (
	"encoding/json"
	"fmt"
	"strings"
)

// JSON renders the report as indented JSON, the machine-readable form a
// future orchestrator/debrief page consumes.
func (r Report) JSON() (string, error) {
	b, err := json.MarshalIndent(r, "", "  ")
	if err != nil {
		return "", err
	}
	return string(b), nil
}

// Text renders a plain-text table for local/CLI use.
func (r Report) Text() string {
	var b strings.Builder
	fmt.Fprintf(&b, "Score: %d / %d\n\n", r.TotalEarned, r.TotalPossible)
	for _, c := range r.Checks {
		status := "FAIL"
		if c.Pass {
			status = "PASS"
		}
		if c.Error != "" {
			status = "ERR "
		}
		fmt.Fprintf(&b, "[%s] %-32s %2d/%2d  %s\n", status, c.ID, c.Earned, c.Points, c.Title)
		if c.Error != "" {
			fmt.Fprintf(&b, "        error: %s\n", c.Error)
		} else {
			fmt.Fprintf(&b, "        %s\n", c.Detail)
		}
	}
	return b.String()
}
