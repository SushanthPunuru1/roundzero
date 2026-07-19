package checks

import (
	"time"

	"github.com/roundzero/agent/internal/system"
)

// Result is one check's outcome. Timestamp is recorded per check (not just
// once for the whole report) so a later debrief can plot a trajectory —
// see DECISIONS.md 013's flight-recorder debrief and 026.
type Result struct {
	ID        string
	Title     string
	SkillNode string
	Points    int
	Earned    int
	Pass      bool
	Detail    string
	Err       error
	Timestamp time.Time
}

// Evaluator is the pure logic for one check type: given a check's decoded
// params (bound at construction) and a System to query, decide pass/fail
// and explain why. err is reserved for genuine evaluation failures (e.g. a
// command that couldn't run at all) — a check that ran successfully and
// found the vulnerable state returns pass=false, err=nil.
type Evaluator interface {
	Evaluate(sys system.System) (pass bool, detail string, err error)
}
