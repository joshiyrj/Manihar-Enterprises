import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { X, Mic, MicOff, Send, Check, XCircle, Trash2 } from "lucide-react";
import AssistantFace from "./AssistantFace";
import { useVoiceRecognition } from "./useVoiceRecognition";
import { useAssistant } from "./useAssistant";

export default function DigitalAssistant() {
    const nav = useNavigate();
    const location = useLocation();
    const qc = useQueryClient();
    const [open, setOpen] = useState(false);
    const [textInput, setTextInput] = useState("");
    const [voiceError, setVoiceError] = useState("");
    const scrollRef = useRef(null);

    const handleNavigate = useCallback((path) => nav(path), [nav]);
    const handleDataChanged = useCallback(() => {
        qc.invalidateQueries({ queryKey: ["entities"] });
        qc.invalidateQueries({ queryKey: ["collections"] });
        qc.invalidateQueries({ queryKey: ["mills"] });
        qc.invalidateQueries({ queryKey: ["quantities"] });
        qc.invalidateQueries({ queryKey: ["design-nos"] });
        qc.invalidateQueries({ queryKey: ["admin-me"] });
        qc.invalidateQueries({ queryKey: ["analytics-dashboard"] });
    }, [qc]);

    const assistant = useAssistant({
        onNavigate: handleNavigate,
        onDataChanged: handleDataChanged
    });

    const voice = useVoiceRecognition({
        onWakeWord: () => {
            setVoiceError("");
            setOpen(true);
            voice.stopWakeWordDetection();
            setTimeout(() => {
                assistant.speak("Hello. How can I help?").then(() => {
                    beginListening();
                });
            }, 300);
        },
        onResult: (text) => {
            setVoiceError("");
            if (assistant.pendingAction) {
                const lower = text.toLowerCase();
                if (lower.includes("yes") || lower.includes("confirm") || lower.includes("go ahead")) {
                    assistant.confirmAction();
                } else if (lower.includes("no") || lower.includes("cancel") || lower.includes("don't")) {
                    assistant.cancelAction();
                } else {
                    assistant.sendMessage(text, getCurrentContext());
                }
            } else {
                assistant.sendMessage(text, getCurrentContext());
            }
        },
        onError: (message) => {
            setVoiceError(message || "Voice input is unavailable.");
            assistant.setStatus("idle");
        }
    });
    const voiceSupported = voice.isSupported;
    const startWakeWordDetection = voice.startWakeWordDetection;
    const stopWakeWordDetection = voice.stopWakeWordDetection;
    const startListening = voice.startListening;
    const isListening = voice.isListening;
    const assistantStatus = assistant.status;
    const assistantIsSpeaking = assistant.isSpeaking;
    const assistantSetStatus = assistant.setStatus;

    const beginListening = useCallback(() => {
        assistant.stopSpeaking();
        startListening();
        assistantSetStatus("listening");
    }, [assistant, assistantSetStatus, startListening]);

    function getCurrentContext() {
        const path = location.pathname;
        if (path === "/admin" || path === "/admin/") return "Dashboard";
        if (path.includes("items")) return "Items page";
        if (path.includes("collections")) return "Collections page";
        if (path.includes("mills")) return "Mills page";
        if (path.includes("quantities")) return "Quantities page";
        if (path.includes("design-nos")) return "Design numbers page";
        if (path.includes("profile")) return "Profile page";
        if (path.includes("activity")) return "Activity Log page";
        if (path.includes("export")) return "Export page";
        return "Admin panel";
    }

    useEffect(() => {
        if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }, [assistant.messages]);

    useEffect(() => {
        if (!voiceSupported) return;
        if (!open) startWakeWordDetection();
        else stopWakeWordDetection();
        return () => stopWakeWordDetection();
    }, [open, voiceSupported, startWakeWordDetection, stopWakeWordDetection]);

    useEffect(() => {
        if (open && assistantStatus === "idle" && !assistantIsSpeaking && !isListening) {
            const timer = setTimeout(() => {
                if (open && assistantStatus === "idle") {
                    beginListening();
                }
            }, 900);
            return () => clearTimeout(timer);
        }
    }, [open, assistantStatus, assistantIsSpeaking, isListening, beginListening]);

    function handleOpen() {
        setOpen(true);
        if (assistant.messages.length === 0) {
            setTimeout(() => {
                assistant.speak("Assistant ready. Tell me what you want to manage.").then(() => {
                    beginListening();
                });
            }, 400);
        }
    }

    function handleClose() {
        setOpen(false);
        voice.stopListening();
        assistant.stopSpeaking();
        assistant.setStatus("idle");
    }

    function handleTextSend() {
        const trimmed = textInput.trim();
        if (!trimmed) return;
        setTextInput("");
        if (assistant.pendingAction) {
            const lower = trimmed.toLowerCase();
            if (["yes", "y", "confirm", "ok", "sure"].some((w) => lower.includes(w))) {
                assistant.confirmAction();
            } else if (["no", "n", "cancel", "nope"].some((w) => lower.includes(w))) {
                assistant.cancelAction();
            } else {
                assistant.sendMessage(trimmed, getCurrentContext());
            }
        } else {
            assistant.sendMessage(trimmed, getCurrentContext());
        }
    }

    function handleMicClick() {
        if (!voice.isSupported) {
            setVoiceError("Voice input is not supported in this browser.");
            return;
        }
        if (voice.isListening) {
            voice.stopListening();
            assistant.stopSpeaking();
            assistant.setStatus("idle");
            setVoiceError("");
        } else {
            beginListening();
            setVoiceError("");
        }
    }

    const statusText = voice.isListening
        ? "Listening"
        : assistant.status === "thinking"
            ? "Thinking"
            : assistant.isSpeaking
                ? "Speaking"
                : assistant.pendingAction
                    ? "Awaiting confirmation"
                    : "Online";

    return (
        <>
            {!open && (
                <div style={{ position: "fixed", bottom: 24, right: 24, zIndex: 1000 }}>
                    <button
                        onClick={handleOpen}
                        style={{
                            width: 72,
                            height: 72,
                            borderRadius: "50%",
                            border: "3px solid color-mix(in srgb, var(--brand-2) 42%, transparent)",
                            padding: 0,
                            cursor: "pointer",
                            overflow: "hidden",
                            background: "transparent",
                            boxShadow: "0 8px 32px color-mix(in srgb, var(--brand-2) 30%, transparent)",
                            animation: "widgetPulse 3s ease-in-out infinite",
                            transition: "transform 0.2s"
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.08)")}
                        onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
                        title="Open assistant"
                    >
                        <AssistantFace size={66} speaking={false} listening={false} />
                    </button>
                    <div
                        style={{
                            position: "absolute",
                            bottom: 2,
                            right: 2,
                            width: 14,
                            height: 14,
                            borderRadius: "50%",
                            background: "var(--success)",
                            border: "2px solid var(--surface-strong)"
                        }}
                    />
                </div>
            )}

            {open && (
                <div
                    style={{
                        position: "fixed",
                        bottom: 24,
                        right: 24,
                        zIndex: 1000,
                        width: 420,
                        maxHeight: "85vh",
                        borderRadius: 24,
                        background: "var(--surface-strong)",
                        border: "1px solid var(--line)",
                        boxShadow: "var(--shadow-lg)",
                        display: "flex",
                        flexDirection: "column",
                        overflow: "hidden",
                        animation: "panelSlideUp 0.35s cubic-bezier(0.16, 1, 0.3, 1)"
                    }}
                >
                    <div
                        style={{
                            padding: "20px 20px 16px",
                            background: "linear-gradient(135deg, #1f4b99 0%, #2f6ad8 100%)",
                            display: "flex",
                            alignItems: "center",
                            gap: 14,
                            position: "relative",
                            overflow: "hidden"
                        }}
                    >
                        <div style={{ border: "3px solid rgba(255,255,255,0.3)", borderRadius: "50%", padding: 2 }}>
                            <AssistantFace speaking={assistant.isSpeaking} listening={voice.isListening} size={56} />
                        </div>

                        <div style={{ flex: 1, zIndex: 1 }}>
                            <div style={{ color: "white", fontWeight: 700, fontSize: 16 }}>Digital Assistant</div>
                            <div style={{ color: "rgba(255,255,255,0.85)", fontSize: 12, marginTop: 2 }}>{statusText}</div>
                        </div>

                        <div style={{ display: "flex", gap: 6, zIndex: 1 }}>
                            <IconBtn onClick={assistant.clearMessages} title="Clear chat">
                                <Trash2 size={15} color="white" />
                            </IconBtn>
                            <IconBtn onClick={handleClose} title="Close">
                                <X size={15} color="white" />
                            </IconBtn>
                        </div>
                    </div>

                    <div
                        ref={scrollRef}
                        style={{
                            flex: 1,
                            overflow: "auto",
                            padding: "16px 16px 10px",
                            maxHeight: "52vh",
                            minHeight: 180,
                            background: "var(--surface-soft)"
                        }}
                    >
                        {voiceError && (
                            <div
                                style={{
                                    marginBottom: 10,
                                    padding: "10px 12px",
                                    borderRadius: 12,
                                    background: "var(--danger-soft)",
                                    border: "1px solid color-mix(in srgb, var(--danger) 24%, transparent)",
                                    color: "color-mix(in srgb, var(--danger) 82%, var(--text-main))",
                                    fontSize: 12
                                }}
                            >
                                {voiceError}
                            </div>
                        )}

                        {assistant.messages.length === 0 && (
                            <div style={{ textAlign: "center", padding: "24px 16px", color: "var(--text-sub)" }}>
                                <div style={{ display: "inline-block", borderRadius: "50%", border: "3px solid var(--line)", padding: 4, marginBottom: 12 }}>
                                    <AssistantFace size={90} speaking={false} />
                                </div>
                                <p style={{ fontSize: 14, fontWeight: 600, color: "var(--text-main)", marginBottom: 4 }}>Ready for your command</p>
                                <p style={{ fontSize: 12, color: "var(--text-sub)", lineHeight: 1.5 }}>
                                    You can type, click mic, or say "Hello Assistant".
                                </p>
                            </div>
                        )}

                        {assistant.messages.map((msg, i) => (
                            <div
                                key={i}
                                style={{
                                    marginBottom: 10,
                                    display: "flex",
                                    justifyContent: msg.role === "user" ? "flex-end" : "flex-start",
                                    alignItems: "flex-end",
                                    gap: 8
                                }}
                            >
                                {msg.role === "assistant" && (
                                    <div style={{ flexShrink: 0, marginBottom: 2 }}>
                                        <AssistantFace size={28} speaking={false} />
                                    </div>
                                )}
                                <div
                                    style={{
                                        maxWidth: "78%",
                                        padding: "10px 14px",
                                        borderRadius: 18,
                                        fontSize: 13.5,
                                        lineHeight: 1.55,
                                        ...(msg.role === "user"
                                            ? { background: "linear-gradient(135deg, #1f4b99, #2f6ad8)", color: "white", borderBottomRightRadius: 6 }
                                            : {
                                                background: "var(--surface-strong)",
                                                color: "var(--text-main)",
                                                borderBottomLeftRadius: 6,
                                                border: "1px solid var(--line)",
                                                boxShadow: "0 1px 3px rgba(0,0,0,0.06)"
                                            })
                                    }}
                                >
                                    {msg.text}
                                </div>
                            </div>
                        ))}

                        {assistant.status === "thinking" && (
                            <div style={{ display: "flex", alignItems: "flex-end", gap: 8, marginBottom: 10 }}>
                                <AssistantFace size={28} speaking={false} />
                                <div
                                    style={{
                                        background: "var(--surface-strong)",
                                        border: "1px solid var(--line)",
                                        padding: "12px 18px",
                                        borderRadius: 18,
                                        borderBottomLeftRadius: 6,
                                        display: "flex",
                                        gap: 5
                                    }}
                                >
                                    {[0, 1, 2].map((i) => (
                                        <span
                                            key={i}
                                            style={{
                                                width: 8,
                                                height: 8,
                                                borderRadius: "50%",
                                                background: "var(--brand-2)",
                                                animation: `dotBounce 0.6s ease-in-out ${i * 0.15}s infinite`
                                            }}
                                        />
                                    ))}
                                </div>
                            </div>
                        )}

                        {voice.isListening && voice.transcript && (
                            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 10, opacity: 0.58 }}>
                                <div
                                    style={{
                                        maxWidth: "78%",
                                        padding: "8px 14px",
                                        borderRadius: 18,
                                        background: "var(--brand-soft)",
                                        color: "color-mix(in srgb, var(--brand-2) 86%, var(--text-main))",
                                        fontSize: 13,
                                        fontStyle: "italic",
                                        borderBottomRightRadius: 6
                                    }}
                                >
                                    {voice.transcript}...
                                </div>
                            </div>
                        )}
                    </div>

                    {assistant.pendingAction && (
                        <div style={{ padding: "10px 16px", borderTop: "1px solid var(--line)", display: "flex", gap: 8, background: "var(--warning-soft)" }}>
                            <button onClick={assistant.confirmAction} style={{ ...actionBtn, background: "#22c55e", color: "white" }}>
                                <Check size={15} /> Yes, do it
                            </button>
                            <button onClick={assistant.cancelAction} style={{ ...actionBtn, background: "var(--surface-strong)", color: "var(--text-sub)", border: "1px solid var(--line)" }}>
                                <XCircle size={15} /> Cancel
                            </button>
                        </div>
                    )}

                    <div style={{ padding: "12px 14px", borderTop: "1px solid var(--line)", display: "flex", gap: 8, alignItems: "center", background: "var(--surface-strong)" }}>
                        <button
                            onClick={handleMicClick}
                            title={voice.isListening ? "Stop" : "Speak"}
                            style={{
                                width: 40,
                                height: 40,
                                borderRadius: "50%",
                                border: "none",
                                background: voice.isListening ? "linear-gradient(135deg,#ef4444,#f97316)" : "var(--surface-soft)",
                                cursor: "pointer",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                transition: "all 0.2s",
                                animation: voice.isListening ? "micPulse 1.2s ease-in-out infinite" : "none"
                            }}
                        >
                            {voice.isListening ? <MicOff size={18} color="white" /> : <Mic size={18} color="var(--text-sub)" />}
                        </button>

                        <input
                            type="text"
                            value={textInput}
                            onChange={(e) => setTextInput(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && handleTextSend()}
                            placeholder={voice.isListening ? "Listening..." : "Type a message..."}
                            disabled={assistant.status === "thinking"}
                            style={{
                                flex: 1,
                                padding: "10px 16px",
                                borderRadius: 24,
                                border: "1px solid var(--line)",
                                outline: "none",
                                fontSize: 13.5,
                                color: "var(--text-main)",
                                background: "var(--input-bg)"
                            }}
                        />

                        <button
                            onClick={handleTextSend}
                            disabled={!textInput.trim() || assistant.status === "thinking"}
                            style={{
                                width: 40,
                                height: 40,
                                borderRadius: "50%",
                                border: "none",
                                background: textInput.trim() ? "linear-gradient(135deg,#1f4b99,#2f6ad8)" : "var(--surface-soft)",
                                cursor: textInput.trim() ? "pointer" : "default",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                transition: "all 0.2s"
                            }}
                        >
                            <Send size={16} color={textInput.trim() ? "white" : "var(--text-faint)"} />
                        </button>
                    </div>
                </div>
            )}

            <style>{`
                @keyframes panelSlideUp {
                    from { opacity: 0; transform: translateY(24px) scale(0.92); }
                    to { opacity: 1; transform: translateY(0) scale(1); }
                }
                @keyframes widgetPulse {
                    0%   { box-shadow: 0 8px 32px color-mix(in srgb, var(--brand-2) 30%, transparent), 0 0 0 0 color-mix(in srgb, var(--brand-2) 35%, transparent); }
                    50%  { box-shadow: 0 8px 32px color-mix(in srgb, var(--brand-2) 30%, transparent), 0 0 0 8px color-mix(in srgb, var(--brand-2) 0%, transparent); }
                    100% { box-shadow: 0 8px 32px color-mix(in srgb, var(--brand-2) 30%, transparent), 0 0 0 0 color-mix(in srgb, var(--brand-2) 35%, transparent); }
                }
                @keyframes micPulse {
                    0%   { box-shadow: 0 0 0 0 rgba(239,68,68,0.4); }
                    50%  { box-shadow: 0 0 0 8px rgba(239,68,68,0); }
                    100% { box-shadow: 0 0 0 0 rgba(239,68,68,0.4); }
                }
                @keyframes dotBounce {
                    0%, 100% { transform: translateY(0); opacity: 0.4; }
                    50% { transform: translateY(-6px); opacity: 1; }
                }
            `}</style>
        </>
    );
}

function IconBtn({ onClick, title, children }) {
    return (
        <button
            onClick={onClick}
            title={title}
            style={{
                width: 32,
                height: 32,
                borderRadius: "50%",
                border: "none",
                background: "rgba(255,255,255,0.15)",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "background 0.15s"
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.25)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.15)")}
        >
            {children}
        </button>
    );
}

const actionBtn = {
    flex: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    padding: "9px 16px",
    borderRadius: 14,
    border: "none",
    fontWeight: 600,
    cursor: "pointer",
    fontSize: 13,
    transition: "opacity 0.15s"
};
