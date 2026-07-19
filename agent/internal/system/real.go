package system

import (
	"bytes"
	"os"
	"os/exec"
)

// Real is the OS-backed System used by the agent binary in production.
type Real struct{}

func (Real) ReadFile(path string) (string, error) {
	b, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			return "", nil
		}
		return "", err
	}
	return string(b), nil
}

func (Real) Mode(path string) (uint32, bool, error) {
	info, err := os.Stat(path)
	if err != nil {
		if os.IsNotExist(err) {
			return 0, false, nil
		}
		return 0, false, err
	}
	return uint32(info.Mode().Perm()), true, nil
}

func (Real) Run(argv ...string) (string, int, error) {
	cmd := exec.Command(argv[0], argv[1:]...)
	var out bytes.Buffer
	cmd.Stdout = &out
	cmd.Stderr = &out
	err := cmd.Run()
	if err == nil {
		return out.String(), 0, nil
	}
	if exitErr, ok := err.(*exec.ExitError); ok {
		return out.String(), exitErr.ExitCode(), nil
	}
	// Real execution failure (binary missing, permission denied to exec, etc).
	return out.String(), -1, err
}
