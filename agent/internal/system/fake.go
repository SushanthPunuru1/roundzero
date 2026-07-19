package system

import "fmt"

// Fake is an in-memory System for unit tests: canned file contents, modes,
// and command output, no real OS access. Lets every check evaluator's pure
// logic be tested without a Linux box, systemd, or Docker.
type Fake struct {
	Files    map[string]string // path -> contents; absent key == absent file
	Modes    map[string]uint32 // path -> permission bits; absent key == absent file
	Commands map[string]FakeResult
}

type FakeResult struct {
	Stdout   string
	ExitCode int
	Err      error
}

func NewFake() *Fake {
	return &Fake{
		Files:    map[string]string{},
		Modes:    map[string]uint32{},
		Commands: map[string]FakeResult{},
	}
}

func (f *Fake) ReadFile(path string) (string, error) {
	return f.Files[path], nil
}

func (f *Fake) Mode(path string) (uint32, bool, error) {
	m, ok := f.Modes[path]
	return m, ok, nil
}

// commandKey joins argv the same way tests register expectations, so a
// registered command must match the evaluator's argv exactly.
func commandKey(argv []string) string {
	key := ""
	for i, a := range argv {
		if i > 0 {
			key += "\x00"
		}
		key += a
	}
	return key
}

func (f *Fake) Run(argv ...string) (string, int, error) {
	key := commandKey(argv)
	res, ok := f.Commands[key]
	if !ok {
		return "", -1, fmt.Errorf("fake system: no command registered for %q", argv)
	}
	return res.Stdout, res.ExitCode, res.Err
}

// OnCommand registers the result of a Run call for the given argv.
func (f *Fake) OnCommand(result FakeResult, argv ...string) {
	f.Commands[commandKey(argv)] = result
}
