// Package checks implements the RoundZero check-file schema: parsing a
// check file and evaluating each check against a live system.System.
//
// aeacus's YAML check format is the design reference only (DECISIONS.md
// 003) — this is a clean-room schema and implementation, no code reuse.
package checks

import "gopkg.in/yaml.v3"

// CheckFile is the top-level document an agent invocation is pointed at.
type CheckFile struct {
	Version int     `yaml:"version"`
	Image   string  `yaml:"image"`
	Checks  []Check `yaml:"checks"`
}

// Check is exactly one scored condition: one type, one params block. There
// is deliberately no all:/any: composition — one condition per check is the
// simplest schema that covers every planted vuln, and composing multiple
// conditions is a check-file-only addition later (new checks, not a new
// engine feature) if it's ever needed.
type Check struct {
	ID        string `yaml:"id"`
	Title     string `yaml:"title"`
	SkillNode string `yaml:"skillNode"`
	Points    int    `yaml:"points"`
	Type      string `yaml:"type"`
	// Params is left as a raw yaml.Node so each registered Evaluator can
	// decode it into its own params struct — the registry doesn't need to
	// know every check type's shape up front.
	Params yaml.Node `yaml:"params"`
}

// Parse decodes a check file's raw bytes and validates structural
// invariants (non-empty/unique ids, known-shape fields). It does not
// validate that a check's `type` is registered — that's the registry's job
// at evaluation time, keeping this package independent of which check
// types exist.
func Parse(data []byte) (*CheckFile, error) {
	var cf CheckFile
	if err := yaml.Unmarshal(data, &cf); err != nil {
		return nil, err
	}
	if err := validate(&cf); err != nil {
		return nil, err
	}
	return &cf, nil
}
