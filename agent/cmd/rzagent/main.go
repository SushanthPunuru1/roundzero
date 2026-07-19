// Command rzagent evaluates a RoundZero check file against the live box
// it's run on and prints a score report. Static binary, no runtime deps —
// see agent/README.md for the check-file schema and how to add a check.
package main

import (
	"flag"
	"fmt"
	"os"

	"github.com/roundzero/agent/internal/checks"
	"github.com/roundzero/agent/internal/report"
	"github.com/roundzero/agent/internal/system"
)

func main() {
	os.Exit(run(os.Args[1:], os.Stdout, os.Stderr))
}

func run(args []string, stdout, stderr *os.File) int {
	fs := flag.NewFlagSet("rzagent", flag.ContinueOnError)
	fs.SetOutput(stderr)
	checksPath := fs.String("checks", "", "path to a check file (required)")
	jsonOut := fs.Bool("json", false, "print the report as JSON instead of a text table")
	outPath := fs.String("out", "", "write the report here instead of stdout")
	if err := fs.Parse(args); err != nil {
		return 2
	}
	if *checksPath == "" {
		fmt.Fprintln(stderr, "rzagent: --checks is required")
		fs.Usage()
		return 2
	}

	data, err := os.ReadFile(*checksPath)
	if err != nil {
		fmt.Fprintf(stderr, "rzagent: reading check file: %v\n", err)
		return 1
	}

	cf, err := checks.Parse(data)
	if err != nil {
		fmt.Fprintf(stderr, "rzagent: parsing check file: %v\n", err)
		return 1
	}

	results := checks.Run(cf, system.Real{})
	rep := report.Build(results)

	var out string
	if *jsonOut {
		out, err = rep.JSON()
		if err != nil {
			fmt.Fprintf(stderr, "rzagent: rendering report: %v\n", err)
			return 1
		}
		out += "\n"
	} else {
		out = rep.Text()
	}

	if *outPath != "" {
		if err := os.WriteFile(*outPath, []byte(out), 0o644); err != nil {
			fmt.Fprintf(stderr, "rzagent: writing report: %v\n", err)
			return 1
		}
	}
	fmt.Fprint(stdout, out)

	// Exit code reflects whether the agent itself ran cleanly, not the
	// score — a fresh vulnerable box is a perfectly successful run with a
	// low score. Only a per-check evaluation error (unknown type, bad
	// params, a command that couldn't execute at all) is a process failure.
	for _, r := range results {
		if r.Err != nil {
			return 1
		}
	}
	return 0
}
