package checks

import (
	"fmt"
	"strconv"
	"strings"

	"github.com/roundzero/agent/internal/system"
)

func init() {
	register("user", buildUser)
}

const passwdPath = "/etc/passwd"

// --- user: does a passwd entry matching {username, uid} exist? ---
//
// Both fields are optional but at least one must be set. Matching on both
// username AND uid (as the uid0 vuln does) lets a fix be either "delete the
// account" or "change its uid away from 0" — both are valid remediations,
// and this check credits either one.

type userParams struct {
	Username string `yaml:"username"`
	UID      *int   `yaml:"uid"`
	Present  bool   `yaml:"present"`
}

type userCheck struct {
	params userParams
}

func buildUser(c Check) (Evaluator, error) {
	var p userParams
	if err := c.Params.Decode(&p); err != nil {
		return nil, err
	}
	if p.Username == "" && p.UID == nil {
		return nil, fmt.Errorf("user check requires username and/or uid")
	}
	return &userCheck{params: p}, nil
}

func (u *userCheck) Evaluate(sys system.System) (bool, string, error) {
	content, err := sys.ReadFile(passwdPath)
	if err != nil {
		return false, "", err
	}
	found := false
	for _, line := range strings.Split(content, "\n") {
		if line == "" {
			continue
		}
		fields := strings.Split(line, ":")
		if len(fields) < 3 {
			continue
		}
		name := fields[0]
		uid, err := strconv.Atoi(fields[2])
		if err != nil {
			continue
		}
		if u.params.Username != "" && name != u.params.Username {
			continue
		}
		if u.params.UID != nil && uid != *u.params.UID {
			continue
		}
		found = true
		break
	}

	pass := found == u.params.Present
	who := describeUserMatch(u.params)
	if u.params.Present {
		if pass {
			return true, fmt.Sprintf("%s exists", who), nil
		}
		return false, fmt.Sprintf("%s does not exist", who), nil
	}
	if pass {
		return true, fmt.Sprintf("%s does not exist", who), nil
	}
	return false, fmt.Sprintf("%s exists", who), nil
}

func describeUserMatch(p userParams) string {
	switch {
	case p.Username != "" && p.UID != nil:
		return fmt.Sprintf("user %q with uid %d", p.Username, *p.UID)
	case p.Username != "":
		return fmt.Sprintf("user %q", p.Username)
	default:
		return fmt.Sprintf("a user with uid %d", *p.UID)
	}
}
