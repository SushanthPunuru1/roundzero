"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Container, Gauge, Square, Terminal as TerminalIcon, TriangleAlert } from "lucide-react";
import {
  Button,
  EmptyState,
  ScoreLine,
  TerminalFrame,
  type TerminalFrameHandle,
  type TerminalFrameStatus,
} from "@roundzero/ui";

import { launchLab, scoreLab, stopLab, type ScoreRow } from "./actions";

type Phase = "idle" | "launching" | "connecting" | "ready" | "stopped" | "error";

interface ScoreReport {
  totalEarned: number;
  totalPossible: number;
  rows: ScoreRow[];
}

interface ResizeMessage {
  type: "resize";
  cols: number;
  rows: number;
}

interface ServerErrorMessage {
  type: "error";
  message: string;
}

function terminalStatus(phase: Phase): TerminalFrameStatus {
  switch (phase) {
    case "connecting":
      return "connecting";
    case "ready":
      return "ready";
    case "error":
      return "error";
    default:
      return "stopped";
  }
}

export function LabConsole() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [labId, setLabId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [scoring, setScoring] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [report, setReport] = useState<ScoreReport | null>(null);

  const termRef = useRef<TerminalFrameHandle>(null);
  const wsRef = useRef<WebSocket | null>(null);

  const closeSocket = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.onopen = null;
      wsRef.current.onmessage = null;
      wsRef.current.onclose = null;
      wsRef.current.onerror = null;
      wsRef.current.close();
      wsRef.current = null;
    }
  }, []);

  useEffect(() => closeSocket, [closeSocket]);

  const handleLaunch = useCallback(async () => {
    setErrorMessage(null);
    setReport(null);
    setPhase("launching");

    const result = await launchLab();
    if (result.error || !result.labId || !result.wsUrl) {
      setErrorMessage(result.error ?? "Couldn't launch the lab.");
      setPhase("error");
      return;
    }

    setLabId(result.labId);
    setPhase("connecting");

    const ws = new WebSocket(result.wsUrl);
    ws.binaryType = "arraybuffer";
    wsRef.current = ws;

    ws.onopen = () => {
      setPhase("ready");
      termRef.current?.fit();
      termRef.current?.focus();
    };
    ws.onmessage = (event) => {
      if (typeof event.data === "string") {
        try {
          const parsed = JSON.parse(event.data) as ServerErrorMessage;
          if (parsed.type === "error") {
            setErrorMessage(parsed.message);
            setPhase("error");
          }
        } catch {
          // ignore malformed control frames
        }
        return;
      }
      termRef.current?.write(new Uint8Array(event.data as ArrayBuffer));
    };
    ws.onclose = () => {
      wsRef.current = null;
      setPhase((prev) => (prev === "ready" || prev === "connecting" ? "stopped" : prev));
    };
    ws.onerror = () => {
      setErrorMessage("The terminal connection failed.");
      setPhase("error");
    };
  }, []);

  const handleTermData = useCallback((data: string) => {
    wsRef.current?.send(new TextEncoder().encode(data));
  }, []);

  const handleTermResize = useCallback((size: { cols: number; rows: number }) => {
    const ws = wsRef.current;
    if (ws?.readyState === WebSocket.OPEN) {
      const message: ResizeMessage = { type: "resize", ...size };
      ws.send(JSON.stringify(message));
    }
  }, []);

  const handleScore = useCallback(async () => {
    if (!labId) return;
    setScoring(true);
    setErrorMessage(null);
    const result = await scoreLab(labId);
    setScoring(false);
    if (result.error || !result.rows || result.totalEarned === undefined || result.totalPossible === undefined) {
      setErrorMessage(result.error ?? "Couldn't score the lab.");
      return;
    }
    setReport({ totalEarned: result.totalEarned, totalPossible: result.totalPossible, rows: result.rows });
  }, [labId]);

  const handleStop = useCallback(async () => {
    if (!labId) return;
    setStopping(true);
    closeSocket();
    const result = await stopLab(labId);
    setStopping(false);
    if (result.error) {
      setErrorMessage(result.error);
    }
    setLabId(null);
    setReport(null);
    setPhase("stopped");
  }, [labId, closeSocket]);

  const showTerminal = phase === "connecting" || phase === "ready" || (phase === "error" && labId);

  return (
    <div className="mt-8 flex flex-col gap-6">
      {phase === "idle" && (
        <EmptyState
          icon={TerminalIcon}
          message="No lab running — launch a guided practice lab to get a live shell in a real, intentionally vulnerable Linux box."
          action={<Button onClick={() => void handleLaunch()}>Launch practice lab</Button>}
        />
      )}

      {phase === "launching" && (
        <EmptyState icon={Container} message="Starting your lab container…" />
      )}

      {phase === "stopped" && (
        <EmptyState
          icon={TerminalIcon}
          message="Lab stopped — nothing running. Launch a new one to keep practicing."
          action={<Button onClick={() => void handleLaunch()}>Launch practice lab</Button>}
        />
      )}

      {phase === "error" && !labId && (
        <EmptyState
          icon={TriangleAlert}
          message={errorMessage ?? "Something went wrong launching the lab."}
          action={<Button onClick={() => void handleLaunch()}>Try again</Button>}
        />
      )}

      {showTerminal && (
        <div className="flex flex-col gap-3">
          <TerminalFrame
            ref={termRef}
            status={terminalStatus(phase)}
            title="linux-practice"
            subtitle={labId ?? undefined}
            onData={handleTermData}
            onResize={handleTermResize}
          />

          {errorMessage && phase === "error" && (
            <p className="text-sm text-penalty">{errorMessage}</p>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={() => void handleScore()} disabled={phase !== "ready" || scoring}>
              <Gauge className="size-4" strokeWidth={1.75} aria-hidden="true" />
              {scoring ? "Scoring…" : "Score"}
            </Button>
            <Button variant="ghost" onClick={() => void handleStop()} disabled={stopping}>
              <Square className="size-4" strokeWidth={1.75} aria-hidden="true" />
              {stopping ? "Stopping…" : "Stop lab"}
            </Button>
          </div>
        </div>
      )}

      {report && (
        <div className="flex flex-col gap-1 border-t border-hairline pt-6">
          <p className="font-mono text-sm tabular-nums text-text">
            Score: <span className="text-accent">{report.totalEarned}</span> / {report.totalPossible}
          </p>
          <div className="mt-2 flex flex-col divide-y divide-hairline">
            {report.rows.map((row) => (
              <ScoreLine
                key={row.id}
                state={row.state}
                points={row.points}
                possiblePoints={row.possiblePoints}
                category={row.category}
                title={row.title}
                why={row.why}
                lessonHref={row.lessonHref}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
