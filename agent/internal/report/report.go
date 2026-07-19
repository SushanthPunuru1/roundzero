// Package report turns a slice of checks.Result into the score report an
// operator (or later, a debrief page) reads: totals, per-check pass/fail,
// and a per-check timestamp so a future debrief can plot a trajectory.
package report

import (
	"time"

	"github.com/roundzero/agent/internal/checks"
)

type CheckLine struct {
	ID        string    `json:"id"`
	Title     string    `json:"title"`
	SkillNode string    `json:"skillNode"`
	Points    int       `json:"points"`
	Earned    int       `json:"earned"`
	Pass      bool      `json:"pass"`
	Detail    string    `json:"detail"`
	Error     string    `json:"error,omitempty"`
	Timestamp time.Time `json:"timestamp"`
}

type Report struct {
	GeneratedAt   time.Time   `json:"generatedAt"`
	TotalPossible int         `json:"totalPossible"`
	TotalEarned   int         `json:"totalEarned"`
	Checks        []CheckLine `json:"checks"`
}

// Build scores a set of check results into a Report. Points from a check
// that errored are never counted toward TotalPossible or TotalEarned — an
// evaluation failure is "we don't know," not "zero points," so it can't
// silently deflate the denominator either.
func Build(results []checks.Result) Report {
	rep := Report{
		GeneratedAt: time.Now().UTC(),
		Checks:      make([]CheckLine, 0, len(results)),
	}
	for _, r := range results {
		line := CheckLine{
			ID:        r.ID,
			Title:     r.Title,
			SkillNode: r.SkillNode,
			Points:    r.Points,
			Earned:    r.Earned,
			Pass:      r.Pass,
			Detail:    r.Detail,
			Timestamp: r.Timestamp,
		}
		if r.Err != nil {
			line.Error = r.Err.Error()
		} else {
			rep.TotalPossible += r.Points
			rep.TotalEarned += r.Earned
		}
		rep.Checks = append(rep.Checks, line)
	}
	return rep
}
