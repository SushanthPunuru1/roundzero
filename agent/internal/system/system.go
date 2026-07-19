// Package system abstracts the live-box operations checks need (reading
// files, stat'ing modes, running commands) behind one interface, so every
// check evaluator in internal/checks is pure/unit-testable against a fake
// implementation instead of a real Linux box.
package system

// System is the only way check evaluators touch the outside world.
type System interface {
	// ReadFile returns the full contents of path. A missing file returns
	// ("", nil) — evaluators treat "file absent" as "empty contents", not
	// an error, since several checks (e.g. a cron dropin that was deleted
	// as its own fix) are correctly satisfied by the file not existing.
	ReadFile(path string) (string, error)

	// Mode returns the permission bits of path (e.g. 0640), and whether
	// the path exists at all.
	Mode(path string) (mode uint32, exists bool, err error)

	// Run executes argv[0] with argv[1:] and returns combined stdout.
	// A non-zero exit is not itself an error — many of the commands used
	// here (systemctl is-enabled, dpkg-query, grep) use exit codes to
	// signal a negative result, which each evaluator interprets itself.
	// err is reserved for real execution failures (binary not found).
	Run(argv ...string) (stdout string, exitCode int, err error)
}
