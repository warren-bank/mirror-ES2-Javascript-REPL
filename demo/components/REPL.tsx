import React, { useState, useRef, useEffect } from "react";
import { createGlobalContext, runInContext, Value, isObject } from "../../src/index";
import { setupConsole } from "../utils/console";
import { ObjectInspector } from "./ObjectInspector";
import "./REPL.css";

interface REPLEntry {
    id: number;
    type: "input" | "output" | "error";
    content: string | Value;
    timestamp: Date;
}

export const REPL: React.FC = () => {
    const [entries, setEntries] = useState<REPLEntry[]>([]);
    const [input, setInput] = useState("");
    const [isRunning, setIsRunning] = useState(false);
    const [context] = useState(() => {
        const ctx = createGlobalContext();
        setupConsole(ctx, (value: Value) => {
            const newEntry: REPLEntry = {
                id: Date.now() + Math.random(),
                type: "output",
                content: value,
                timestamp: new Date(),
            };
            setEntries((prev) => [...prev, newEntry]);
        });
        return ctx;
    });

    const [inputState, setInputState] = useState({
        inputHistory: [],
        inputHistoryIndex: -1,
        lastResult: null
    });

    const inputRef = useRef<HTMLTextAreaElement>(null);
    const outputRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (outputRef.current) {
            outputRef.current.scrollTop = outputRef.current.scrollHeight;
        }
    }, [entries]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || isRunning) return;

        inputState.inputHistory.push(input);
        inputState.inputHistoryIndex = -1;
        inputState.lastResult = null;
        setInputState(inputState);

        const inputEntry: REPLEntry = {
            id: Date.now(),
            type: "input",
            content: input,
            timestamp: new Date(),
        };

        setEntries((prev) => [...prev, inputEntry]);
        setIsRunning(true);

        try {
            const result = await runInContext(input, context);
            const value = result.hasValue ? result.value : undefined;

            if (value) {
                inputState.lastResult = (typeof value === 'string') ? value : JSON.stringify(value, null, 2);
                setInputState(inputState);
            }

            const outputEntry: REPLEntry = {
                id: Date.now() + 1,
                type: "output",
                content: value,
                timestamp: new Date(),
            };

            setEntries((prev) => [...prev, outputEntry]);
        } catch (error) {
            const errorEntry: REPLEntry = {
                id: Date.now() + 1,
                type: "error",
                content: error instanceof Error ? error.message : String(error),
                timestamp: new Date(),
            };

            setEntries((prev) => [...prev, errorEntry]);
        } finally {
            setIsRunning(false);
        }

        setInput("");
        if (inputRef && inputRef.current) inputRef.current.focus();
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter") {
            e.preventDefault();

            if (e.ctrlKey || e.metaKey)
                setInput(input + "\n");
            else
                handleSubmit(e as any);
        }
        if (e.key === ";") {
            e.preventDefault();

            setInput(input + ";\n");
        }
        else if (e.key === "c" && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();

            if (inputState.lastResult) {
                try {
                    navigator.clipboard.writeText(inputState.lastResult);
                }
                catch(e) {}
            }
        }
        else if (e.key === "ArrowUp") {
            e.preventDefault();

            if (inputState.inputHistory.length) {
              if ((inputState.inputHistoryIndex <= 0) || (inputState.inputHistoryIndex >= inputState.inputHistory.length))
                  inputState.inputHistoryIndex = inputState.inputHistory.length;

              inputState.inputHistoryIndex -= 1;
              setInput(inputState.inputHistory[inputState.inputHistoryIndex]);
            }
        }
        else if (e.key === "ArrowDown") {
            e.preventDefault();

            if (inputState.inputHistory.length) {
              if ((inputState.inputHistoryIndex < 0) || (inputState.inputHistoryIndex >= inputState.inputHistory.length - 1))
                  inputState.inputHistoryIndex = -1;

              inputState.inputHistoryIndex += 1;
              setInput(inputState.inputHistory[inputState.inputHistoryIndex]);
            }
        }
        else if (e.key === "Escape") {
            e.preventDefault();

            clearHistory();
        }
    };

    const clearHistory = () => {
        setEntries([]);

        inputState.inputHistory = [];
        inputState.inputHistoryIndex = -1;
        inputState.lastResult = null;
        setInputState(inputState);
    };

    const getValueTypeClass = (value: Value): string => {
        if (value === null) return "repl-value-null";
        if (value === undefined) return "repl-value-undefined";
        if (typeof value === "number") return "repl-value-number";
        if (typeof value === "string") return "repl-value-string";
        if (typeof value === "boolean") return "repl-value-boolean";
        if (isObject(value)) return "repl-value-object";
        return "repl-value-default";
    };

    const renderPrimitiveValue = (value: Value): React.ReactNode => {
        const className = getValueTypeClass(value);

        if (value === null) {
            return <span className={className}>null</span>;
        }
        if (value === undefined) {
            return <span className={className}>undefined</span>;
        }
        if (typeof value === "string") {
            return <span className={className}>"{value}"</span>;
        }
        if (typeof value === "boolean") {
            return <span className={className}>{value ? "true" : "false"}</span>;
        }
        if (typeof value === "number") {
            return <span className={className}>{String(value)}</span>;
        }

        return <span className={className}>{String(value)}</span>;
    };

    const renderEntryContent = (entry: REPLEntry) => {
        if (entry.type === "input") {
            return <code className="repl-input-code">{entry.content as string}</code>;
        }

        if (entry.type === "error") {
            return <span className="repl-error">{entry.content as string}</span>;
        }

        // Output
        const value = entry.content as Value;
        if (isObject(value)) {
            return <ObjectInspector value={value} />;
        }
        return renderPrimitiveValue(value);
    };

    return (
        <div className="repl-container">
            <div className="repl-header">
                <h1>ES2 REPL</h1>
                <div className="repl-controls">
                    <button onClick={clearHistory} className="repl-clear-btn">
                        Clear History
                    </button>
                </div>
            </div>

            <div className="repl-output" ref={outputRef}>
                {entries.map((entry) => (
                    <div key={entry.id} className={`repl-entry repl-entry-${entry.type}`}>
                        <div className="repl-entry-indicator">
                            {entry.type === "input" ? "❯" : entry.type === "error" ? "✗" : "←"}
                        </div>
                        <div className="repl-entry-content">{renderEntryContent(entry)}</div>
                        <div className="repl-entry-timestamp">{entry.timestamp.toLocaleTimeString()}</div>
                    </div>
                ))}
                {isRunning && (
                    <div className="repl-entry repl-running">
                        <div className="repl-entry-indicator">⟳</div>
                        <div className="repl-entry-content">
                            <span className="repl-running-text">Running...</span>
                        </div>
                    </div>
                )}
            </div>

            <form onSubmit={handleSubmit} className="repl-input-form">
                <div className="repl-input-container">
                    <div className="repl-input-indicator">❯</div>
                    <textarea
                        ref={inputRef}
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Enter JavaScript code... (Enter to run)"
                        className="repl-input"
                        rows={3}
                        disabled={isRunning}
                    />
                    <button type="submit" disabled={!input.trim() || isRunning} className="repl-submit-btn">
                        {isRunning ? "Running..." : "Run"}
                    </button>
                </div>
                <div className="repl-hint">Tip: Press <i>Enter</i> to execute the input, or click the <i>Run</i> button.</div>
                <div className="repl-hint">Tip: Press <i>Ctrl/Cmd + Enter</i> or <i>;</i> to insert a <i>Carriage Return</i>.</div>
                <div className="repl-hint">Tip: Press <i>Up</i> or <i>Down</i> arrows to cycle through the input history.</div>
                <div className="repl-hint">Tip: Press <i>Ctrl/Cmd + C</i> to copy the last result.</div>
                <div className="repl-hint">Tip: Press <i>Esc</i> to clear the history, or click the <i>Clear History</i> button.</div>
            </form>
        </div>
    );
};
